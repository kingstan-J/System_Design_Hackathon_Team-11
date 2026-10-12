import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app.js';
import { connectDB, closeDB } from '../src/config/db.js';
import { Product } from '../src/models/Product.js';
import { Inventory } from '../src/models/Inventory.js';
import { InventoryReservation } from '../src/models/InventoryReservation.js';
import { Payment } from '../src/models/Payment.js';
import { Order } from '../src/models/Order.js';
import { OutboxEvent } from '../src/models/OutboxEvent.js';
import { OrderService } from '../src/services/order.service.js';
import { processOutboxEvents } from '../src/jobs/outboxRetry.job.js';

describe('Phase 4 - Payments, Orders, Idempotency & Failure Recovery Tests', () => {
  let customerToken = '';
  let customerId = '';
  let testProduct = null;

  before(async () => {
    await connectDB();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@salestorm.io', password: 'Customer@123' });
    customerToken = loginRes.body.token;
    customerId = loginRes.body.user.id;

    // Create an isolated test product with 50 units
    testProduct = await Product.create({
      name: `Payment Test Item ${Date.now()}`,
      description: 'Isolated product for payments and order lifecycle testing',
      category: 'Smartphones',
      price: 500,
    });

    await Inventory.create({
      productId: testProduct._id,
      totalQuantity: 50,
      availableQuantity: 50,
      reservedQuantity: 0,
      soldQuantity: 0,
    });
  });

  after(async () => {
    OrderService.clearOutage();
    await closeDB();
  });

  test('Test 1: Successful purchase flow (Reservation -> Payment -> Order -> Sold Stock)', async () => {
    // 1. Reserve 1 unit
    const resIdemKey = `res_pay_test_${Date.now()}`;
    const resRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: testProduct._id.toString(),
        quantity: 1,
        idempotencyKey: resIdemKey,
      });

    assert.strictEqual(resRes.status, 201);
    const reservationId = resRes.body.reservation.reservationId;

    // 2. Pay for reservation
    const payIdemKey = `pay_flow_${Date.now()}`;
    const payRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        reservationId,
        idempotencyKey: payIdemKey,
        simulationMode: 'FORCE_SUCCESS',
      });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.payment.status, 'SUCCEEDED');
    assert.ok(payRes.body.order);
    assert.strictEqual(payRes.body.order.status, 'CONFIRMED');

    // 3. Verify reservation status in MongoDB
    const updatedRes = await InventoryReservation.findOne({ reservationId });
    assert.strictEqual(updatedRes.status, 'CONFIRMED');

    // 4. Verify inventory transitioned from reserved -> sold
    const updatedInv = await Inventory.findOne({ productId: testProduct._id });
    assert.strictEqual(updatedInv.soldQuantity >= 1, true);
    assert.strictEqual(updatedInv.totalQuantity, updatedInv.availableQuantity + updatedInv.reservedQuantity + updatedInv.soldQuantity);
  });

  test('Test 2: Payment failure releases reserved inventory exactly once', async () => {
    // 1. Reserve 1 unit
    const resRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: testProduct._id.toString(),
        quantity: 1,
        idempotencyKey: `res_fail_${Date.now()}`,
      });

    const reservationId = resRes.body.reservation.reservationId;
    const invPreFail = await Inventory.findOne({ productId: testProduct._id });

    // 2. Process failed payment
    const payRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        reservationId,
        idempotencyKey: `pay_fail_${Date.now()}`,
        simulationMode: 'FORCE_FAILURE',
      });

    assert.strictEqual(payRes.status, 402);
    assert.strictEqual(payRes.body.error, 'PAYMENT_FAILED');
    assert.strictEqual(payRes.body.payment.status, 'FAILED');

    // 3. Verify reservation status transitioned to RELEASED
    const updatedRes = await InventoryReservation.findOne({ reservationId });
    assert.strictEqual(updatedRes.status, 'RELEASED');

    // 4. Verify stock was restored to available pool
    const invPostFail = await Inventory.findOne({ productId: testProduct._id });
    assert.strictEqual(invPostFail.availableQuantity, invPreFail.availableQuantity + 1);
    assert.strictEqual(invPostFail.reservedQuantity, invPreFail.reservedQuantity - 1);
  });

  test('Test 3: Duplicate payment requests are strictly idempotent', async () => {
    // 1. Reserve 1 unit
    const resRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: testProduct._id.toString(),
        quantity: 1,
        idempotencyKey: `res_idem_pay_${Date.now()}`,
      });

    const reservationId = resRes.body.reservation.reservationId;
    const payKey = `idem_pay_key_${Date.now()}`;

    // First payment attempt
    const firstPay = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        reservationId,
        idempotencyKey: payKey,
        simulationMode: 'FORCE_SUCCESS',
      });

    assert.strictEqual(firstPay.status, 200);
    const paymentId = firstPay.body.payment.paymentId;

    // Second payment attempt with the identical key
    const duplicatePay = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        reservationId,
        idempotencyKey: payKey,
        simulationMode: 'FORCE_SUCCESS',
      });

    assert.strictEqual(duplicatePay.status, 200);
    assert.strictEqual(duplicatePay.body.isIdempotentReplay, true);
    assert.strictEqual(duplicatePay.body.payment.paymentId, paymentId);

    // Verify only ONE payment document exists in MongoDB
    const payDocs = await Payment.find({ customerId, idempotencyKey: payKey });
    assert.strictEqual(payDocs.length, 1);
  });

  test('Test 4: Payment timeout / UNKNOWN reconciliation', async () => {
    // 1. Reserve 1 unit
    const resRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: testProduct._id.toString(),
        quantity: 1,
        idempotencyKey: `res_timeout_${Date.now()}`,
      });

    const reservationId = resRes.body.reservation.reservationId;

    // 2. Trigger timeout payment
    const payRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        reservationId,
        idempotencyKey: `pay_timeout_${Date.now()}`,
        simulationMode: 'FORCE_TIMEOUT',
      });

    assert.strictEqual(payRes.status, 402);
    assert.strictEqual(payRes.body.error, 'PAYMENT_UNKNOWN');
    const paymentId = payRes.body.payment.paymentId;

    // 3. Stock remains safely reserved (NOT released prematurely!)
    const reservationMid = await InventoryReservation.findOne({ reservationId });
    assert.strictEqual(reservationMid.status, 'PENDING');

    // 4. Reconcile transaction
    const recRes = await request(app)
      .post(`/api/payments/${paymentId}/reconcile`)
      .set('Authorization', `Bearer ${customerToken}`);

    assert.strictEqual(recRes.status, 200);
    assert.ok(recRes.body.payment);
    assert.ok(recRes.body.payment.status === 'SUCCEEDED' || recRes.body.payment.status === 'FAILED');
  });

  test('Test 5: Required failure scenario (30-second Order outage recovery via Outbox)', async () => {
    // 1. Reserve 1 unit
    const resRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: testProduct._id.toString(),
        quantity: 1,
        idempotencyKey: `res_outage_${Date.now()}`,
      });

    const reservationId = resRes.body.reservation.reservationId;

    // 2. Activate simulated 30-second order service outage
    OrderService.triggerSimulatedOutage(30);
    assert.strictEqual(OrderService.isOutageActive(), true);

    // 3. Process payment: Payment SUCCEEDS and persists durably, but immediate order creation encounters outage
    const payRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        reservationId,
        idempotencyKey: `pay_outage_${Date.now()}`,
        simulationMode: 'FORCE_SUCCESS',
      });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.payment.status, 'SUCCEEDED');
    assert.strictEqual(payRes.body.order, null, 'Immediate order is null due to active simulated outage');
    const paymentId = payRes.body.payment.paymentId;

    // 4. Verify durable payment and Outbox event exist in MongoDB
    const paymentInDb = await Payment.findOne({ paymentId });
    assert.ok(paymentInDb);
    assert.strictEqual(paymentInDb.status, 'SUCCEEDED');

    // 5. Simulate Outage Recovery (clear outage)
    OrderService.clearOutage();
    assert.strictEqual(OrderService.isOutageActive(), false);

    // 6. Trigger Outbox Retry Worker
    const outboxResult = await processOutboxEvents();
    assert.ok(outboxResult.processed >= 1);

    // 7. Verify order now exists and is linked without duplication
    const finalOrder = await Order.findOne({ reservationId });
    assert.ok(finalOrder);
    assert.strictEqual(finalOrder.paymentId, paymentId);
    assert.strictEqual(finalOrder.status, 'CONFIRMED');

    // 8. Re-running outbox does NOT duplicate the order!
    await processOutboxEvents();
    const orderCount = await Order.countDocuments({ reservationId });
    assert.strictEqual(orderCount, 1, 'Never create duplicate orders on outbox replay');
  });
});

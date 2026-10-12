import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app.js';
import { connectDB, closeDB } from '../src/config/db.js';
import { Product } from '../src/models/Product.js';
import { Inventory } from '../src/models/Inventory.js';
import { InventoryReservation } from '../src/models/InventoryReservation.js';
import { sweepExpiredReservations } from '../src/jobs/reservationExpiry.job.js';

describe('Phase 3 - Atomic Stock Reservations & Invariant Tests', () => {
  let customerToken = '';
  let customerId = '';
  let flashProductId = '';

  before(async () => {
    await connectDB();

    // Login customer
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@salestorm.io', password: 'Customer@123' });
    customerToken = loginRes.body.token;
    customerId = loginRes.body.user.id;

    // Get flagship flash sale product
    const prodRes = await request(app).get('/api/products');
    const flashProd = prodRes.body.products.find((p) => p.name === 'Quantum HyperPhone 15 Pro');
    flashProductId = flashProd._id;
  });

  after(async () => {
    await closeDB();
  });

  test('POST /api/reservations atomically reserves stock and updates inventory', async () => {
    const idempotencyKey = `idem_${crypto.randomUUID()}`;

    // Record initial inventory
    const initialInv = await Inventory.findOne({ productId: flashProductId });
    const initialAvail = initialInv.availableQuantity;
    const initialReserved = initialInv.reservedQuantity;

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: flashProductId,
        quantity: 1,
        idempotencyKey,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.reservation.status, 'PENDING');
    assert.strictEqual(res.body.reservation.quantity, 1);
    assert.ok(res.body.reservation.reservationId.startsWith('res_'));

    // Verify inventory state in MongoDB
    const updatedInv = await Inventory.findOne({ productId: flashProductId });
    assert.strictEqual(updatedInv.availableQuantity, initialAvail - 1);
    assert.strictEqual(updatedInv.reservedQuantity, initialReserved + 1);
    assert.strictEqual(updatedInv.totalQuantity, updatedInv.availableQuantity + updatedInv.reservedQuantity + updatedInv.soldQuantity);
  });

  test('POST /api/reservations is strictly idempotent on duplicate key replay', async () => {
    const idempotencyKey = `idem_replay_${crypto.randomUUID()}`;

    // First request
    const firstRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: flashProductId,
        quantity: 1,
        idempotencyKey,
      });
    assert.strictEqual(firstRes.status, 201);
    const reservationId = firstRes.body.reservation.reservationId;

    const midInv = await Inventory.findOne({ productId: flashProductId });
    const midAvail = midInv.availableQuantity;

    // Duplicate request with the identical idempotency key
    const duplicateRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: flashProductId,
        quantity: 1,
        idempotencyKey,
      });

    assert.strictEqual(duplicateRes.status, 200);
    assert.strictEqual(duplicateRes.body.isIdempotentReplay, true);
    assert.strictEqual(duplicateRes.body.reservation.reservationId, reservationId);

    // Verify stock did NOT decrement twice!
    const finalInv = await Inventory.findOne({ productId: flashProductId });
    assert.strictEqual(finalInv.availableQuantity, midAvail, 'Inventory must not be deducted on idempotent replay');
  });

  test('LAST-UNIT COMPETITION: Exactly 1 wins out of 10 concurrent requests for 1 stock', async () => {
    // 1. Create a competition product with exactly 1 unit available
    const compProduct = await Product.create({
      name: `Last Unit Trophy ${Date.now()}`,
      description: 'One unit only trophy competition',
      category: 'Peripherals',
      price: 299.99,
    });

    await Inventory.create({
      productId: compProduct._id,
      totalQuantity: 1,
      availableQuantity: 1,
      reservedQuantity: 0,
      soldQuantity: 0,
    });

    // 2. Launch 10 simultaneous concurrent requests
    const attempts = Array.from({ length: 10 }, (_, i) => {
      const key = `comp_key_${i}_${Date.now()}`;
      return request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId: compProduct._id.toString(),
          quantity: 1,
          idempotencyKey: key,
        });
    });

    const results = await Promise.all(attempts);

    const successful = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 409);

    assert.strictEqual(successful.length, 1, 'Exactly one concurrent request must win the last unit');
    assert.strictEqual(rejected.length, 9, 'All other 9 concurrent requests must be rejected');

    // 3. Verify final inventory state in MongoDB
    const compInv = await Inventory.findOne({ productId: compProduct._id });
    assert.strictEqual(compInv.availableQuantity, 0, 'Available quantity must be exactly 0 (never negative!)');
    assert.strictEqual(compInv.reservedQuantity, 1, 'Reserved quantity must be exactly 1');
    assert.strictEqual(compInv.totalQuantity, compInv.availableQuantity + compInv.reservedQuantity + compInv.soldQuantity);
  });

  test('Safe Reservation Release: Cancelling PENDING reservation restores inventory', async () => {
    const key = `rel_test_${Date.now()}`;
    const createRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: flashProductId,
        quantity: 1,
        idempotencyKey: key,
      });

    const reservationId = createRes.body.reservation.reservationId;
    const invBeforeRelease = await Inventory.findOne({ productId: flashProductId });

    // Release reservation
    const releaseRes = await request(app)
      .post(`/api/reservations/${reservationId}/release`)
      .set('Authorization', `Bearer ${customerToken}`);

    assert.strictEqual(releaseRes.status, 200);
    assert.strictEqual(releaseRes.body.reservation.status, 'RELEASED');

    // Verify stock is restored
    const invAfterRelease = await Inventory.findOne({ productId: flashProductId });
    assert.strictEqual(invAfterRelease.availableQuantity, invBeforeRelease.availableQuantity + 1);
    assert.strictEqual(invAfterRelease.reservedQuantity, invBeforeRelease.reservedQuantity - 1);

    // Attempt second release: Must fail safely and NOT double-restore stock!
    const secondRelease = await request(app)
      .post(`/api/reservations/${reservationId}/release`)
      .set('Authorization', `Bearer ${customerToken}`);

    assert.strictEqual(secondRelease.status, 400);
    assert.strictEqual(secondRelease.body.error, 'INVALID_STATE');

    const invAfterSecond = await Inventory.findOne({ productId: flashProductId });
    assert.strictEqual(invAfterSecond.availableQuantity, invAfterRelease.availableQuantity, 'Stock must not double-increment');
  });

  test('Reservation Expiry & Background Sweeper safely recovers expired reservations', async () => {
    // 1. Create an isolated product for this test
    const expiryTestProd = await Product.create({
      name: `Expiry Test Product ${Date.now()}`,
      description: 'Isolated test for reservation expiry sweeper',
      category: 'Peripherals',
      price: 99.99,
    });

    await Inventory.create({
      productId: expiryTestProd._id,
      totalQuantity: 10,
      availableQuantity: 9,
      reservedQuantity: 1,
      soldQuantity: 0,
    });

    // Create reservation with past expiry timestamp
    const pastDate = new Date(Date.now() - 60000); // 1 minute in the past
    const reservation = await InventoryReservation.create({
      customerId,
      productId: expiryTestProd._id,
      quantity: 1,
      unitPrice: 99.99,
      status: 'PENDING',
      idempotencyKey: `expired_isolated_${Date.now()}`,
      expiresAt: pastDate,
    });

    // Execute background sweep
    const sweepResult = await sweepExpiredReservations();
    assert.ok(sweepResult.sweptCount >= 1);

    // Verify reservation status transitioned to EXPIRED
    const updatedDoc = await InventoryReservation.findOne({ reservationId: reservation.reservationId });
    assert.strictEqual(updatedDoc.status, 'EXPIRED');

    // Verify isolated product stock was restored to 10 available, 0 reserved
    const invPostSweep = await Inventory.findOne({ productId: expiryTestProd._id });
    assert.strictEqual(invPostSweep.availableQuantity, 10);
    assert.strictEqual(invPostSweep.reservedQuantity, 0);

    // Repeat sweep: Must not double restore
    await sweepExpiredReservations();
    const invPostRepeat = await Inventory.findOne({ productId: expiryTestProd._id });
    assert.strictEqual(invPostRepeat.availableQuantity, 10);
  });
});

import { Payment } from '../models/Payment.js';
import { InventoryReservation } from '../models/InventoryReservation.js';
import { OutboxEvent } from '../models/OutboxEvent.js';
import { ReservationService } from './reservation.service.js';
import { PaymentAdapter } from './paymentAdapter.js';
import { OrderService } from './order.service.js';

export class PaymentService {
  /**
   * Process a payment idempotently and coordinate reservation/order transitions.
   */
  static async processPayment({ customerId, reservationId, idempotencyKey, simulationMode = null }) {
    if (!customerId || !reservationId || !idempotencyKey) {
      throw new Error('customerId, reservationId, and idempotencyKey are required');
    }

    // 1. Strict Idempotency Check
    const existingPayment = await Payment.findOne({ customerId, idempotencyKey });
    if (existingPayment) {
      return {
        isIdempotentReplay: true,
        payment: existingPayment,
      };
    }

    // 2. Validate Reservation Status
    const reservation = await InventoryReservation.findOne({ reservationId, customerId });
    if (!reservation) {
      return {
        success: false,
        reason: 'RESERVATION_NOT_FOUND',
        message: 'No matching reservation found for this customer.',
      };
    }

    if (reservation.status !== 'PENDING') {
      return {
        success: false,
        reason: 'INVALID_RESERVATION_STATE',
        message: `Reservation cannot be paid because status is already ${reservation.status}.`,
      };
    }

    if (new Date() > new Date(reservation.expiresAt)) {
      // Safely expire the reservation if time has passed
      await ReservationService.expireReservation(reservationId);
      return {
        success: false,
        reason: 'RESERVATION_EXPIRED',
        message: 'Reservation TTL has expired. Inventory was released back to the stock pool.',
      };
    }

    const totalAmount = reservation.unitPrice * reservation.quantity;

    // 3. Create Initial Payment Record
    const payment = await Payment.create({
      customerId,
      reservationId,
      amount: totalAmount,
      currency: 'USD',
      status: 'PROCESSING',
      idempotencyKey,
    });

    // 4. Invoke Simulated Payment Provider
    const outcome = await PaymentAdapter.processPayment({
      amount: totalAmount,
      currency: 'USD',
      simulationMode,
    });

    payment.status = outcome.status;
    payment.providerReference = outcome.providerReference;
    payment.failureReason = outcome.failureReason;
    await payment.save();

    // 5. Handle Outcome Branching
    if (outcome.status === 'SUCCEEDED') {
      // A. Confirm reservation atomically (reserved -> sold)
      await ReservationService.confirmReservation(reservationId);

      // B. Create durable OutboxEvent for transactional reliability
      const outboxEvent = await OutboxEvent.create({
        eventType: 'PAYMENT_SUCCEEDED',
        aggregateId: payment.paymentId,
        payload: {
          paymentId: payment.paymentId,
          reservationId: reservation.reservationId,
          customerId: customerId.toString(),
          totalAmount,
        },
        status: 'PENDING',
      });

      // C. Trigger Order Creation (with automatic outage resilience)
      let order = null;
      try {
        order = await OrderService.createOrderFromPayment({
          paymentId: payment.paymentId,
          reservation,
          customerId,
          totalAmount,
        });

        payment.orderId = order.orderNumber;
        await payment.save();

        // Mark outbox published
        outboxEvent.status = 'PUBLISHED';
        outboxEvent.processedAt = new Date();
        await outboxEvent.save();
      } catch (err) {
        console.warn(`[PaymentService] Immediate order creation failed (simulated or transient): ${err.message}. Outbox retry worker will recover.`);
      }

      return {
        success: true,
        payment,
        order,
      };
    } else if (outcome.status === 'FAILED') {
      // Definitive failure: Automatically release reserved inventory back to available stock exactly once!
      console.log(`[PaymentService] Payment definitively failed for reservation ${reservationId}. Releasing stock...`);
      await ReservationService.releaseReservation(reservationId, 'PAYMENT_FAILED');

      return {
        success: false,
        reason: 'PAYMENT_FAILED',
        message: outcome.failureReason || 'Payment declined by provider.',
        payment,
      };
    } else {
      // UNKNOWN / Timeout: Do NOT release stock yet! Requires reconciliation.
      console.warn(`[PaymentService] Payment timed out with UNKNOWN state for reservation ${reservationId}. Awaiting reconciliation.`);
      return {
        success: false,
        reason: 'PAYMENT_UNKNOWN',
        message: 'Payment gateway did not provide a definitive response. Reconciling transaction...',
        payment,
      };
    }
  }

  /**
   * Reconcile an unresolved UNKNOWN payment.
   */
  static async reconcilePayment(paymentId) {
    const payment = await Payment.findOne({ paymentId });
    if (!payment) throw new Error('Payment not found');

    if (payment.status !== 'UNKNOWN') {
      return { message: `Payment already resolved as ${payment.status}`, payment };
    }

    const gatewayResult = await PaymentAdapter.reconcileTransaction(payment.providerReference || '');
    payment.status = gatewayResult.status;
    await payment.save();

    const reservation = await InventoryReservation.findOne({ reservationId: payment.reservationId });

    if (gatewayResult.status === 'SUCCEEDED') {
      if (reservation && reservation.status === 'PENDING') {
        await ReservationService.confirmReservation(reservation.reservationId);
      }
      const order = await OrderService.createOrderFromPayment({
        paymentId: payment.paymentId,
        reservation,
        customerId: payment.customerId,
        totalAmount: payment.amount,
      });
      payment.orderId = order.orderNumber;
      await payment.save();
      return { message: 'Reconciled to SUCCEEDED and order created', payment, order };
    } else {
      if (reservation && reservation.status === 'PENDING') {
        await ReservationService.releaseReservation(reservation.reservationId, 'RECONCILED_FAILED');
      }
      return { message: 'Reconciled to FAILED and reservation released', payment };
    }
  }
}

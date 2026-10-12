import { OutboxEvent } from '../models/OutboxEvent.js';
import { InventoryReservation } from '../models/InventoryReservation.js';
import { Payment } from '../models/Payment.js';
import { OrderService } from '../services/order.service.js';

let outboxInterval = null;

export async function processOutboxEvents() {
  const now = new Date();
  const pendingEvents = await OutboxEvent.find({
    status: { $in: ['PENDING', 'PROCESSING'] },
    nextAttemptAt: { $lte: now },
    attempts: { $lt: 10 },
  }).limit(50);

  if (pendingEvents.length === 0) return { processed: 0 };

  let successCount = 0;

  for (const event of pendingEvents) {
    try {
      if (event.eventType === 'PAYMENT_SUCCEEDED') {
        const { paymentId, reservationId, customerId, totalAmount } = event.payload;

        const reservation = await InventoryReservation.findOne({ reservationId });
        if (!reservation) {
          throw new Error(`Reservation ${reservationId} not found for outbox event.`);
        }

        const order = await OrderService.createOrderFromPayment({
          paymentId,
          reservation,
          customerId,
          totalAmount,
        });

        // Update payment with generated orderNumber
        await Payment.updateOne({ paymentId }, { $set: { orderId: order.orderNumber } });

        event.status = 'PUBLISHED';
        event.processedAt = new Date();
        event.lastError = null;
        await event.save();
        successCount++;
      }
    } catch (err) {
      event.attempts += 1;
      event.lastError = err.message;
      // Exponential backoff
      const backoffSeconds = Math.min(Math.pow(2, event.attempts), 30);
      event.nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);
      event.status = event.attempts >= event.maxAttempts ? 'FAILED' : 'PROCESSING';
      await event.save();
    }
  }

  return { processed: successCount, totalChecked: pendingEvents.length };
}

export function startOutboxWorker(intervalMs = 3000) {
  if (outboxInterval) return;

  console.log(`[OutboxWorker] Transactional Outbox retry worker started (Interval: ${intervalMs}ms).`);
  outboxInterval = setInterval(async () => {
    try {
      await processOutboxEvents();
    } catch (err) {
      console.error('[OutboxWorker] Outbox processing cycle error:', err.message);
    }
  }, intervalMs);
}

export function stopOutboxWorker() {
  if (outboxInterval) {
    clearInterval(outboxInterval);
    outboxInterval = null;
    console.log('[OutboxWorker] Outbox worker stopped.');
  }
}

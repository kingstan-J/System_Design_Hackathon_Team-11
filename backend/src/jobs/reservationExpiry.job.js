import { InventoryReservation } from '../models/InventoryReservation.js';
import { ReservationService } from '../services/reservation.service.js';

let expiryInterval = null;

export async function sweepExpiredReservations() {
  const now = new Date();
  const expiredDocs = await InventoryReservation.find({
    status: 'PENDING',
    expiresAt: { $lte: now },
  }).limit(500);

  if (expiredDocs.length === 0) {
    return { sweptCount: 0 };
  }

  let releasedCount = 0;
  for (const doc of expiredDocs) {
    try {
      const result = await ReservationService.expireReservation(doc.reservationId);
      if (result.success) {
        releasedCount++;
      }
    } catch (err) {
      console.error(`[ExpiryWorker] Error expiring reservation ${doc.reservationId}:`, err.message);
    }
  }

  if (releasedCount > 0) {
    console.log(`[ExpiryWorker] Swept and released ${releasedCount} expired reservations back to inventory.`);
  }

  return { sweptCount: releasedCount };
}

export function startReservationExpiryWorker(intervalMs = 5000) {
  if (expiryInterval) return;

  console.log(`[ExpiryWorker] Reservation expiry background worker started (Interval: ${intervalMs}ms).`);
  expiryInterval = setInterval(async () => {
    try {
      await sweepExpiredReservations();
    } catch (err) {
      console.error('[ExpiryWorker] Background sweep cycle error:', err.message);
    }
  }, intervalMs);
}

export function stopReservationExpiryWorker() {
  if (expiryInterval) {
    clearInterval(expiryInterval);
    expiryInterval = null;
    console.log('[ExpiryWorker] Reservation expiry background worker stopped.');
  }
}

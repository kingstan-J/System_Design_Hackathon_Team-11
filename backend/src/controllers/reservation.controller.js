import { ReservationService } from '../services/reservation.service.js';
import { InventoryReservation } from '../models/InventoryReservation.js';

export async function createReservation(req, res, next) {
  try {
    const { productId, quantity = 1, idempotencyKey } = req.body;
    const customerId = req.user._id;

    if (!productId) {
      return res.status(400).json({ error: 'ValidationError', message: 'productId is required' });
    }

    if (!idempotencyKey) {
      return res.status(400).json({ error: 'ValidationError', message: 'idempotencyKey header or body field is required' });
    }

    const result = await ReservationService.reserveInventory({
      customerId,
      productId,
      quantity: Number(quantity),
      idempotencyKey,
    });

    if (result.isIdempotentReplay) {
      return res.status(200).json({
        message: 'Idempotent replay: Returning existing reservation',
        isIdempotentReplay: true,
        reservation: result.reservation,
      });
    }

    if (!result.success) {
      return res.status(409).json({
        error: result.reason,
        message: result.message,
      });
    }

    res.status(201).json({
      message: 'Inventory reserved successfully',
      reservation: result.reservation,
      inventory: result.inventory,
    });
  } catch (err) {
    next(err);
  }
}

export async function getReservationById(req, res, next) {
  try {
    const reservation = await InventoryReservation.findOne({
      reservationId: req.params.reservationId,
    }).populate('productId', 'name price imageUrl category');

    if (!reservation) {
      return res.status(404).json({ error: 'NotFound', message: 'Reservation not found.' });
    }

    // Role check: Only the owning customer or an admin may view the reservation
    if (req.user.role !== 'ADMIN' && reservation.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied to this reservation.' });
    }

    const isExpired = reservation.status === 'PENDING' && new Date() > new Date(reservation.expiresAt);

    res.status(200).json({
      reservation: {
        ...reservation.toObject(),
        isExpired,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function releaseReservation(req, res, next) {
  try {
    const reservation = await InventoryReservation.findOne({
      reservationId: req.params.reservationId,
    });

    if (!reservation) {
      return res.status(404).json({ error: 'NotFound', message: 'Reservation not found.' });
    }

    if (req.user.role !== 'ADMIN' && reservation.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied.' });
    }

    const result = await ReservationService.releaseReservation(req.params.reservationId, 'USER_REQUEST');

    if (!result.success) {
      return res.status(400).json({
        error: result.reason,
        message: result.message,
      });
    }

    res.status(200).json({
      message: 'Reservation released successfully and inventory restored',
      reservation: result.reservation,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminReservations(req, res, next) {
  try {
    const { status, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const reservations = await InventoryReservation.find(filter)
      .populate('customerId', 'name email')
      .populate('productId', 'name price')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      count: reservations.length,
      reservations,
    });
  } catch (err) {
    next(err);
  }
}

import { PaymentService } from '../services/payment.service.js';
import { Payment } from '../models/Payment.js';

export async function processPayment(req, res, next) {
  try {
    const { reservationId, idempotencyKey, simulationMode } = req.body;
    const customerId = req.user._id;

    if (!reservationId) {
      return res.status(400).json({ error: 'ValidationError', message: 'reservationId is required' });
    }

    if (!idempotencyKey) {
      return res.status(400).json({ error: 'ValidationError', message: 'idempotencyKey is required' });
    }

    const result = await PaymentService.processPayment({
      customerId,
      reservationId,
      idempotencyKey,
      simulationMode,
    });

    if (result.isIdempotentReplay) {
      return res.status(200).json({
        message: 'Idempotent replay: Returning existing payment record',
        isIdempotentReplay: true,
        payment: result.payment,
      });
    }

    if (!result.success) {
      return res.status(402).json({
        error: result.reason,
        message: result.message,
        payment: result.payment,
      });
    }

    res.status(200).json({
      message: 'Payment processed successfully and order created',
      payment: result.payment,
      order: result.order,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPaymentById(req, res, next) {
  try {
    const payment = await Payment.findOne({ paymentId: req.params.paymentId });
    if (!payment) {
      return res.status(404).json({ error: 'NotFound', message: 'Payment record not found' });
    }

    if (req.user.role !== 'ADMIN' && payment.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied to this payment' });
    }

    res.status(200).json({ payment });
  } catch (err) {
    next(err);
  }
}

export async function reconcilePayment(req, res, next) {
  try {
    const result = await PaymentService.reconcilePayment(req.params.paymentId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAdminPayments(req, res, next) {
  try {
    const { status, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const payments = await Payment.find(filter)
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      count: payments.length,
      payments,
    });
  } catch (err) {
    next(err);
  }
}

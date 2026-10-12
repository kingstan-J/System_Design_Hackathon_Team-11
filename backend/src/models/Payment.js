import mongoose from 'mongoose';
import crypto from 'crypto';

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      default: () => `pay_${crypto.randomUUID().slice(0, 16)}`,
      index: true,
    },
    orderId: {
      type: String,
      default: null,
      index: true,
    },
    reservationId: {
      type: String,
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount must be non-negative'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    status: {
      type: String,
      enum: [
        'INITIATED',
        'PROCESSING',
        'SUCCEEDED',
        'FAILED',
        'UNKNOWN',
        'REFUND_PENDING',
        'REFUNDED',
      ],
      default: 'INITIATED',
      index: true,
    },
    providerReference: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      required: true,
      index: true,
    },
    failureReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring idempotency per customer and payment key
paymentSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true });

export const Payment = mongoose.model('Payment', paymentSchema);

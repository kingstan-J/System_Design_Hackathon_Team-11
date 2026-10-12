import mongoose from 'mongoose';
import crypto from 'crypto';

const reservationSchema = new mongoose.Schema(
  {
    reservationId: {
      type: String,
      required: true,
      unique: true,
      default: () => `res_${crypto.randomUUID()}`,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer',
      },
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price must be non-negative'],
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'RELEASED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index for customer + idempotencyKey to prevent duplicate reservations
reservationSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true });

// Compound index for active pending reservations and expiry lookup
reservationSchema.index({ status: 1, expiresAt: 1 });

export const InventoryReservation = mongoose.model('InventoryReservation', reservationSchema);

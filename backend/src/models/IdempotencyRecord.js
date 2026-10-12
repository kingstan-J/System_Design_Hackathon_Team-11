import mongoose from 'mongoose';

const idempotencyRecordSchema = new mongoose.Schema(
  {
    key: {
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
    operation: {
      type: String,
      required: true,
      index: true,
    },
    requestFingerprint: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    },
    responseReference: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '24h' }, // Automatic TTL expiration in MongoDB
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: same customer, same operation, same key
idempotencyRecordSchema.index(
  { customerId: 1, operation: 1, key: 1 },
  { unique: true }
);

export const IdempotencyRecord = mongoose.model('IdempotencyRecord', idempotencyRecordSchema);

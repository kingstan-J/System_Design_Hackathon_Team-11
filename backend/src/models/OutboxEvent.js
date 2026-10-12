import mongoose from 'mongoose';
import crypto from 'crypto';

const outboxEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      default: () => `evt_${crypto.randomUUID()}`,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    aggregateId: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    nextAttemptAt: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    lastError: {
      type: String,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for outbox polling
outboxEventSchema.index({ status: 1, nextAttemptAt: 1 });

export const OutboxEvent = mongoose.model('OutboxEvent', outboxEventSchema);

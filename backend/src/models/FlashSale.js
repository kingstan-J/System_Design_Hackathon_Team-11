import mongoose from 'mongoose';

const flashSaleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Flash sale name is required'],
      trim: true,
      maxlength: 150,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
      index: true,
    },
    flashSalePrice: {
      type: Number,
      required: true,
      min: [0, 'Flash sale price must be non-negative'],
    },
    configuredStock: {
      type: Number,
      required: true,
      min: [1, 'Configured stock must be at least 1 unit'],
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED'],
      default: 'SCHEDULED',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Method to determine dynamic status based on time
flashSaleSchema.methods.computeStatus = function () {
  const now = new Date();
  if (this.status === 'CANCELLED') return 'CANCELLED';
  if (now < this.startTime) return 'SCHEDULED';
  if (now >= this.startTime && now <= this.endTime) return 'ACTIVE';
  return 'ENDED';
};

export const FlashSale = mongoose.model('FlashSale', flashSaleSchema);

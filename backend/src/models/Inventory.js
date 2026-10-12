import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
      index: true,
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: [0, 'Total quantity cannot be negative'],
    },
    availableQuantity: {
      type: Number,
      required: true,
      min: [0, 'Available quantity cannot be negative'],
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Reserved quantity cannot be negative'],
    },
    soldQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Sold quantity cannot be negative'],
    },
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Invariant validation hook: totalQuantity = availableQuantity + reservedQuantity + soldQuantity
inventorySchema.pre('save', function (next) {
  const sum = this.availableQuantity + this.reservedQuantity + this.soldQuantity;
  if (this.totalQuantity !== sum) {
    return next(new Error(`Inventory invariant violated: totalQuantity (${this.totalQuantity}) !== available (${this.availableQuantity}) + reserved (${this.reservedQuantity}) + sold (${this.soldQuantity})`));
  }
  next();
});

export const Inventory = mongoose.model('Inventory', inventorySchema);

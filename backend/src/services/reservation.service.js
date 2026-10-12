import mongoose from 'mongoose';
import { Inventory } from '../models/Inventory.js';
import { InventoryReservation } from '../models/InventoryReservation.js';
import { Product } from '../models/Product.js';
import { FlashSale } from '../models/FlashSale.js';
import { env } from '../config/env.js';

export class ReservationService {
  /**
   * Atomically reserve inventory for a customer with idempotency protection.
   * Enforces: availableQuantity >= quantity via atomic MongoDB query filter.
   */
  static async reserveInventory({ customerId, productId, quantity = 1, idempotencyKey }) {
    if (!customerId || !productId || !idempotencyKey) {
      throw new Error('customerId, productId, and idempotencyKey are required');
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Quantity must be an integer greater than 0');
    }

    // 1. Check Idempotency: Return existing reservation if identical request is repeated
    const existingReservation = await InventoryReservation.findOne({
      customerId,
      idempotencyKey,
    });

    if (existingReservation) {
      return {
        isIdempotentReplay: true,
        reservation: existingReservation,
      };
    }

    // 2. Lookup product and active flash sale for pricing determination
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return {
        success: false,
        reason: 'PRODUCT_UNAVAILABLE',
        message: 'Product does not exist or is inactive.',
      };
    }

    // Check for active flash sale price
    const now = new Date();
    const activeSale = await FlashSale.findOne({
      productId,
      startTime: { $lte: now },
      endTime: { $gte: now },
      status: { $ne: 'CANCELLED' },
    });

    const unitPrice = activeSale ? activeSale.flashSalePrice : product.price;

    // 3. ATOMIC CONDITIONAL UPDATE (Prevents Overselling):
    // MongoDB updates the single document atomically.
    // If availableQuantity < quantity, MongoDB matches 0 documents and returns null.
    const updatedInventory = await Inventory.findOneAndUpdate(
      {
        productId,
        availableQuantity: { $gte: quantity },
      },
      {
        $inc: {
          availableQuantity: -quantity,
          reservedQuantity: quantity,
          version: 1,
        },
      },
      { new: true }
    );

    if (!updatedInventory) {
      return {
        success: false,
        reason: 'OUT_OF_STOCK',
        message: 'Insufficient inventory available to reserve the requested quantity.',
      };
    }

    // 4. Create the Reservation Record
    const expiresAt = new Date(Date.now() + env.RESERVATION_TTL_SECONDS * 1000);

    try {
      const reservation = await InventoryReservation.create({
        customerId,
        productId,
        quantity,
        unitPrice,
        status: 'PENDING',
        idempotencyKey,
        expiresAt,
      });

      return {
        success: true,
        reservation,
        inventory: {
          available: updatedInventory.availableQuantity,
          reserved: updatedInventory.reservedQuantity,
          total: updatedInventory.totalQuantity,
        },
      };
    } catch (err) {
      // Compensating transaction / rollback in case of duplicate key or failure
      console.warn(`[ReservationService] Rolling back inventory reservation due to creation error: ${err.message}`);
      await Inventory.updateOne(
        { productId },
        {
          $inc: {
            availableQuantity: quantity,
            reservedQuantity: -quantity,
            version: 1,
          },
        }
      );

      // If race on duplicate idempotency key occurred concurrently
      if (err.code === 11000) {
        const concurrentExisting = await InventoryReservation.findOne({ customerId, idempotencyKey });
        if (concurrentExisting) {
          return {
            isIdempotentReplay: true,
            reservation: concurrentExisting,
          };
        }
      }

      throw err;
    }
  }

  /**
   * Safely and idempotently release a reservation (e.g. customer cancels or payment fails).
   * Conditional state transition: Only releases if status is currently 'PENDING'.
   */
  static async releaseReservation(reservationId, reason = 'CUSTOMER_CANCELLED') {
    // Conditional state transition prevents double-release
    const reservation = await InventoryReservation.findOneAndUpdate(
      {
        reservationId,
        status: 'PENDING',
      },
      {
        $set: {
          status: 'RELEASED',
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!reservation) {
      // Check current state to provide descriptive feedback
      const current = await InventoryReservation.findOne({ reservationId });
      if (!current) {
        return { success: false, reason: 'NOT_FOUND', message: 'Reservation not found.' };
      }
      return {
        success: false,
        reason: 'INVALID_STATE',
        message: `Reservation cannot be released because current status is ${current.status}.`,
        currentStatus: current.status,
      };
    }

    // Atomically restore reserved stock back to available stock
    const updatedInventory = await Inventory.findOneAndUpdate(
      { productId: reservation.productId },
      {
        $inc: {
          availableQuantity: reservation.quantity,
          reservedQuantity: -reservation.quantity,
          version: 1,
        },
      },
      { new: true }
    );

    return {
      success: true,
      reservation,
      inventory: updatedInventory,
    };
  }

  /**
   * Safely expire reservations that have exceeded their TTL.
   */
  static async expireReservation(reservationId) {
    const reservation = await InventoryReservation.findOneAndUpdate(
      {
        reservationId,
        status: 'PENDING',
      },
      {
        $set: {
          status: 'EXPIRED',
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!reservation) {
      return { success: false, reason: 'ALREADY_PROCESSED' };
    }

    await Inventory.updateOne(
      { productId: reservation.productId },
      {
        $inc: {
          availableQuantity: reservation.quantity,
          reservedQuantity: -reservation.quantity,
          version: 1,
        },
      }
    );

    return { success: true, reservation };
  }

  /**
   * Confirm a reservation upon successful payment.
   * Moves stock from reservedQuantity -> soldQuantity.
   */
  static async confirmReservation(reservationId) {
    const reservation = await InventoryReservation.findOneAndUpdate(
      {
        reservationId,
        status: 'PENDING',
      },
      {
        $set: {
          status: 'CONFIRMED',
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!reservation) {
      const current = await InventoryReservation.findOne({ reservationId });
      if (!current) throw new Error('Reservation not found');
      throw new Error(`Cannot confirm reservation with status ${current.status}`);
    }

    // Atomically convert reserved stock to sold stock
    const updatedInventory = await Inventory.findOneAndUpdate(
      { productId: reservation.productId },
      {
        $inc: {
          reservedQuantity: -reservation.quantity,
          soldQuantity: reservation.quantity,
          version: 1,
        },
      },
      { new: true }
    );

    return {
      success: true,
      reservation,
      inventory: updatedInventory,
    };
  }
}

import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';

let simulatedOutageUntil = 0;

export class OrderService {
  /**
   * Simulate a temporary Order Processing Service interruption for N seconds.
   */
  static triggerSimulatedOutage(seconds = 30) {
    simulatedOutageUntil = Date.now() + seconds * 1000;
    console.warn(`[OrderService] Simulated 30-second order processing interruption activated until ${new Date(simulatedOutageUntil).toISOString()}`);
    return {
      interrupted: true,
      resumeAt: new Date(simulatedOutageUntil).toISOString(),
    };
  }

  static isOutageActive() {
    return Date.now() < simulatedOutageUntil;
  }

  static clearOutage() {
    simulatedOutageUntil = 0;
  }

  /**
   * Create an order from a successful payment idempotently.
   */
  static async createOrderFromPayment({ paymentId, reservation, customerId, totalAmount }) {
    // 1. Check for temporary simulated service interruption
    if (this.isOutageActive()) {
      const remainingSeconds = Math.ceil((simulatedOutageUntil - Date.now()) / 1000);
      throw new Error(`Order Processing Service is temporarily unavailable (Simulated interruption: ${remainingSeconds}s remaining).`);
    }

    // 2. Strict Idempotency Check: Don't duplicate order for the same reservation
    const existingOrder = await Order.findOne({
      $or: [{ reservationId: reservation.reservationId }, { paymentId }],
    });

    if (existingOrder) {
      return existingOrder;
    }

    // 3. Resolve item details
    const product = await Product.findById(reservation.productId);
    const productName = product ? product.name : 'Flash Sale Product';

    const order = await Order.create({
      customerId,
      reservationId: reservation.reservationId,
      paymentId,
      items: [
        {
          productId: reservation.productId,
          name: productName,
          quantity: reservation.quantity,
          unitPrice: reservation.unitPrice,
          totalPrice: reservation.unitPrice * reservation.quantity,
        },
      ],
      subtotal: totalAmount,
      totalAmount,
      status: 'CONFIRMED',
    });

    console.log(`[OrderService] Order ${order.orderNumber} successfully generated for payment ${paymentId}.`);
    return order;
  }

  static async getOrdersByCustomer(customerId) {
    return Order.find({ customerId }).sort({ createdAt: -1 }).lean();
  }

  static async getOrderById(orderNumber, customerId, isAdmin = false) {
    const query = { orderNumber };
    if (!isAdmin) query.customerId = customerId;
    return Order.findOne(query).lean();
  }
}

import { OrderService } from '../services/order.service.js';
import { Order } from '../models/Order.js';

export async function getCustomerOrders(req, res, next) {
  try {
    const orders = await OrderService.getOrdersByCustomer(req.user._id);
    res.status(200).json({ count: orders.length, orders });
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req, res, next) {
  try {
    const order = await OrderService.getOrderById(
      req.params.orderId,
      req.user._id,
      req.user.role === 'ADMIN'
    );

    if (!order) {
      return res.status(404).json({ error: 'NotFound', message: 'Order not found.' });
    }

    res.status(200).json({ order });
  } catch (err) {
    next(err);
  }
}

export async function simulateOutage(req, res) {
  const { seconds = 30 } = req.body;
  const result = OrderService.triggerSimulatedOutage(Number(seconds));
  res.status(200).json({
    message: `Simulated order processing service outage initiated for ${seconds} seconds.`,
    ...result,
  });
}

export async function clearOutage(req, res) {
  OrderService.clearOutage();
  res.status(200).json({ message: 'Simulated order processing outage cleared. Service is online.' });
}

export async function getAdminOrders(req, res, next) {
  try {
    const { status, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      count: orders.length,
      orders,
    });
  } catch (err) {
    next(err);
  }
}

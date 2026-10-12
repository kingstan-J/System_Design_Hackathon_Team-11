import { Router } from 'express';
import { 
  getCustomerOrders, 
  getOrderById, 
  simulateOutage, 
  clearOutage,
  getAdminOrders 
} from '../controllers/order.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticateToken, getCustomerOrders);
router.get('/:orderId', authenticateToken, getOrderById);

// Simulated Outage and Resilience Controls
router.post('/simulate-outage', authenticateToken, requireRole('ADMIN'), simulateOutage);
router.post('/clear-outage', authenticateToken, requireRole('ADMIN'), clearOutage);

// Admin Order Management
router.get('/admin/all', authenticateToken, requireRole('ADMIN'), getAdminOrders);

export default router;

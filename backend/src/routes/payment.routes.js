import { Router } from 'express';
import { 
  processPayment, 
  getPaymentById, 
  reconcilePayment,
  getAdminPayments 
} from '../controllers/payment.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticateToken, processPayment);
router.get('/:paymentId', authenticateToken, getPaymentById);
router.post('/:paymentId/reconcile', authenticateToken, reconcilePayment);
router.get('/admin/all', authenticateToken, requireRole('ADMIN'), getAdminPayments);

export default router;

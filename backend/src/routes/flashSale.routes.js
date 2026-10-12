import { Router } from 'express';
import { 
  getFlashSales, 
  getFlashSaleById, 
  createFlashSale, 
  updateFlashSale 
} from '../controllers/flashSale.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';
import { validate, createFlashSaleSchema } from '../validators/product.validator.js';

const router = Router();

// Public Flash Sale APIs
router.get('/', getFlashSales);
router.get('/:id', getFlashSaleById);

// Admin Flash Sale Management APIs
router.post('/admin', authenticateToken, requireRole('ADMIN'), validate(createFlashSaleSchema), createFlashSale);
router.patch('/admin/:id', authenticateToken, requireRole('ADMIN'), updateFlashSale);

export default router;

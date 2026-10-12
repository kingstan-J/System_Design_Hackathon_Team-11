import { Router } from 'express';
import { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct 
} from '../controllers/product.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';
import { validate, createProductSchema, updateProductSchema } from '../validators/product.validator.js';

const router = Router();

// Public Product APIs
router.get('/', getProducts);
router.get('/:id', getProductById);

// Admin Product Management APIs
router.post('/admin', authenticateToken, requireRole('ADMIN'), validate(createProductSchema), createProduct);
router.patch('/admin/:id', authenticateToken, requireRole('ADMIN'), validate(updateProductSchema), updateProduct);
router.delete('/admin/:id', authenticateToken, requireRole('ADMIN'), deleteProduct);

export default router;

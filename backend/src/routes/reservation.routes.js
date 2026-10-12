import { Router } from 'express';
import { 
  createReservation, 
  getReservationById, 
  releaseReservation,
  getAdminReservations 
} from '../controllers/reservation.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Customer reservation endpoints
router.post('/', authenticateToken, createReservation);
router.get('/:reservationId', authenticateToken, getReservationById);
router.post('/:reservationId/release', authenticateToken, releaseReservation);

// Admin reservation monitoring endpoints
router.get('/admin/all', authenticateToken, requireRole('ADMIN'), getAdminReservations);

export default router;

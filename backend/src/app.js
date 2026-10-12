import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import flashSaleRoutes from './routes/flashSale.routes.js';
import reservationRoutes from './routes/reservation.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import orderRoutes from './routes/order.routes.js';
import { env } from './config/env.js';

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({
  origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Root informational endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'SALESTORM — AI-Assisted Flash Sale Management System API',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/api/health',
    readiness: '/api/ready',
    metrics: '/api/metrics',
  });
});

// Mount Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', flashSaleRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Endpoint ${req.method} ${req.originalUrl} does not exist.`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[SALESTORM Error Handler]', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred.',
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;

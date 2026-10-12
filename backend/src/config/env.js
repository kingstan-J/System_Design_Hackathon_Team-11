import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root or workspace root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/salestorm',

  // Cache & Queues
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  REDIS_ENABLED: process.env.REDIS_ENABLED === 'true',

  // Security
  JWT_SECRET: process.env.JWT_SECRET || 'salestorm_development_secret_key_syscrafters_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Flash Sale & Simulation Constants
  RESERVATION_TTL_SECONDS: parseInt(process.env.RESERVATION_TTL_SECONDS || '120', 10),
  DEFAULT_FLASH_SALE_STOCK: parseInt(process.env.DEFAULT_FLASH_SALE_STOCK || '100', 10),
  PAYMENT_SUCCESS_RATE: parseFloat(process.env.PAYMENT_SUCCESS_RATE || '0.95'),
  PAYMENT_FAILURE_RATE: parseFloat(process.env.PAYMENT_FAILURE_RATE || '0.05'),
  PAYMENT_SIMULATED_DELAY_MS: parseInt(process.env.PAYMENT_SIMULATED_DELAY_MS || '300', 10),
  ORDER_PROCESSING_DELAY_MS: parseInt(process.env.ORDER_PROCESSING_DELAY_MS || '0', 10),
  SIMULATE_ORDER_OUTAGE_SECONDS: parseInt(process.env.SIMULATE_ORDER_OUTAGE_SECONDS || '30', 10),

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  role: z.enum(['CUSTOMER', 'ADMIN']).optional().default('CUSTOMER'),
});

export const loginSchema = z.object({
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export { validate } from './validate.js';

import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(200),
  description: z.string().min(5, 'Product description is required'),
  category: z.string().min(2, 'Category is required'),
  price: z.number().nonnegative('Price must be non-negative'),
  flashSalePrice: z.number().nonnegative('Flash sale price must be non-negative').optional().nullable(),
  imageUrl: z.string().optional(),
  stock: z.number().int().nonnegative('Stock must be an integer non-negative number').default(100),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().min(5).optional(),
  category: z.string().min(2).optional(),
  price: z.number().nonnegative().optional(),
  flashSalePrice: z.number().nonnegative().optional().nullable(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createFlashSaleSchema = z.object({
  name: z.string().min(2, 'Flash sale name is required').max(150),
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid MongoDB ObjectId required'),
  startTime: z.string().datetime().or(z.date()),
  endTime: z.string().datetime().or(z.date()),
  flashSalePrice: z.number().nonnegative('Flash sale price must be non-negative'),
  configuredStock: z.number().int().positive('Configured stock must be greater than 0'),
});

export { validate } from './validate.js';

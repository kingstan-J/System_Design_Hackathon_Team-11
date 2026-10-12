import { z } from 'zod';

export function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'ValidationError',
          message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          details: err.errors,
        });
      }
      next(err);
    }
  };
}

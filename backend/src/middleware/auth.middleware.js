import { verifyToken } from '../utils/token.js';
import { User } from '../models/User.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is required. Please include Authorization: Bearer <token>',
    });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'InvalidToken',
      message: 'Token is invalid, expired, or malformed.',
    });
  }

  try {
    const user = await User.findById(payload.id).select('-passwordHash');
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User account not found or deactivated.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required prior to authorization check.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Forbidden: Endpoint requires one of roles [${roles.join(', ')}]. Current role: ${req.user.role}.`,
      });
    }

    next();
  };
}

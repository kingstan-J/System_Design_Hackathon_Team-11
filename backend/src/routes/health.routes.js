import { Router } from 'express';
import { getDBStatus } from '../config/db.js';
import { getRedisStatus } from '../config/redis.js';

const router = Router();
const startTime = Date.now();

// Liveness probe
router.get('/health', (req, res) => {
  const db = getDBStatus();
  const redis = getRedisStatus();

  res.status(200).json({
    status: 'healthy',
    system: 'SALESTORM Flash Sale Management System',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    database: db,
    redis: redis,
  });
});

// Readiness probe (checks that critical DB dependency is actually ready)
router.get('/ready', (req, res) => {
  const db = getDBStatus();
  const isReady = db.readyState === 1;

  if (isReady) {
    return res.status(200).json({
      status: 'ready',
      database: db,
    });
  }

  return res.status(503).json({
    status: 'not_ready',
    database: db,
    message: 'Authoritative MongoDB store is currently not connected.',
  });
});

// Basic system metrics endpoint
router.get('/metrics', (req, res) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
    },
    database: getDBStatus(),
    redis: getRedisStatus(),
  });
});

export default router;

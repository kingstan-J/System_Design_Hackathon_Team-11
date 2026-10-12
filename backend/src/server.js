import app from './app.js';
import { env } from './config/env.js';
import { connectDB, closeDB } from './config/db.js';
import { initRedis, closeRedis } from './config/redis.js';
import { startReservationExpiryWorker, stopReservationExpiryWorker } from './jobs/reservationExpiry.job.js';
import { startOutboxWorker, stopOutboxWorker } from './jobs/outboxRetry.job.js';

async function bootstrap() {
  console.log(`[SALESTORM] Starting server in ${env.NODE_ENV} mode...`);

  // Connect to authoritative persistence store
  try {
    await connectDB();
  } catch (err) {
    console.error('[SALESTORM] Failed to connect to MongoDB on startup. Halting.', err);
    process.exit(1);
  }

  // Initialize caching and background queue coordination
  initRedis();

  // Start background workers
  startReservationExpiryWorker(5000);
  startOutboxWorker(3000);

  const server = app.listen(env.PORT, () => {
    console.log(`[SALESTORM] Server actively listening at http://localhost:${env.PORT}`);
    console.log(`[SALESTORM] Health endpoint: http://localhost:${env.PORT}/api/health`);
    console.log(`[SALESTORM] Readiness endpoint: http://localhost:${env.PORT}/api/ready`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n[SALESTORM] Received ${signal}. Starting graceful shutdown...`);
    stopReservationExpiryWorker();
    stopOutboxWorker();
    server.close(async () => {
      console.log('[SALESTORM] HTTP server closed.');
      await closeRedis();
      await closeDB();
      console.log('[SALESTORM] All connections closed. Exiting process.');
      process.exit(0);
    });

    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      console.error('[SALESTORM] Forcing shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[SALESTORM] Fatal error during startup:', err);
  process.exit(1);
});

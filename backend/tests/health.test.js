import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, closeDB } from '../src/config/db.js';

describe('Phase 1 Foundation - Health & Database Tests', () => {
  before(async () => {
    await connectDB();
  });

  after(async () => {
    await closeDB();
  });

  test('GET / returns system information', async () => {
    const res = await request(app).get('/');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.version, '1.0.0');
    assert.ok(res.body.name.includes('SALESTORM'));
  });

  test('GET /api/health reports system healthy and DB connected', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'healthy');
    assert.strictEqual(res.body.database.state, 'connected');
    assert.strictEqual(res.body.database.readyState, 1);
  });

  test('GET /api/ready confirms authoritative store readiness', async () => {
    const res = await request(app).get('/api/ready');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ready');
    assert.strictEqual(res.body.database.readyState, 1);
  });

  test('GET /api/metrics returns valid memory and system statistics', async () => {
    const res = await request(app).get('/api/metrics');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.uptimeSeconds === 'number');
    assert.ok(typeof res.body.memory.heapUsedMb === 'number');
  });
});

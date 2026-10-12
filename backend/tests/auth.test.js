import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, closeDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';

describe('Phase 2 - Authentication & RBAC Tests', () => {
  before(async () => {
    await connectDB();
  });

  after(async () => {
    await closeDB();
  });

  test('POST /api/auth/register creates a customer and returns a JWT', async () => {
    const testEmail = `test_${Date.now()}@salestorm.io`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Jordan Lee',
        email: testEmail,
        password: 'Password@123',
        role: 'CUSTOMER',
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.email, testEmail);
    assert.strictEqual(res.body.user.role, 'CUSTOMER');
    assert.strictEqual(res.body.user.passwordHash, undefined);

    // Verify in MongoDB
    const doc = await User.findOne({ email: testEmail });
    assert.ok(doc);
    assert.notStrictEqual(doc.passwordHash, 'Password@123'); // Must be hashed!
  });

  test('POST /api/auth/register rejects duplicate email with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Duplicate Check',
        email: 'customer@salestorm.io', // Seeded email
        password: 'Password@123',
      });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error, 'Conflict');
  });

  test('POST /api/auth/login succeeds with valid credentials and returns JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'customer@salestorm.io',
        password: 'Customer@123',
      });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, 'CUSTOMER');
  });

  test('POST /api/auth/login rejects wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'customer@salestorm.io',
        password: 'WrongPassword',
      });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'InvalidCredentials');
  });

  test('GET /api/auth/me returns user profile when authorized', async () => {
    // 1. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'customer@salestorm.io',
        password: 'Customer@123',
      });

    const token = loginRes.body.token;

    // 2. Fetch /me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.user.email, 'customer@salestorm.io');
    assert.strictEqual(meRes.body.user.passwordHash, undefined);
  });

  test('GET /api/auth/me rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Unauthorized');
  });
});

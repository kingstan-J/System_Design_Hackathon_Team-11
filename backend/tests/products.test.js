import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, closeDB } from '../src/config/db.js';
import { Inventory } from '../src/models/Inventory.js';

describe('Phase 2 - Products, Inventory & Flash Sale Tests', () => {
  let adminToken = '';
  let customerToken = '';

  before(async () => {
    await connectDB();

    // Acquire tokens for both roles
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@salestorm.io', password: 'Admin@123' });
    adminToken = adminLogin.body.token;

    const customerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@salestorm.io', password: 'Customer@123' });
    customerToken = customerLogin.body.token;
  });

  after(async () => {
    await closeDB();
  });

  test('GET /api/products returns products list with enriched inventory', async () => {
    const res = await request(app).get('/api/products');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.products));
    assert.ok(res.body.products.length >= 1);

    const flagship = res.body.products.find((p) => p.name === 'Quantum HyperPhone 15 Pro');
    assert.ok(flagship, 'Flash sale flagship product must exist');
    assert.strictEqual(flagship.inventory.total, 100);
    assert.strictEqual(
      flagship.inventory.total,
      flagship.inventory.available + flagship.inventory.reserved + flagship.inventory.sold,
      'Inventory invariant must hold'
    );
    assert.ok(flagship.flashSale, 'Flagship must have flash sale metadata attached');
    assert.strictEqual(flagship.flashSale.flashSalePrice, 499.99);
  });

  test('GET /api/sales returns active flash sales', async () => {
    const res = await request(app).get('/api/sales');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.sales.length >= 1);
    const sale = res.body.sales[0];
    assert.strictEqual(sale.configuredStock, 100);
    assert.ok(sale.computedStatus === 'ACTIVE' || sale.computedStatus === 'SCHEDULED');
  });

  test('POST /api/products/admin creates new product and initializes inventory when ADMIN', async () => {
    const res = await request(app)
      .post('/api/products/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'HoloLens VR CyberGoggles',
        description: 'Next-gen spatial compute goggles with micro-OLED 8K panels.',
        category: 'VR',
        price: 899.99,
        stock: 50,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.product.name, 'HoloLens VR CyberGoggles');
    assert.strictEqual(res.body.inventory.totalQuantity, 50);
    assert.strictEqual(res.body.inventory.availableQuantity, 50);

    // Verify inventory invariant in MongoDB
    const inv = await Inventory.findOne({ productId: res.body.product._id });
    assert.ok(inv);
    assert.strictEqual(inv.totalQuantity, inv.availableQuantity + inv.reservedQuantity + inv.soldQuantity);
  });

  test('POST /api/products/admin rejects CUSTOMER with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/products/admin')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Hacker Injected Product',
        description: 'Attempting to bypass RBAC.',
        category: 'Exploit',
        price: 1.0,
        stock: 1000,
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'Forbidden');
  });
});

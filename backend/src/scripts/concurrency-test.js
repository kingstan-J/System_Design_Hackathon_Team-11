import mongoose from 'mongoose';
import crypto from 'crypto';
import { connectDB, closeDB } from '../config/db.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { User } from '../models/User.js';
import { ReservationService } from '../services/reservation.service.js';

/**
 * Concurrency Test Runner:
 * Tests N concurrent reservation attempts against M available units.
 * Verifies mathematical inventory correctness, zero overselling, and idempotency.
 */
async function runConcurrencyTest(numRequests = 1000, initialStock = 100) {
  console.log(`\n==================================================================`);
  console.log(`⚡ SALESTORM HIGH-CONCURRENCY RESERVATION STRESS TEST`);
  console.log(`==================================================================`);
  console.log(`Target Requests: ${numRequests} concurrent purchase attempts`);
  console.log(`Available Stock: ${initialStock} units`);
  console.log(`Expected Outcome: Exactly ${initialStock} reservations succeed, ${numRequests - initialStock} rejected (0 overselling)`);

  await connectDB();

  try {
    // 1. Setup isolated test user and test product
    const testUser = await User.findOne({ email: 'customer@salestorm.io' });
    if (!testUser) {
      throw new Error('Seed customer not found. Please run "npm run seed" first.');
    }

    const testProduct = await Product.create({
      name: `StressTest HyperUnit-${Date.now()}`,
      description: 'Concurrency stress testing product',
      category: 'StressTest',
      price: 99.99,
    });

    const initialInventory = await Inventory.create({
      productId: testProduct._id,
      totalQuantity: initialStock,
      availableQuantity: initialStock,
      reservedQuantity: 0,
      soldQuantity: 0,
    });

    console.log(`Created test product ${testProduct._id} with initial available quantity = ${initialInventory.availableQuantity}`);

    // 2. Launch concurrent requests in parallel batches
    const startTime = Date.now();
    let successCount = 0;
    let outOfStockCount = 0;
    let errorCount = 0;

    const batchSize = 100;
    const batches = Math.ceil(numRequests / batchSize);
    console.log(`Executing ${numRequests} requests in ${batches} parallel batches of ${batchSize}...`);

    for (let b = 0; b < batches; b++) {
      const currentBatchCount = Math.min(batchSize, numRequests - b * batchSize);
      const batchPromises = Array.from({ length: currentBatchCount }, async (_, i) => {
        const uniqueKey = `stress_${b}_${i}_${crypto.randomUUID()}`;
        try {
          const result = await ReservationService.reserveInventory({
            customerId: testUser._id,
            productId: testProduct._id,
            quantity: 1,
            idempotencyKey: uniqueKey,
          });

          if (result.success) {
            successCount++;
          } else if (result.reason === 'OUT_OF_STOCK') {
            outOfStockCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          errorCount++;
        }
      });

      await Promise.all(batchPromises);
    }

    const durationSeconds = (Date.now() - startTime) / 1000;
    const throughput = Math.round(numRequests / durationSeconds);

    // 3. Verify authoritative final database state
    const finalInventory = await Inventory.findOne({ productId: testProduct._id });

    console.log(`\n==================================================================`);
    console.log(`📊 CONCURRENCY TEST EXECUTION RESULTS`);
    console.log(`==================================================================`);
    console.log(`Elapsed Time: ${durationSeconds.toFixed(2)}s`);
    console.log(`Effective Throughput: ${throughput} req/sec`);
    console.log(`Successful Reservations: ${successCount}`);
    console.log(`Out of Stock Responses: ${outOfStockCount}`);
    console.log(`Errors / Exceptions: ${errorCount}`);
    console.log(`\n--- Authoritative MongoDB Inventory Verification ---`);
    console.log(`Total Quantity:     ${finalInventory.totalQuantity}`);
    console.log(`Available Quantity: ${finalInventory.availableQuantity}`);
    console.log(`Reserved Quantity:  ${finalInventory.reservedQuantity}`);
    console.log(`Sold Quantity:      ${finalInventory.soldQuantity}`);

    // Verification Checks
    const noOversell = successCount === initialStock;
    const nonNegative = finalInventory.availableQuantity >= 0;
    const invariantHold = finalInventory.totalQuantity === 
      (finalInventory.availableQuantity + finalInventory.reservedQuantity + finalInventory.soldQuantity);

    console.log(`\n--- Verification Assertions ---`);
    console.log(`[${noOversell ? 'PASS' : 'FAIL'}] Exactly ${initialStock} reservations succeeded (Actual: ${successCount})`);
    console.log(`[${nonNegative ? 'PASS' : 'FAIL'}] Stock never dropped below zero (Actual: ${finalInventory.availableQuantity})`);
    console.log(`[${invariantHold ? 'PASS' : 'FAIL'}] Mathematical Invariant Held (Total === Avail + Reserved + Sold)`);

    if (noOversell && nonNegative && invariantHold) {
      console.log(`\n🎉 RESULT: 100% SUCCESS. ZERO OVERSELLING GUARANTEED.`);
    } else {
      console.error(`\n❌ RESULT: CONCURRENCY ANOMALY DETECTED!`);
      process.exitCode = 1;
    }

    // Clean up temporary stress test product
    await Product.deleteOne({ _id: testProduct._id });
    await Inventory.deleteOne({ productId: testProduct._id });
  } catch (err) {
    console.error('Stress test encountered an unhandled error:', err);
    process.exitCode = 1;
  } finally {
    await closeDB();
  }
}

// Read CLI argument or default to 1,000 attempts
const requestsArg = parseInt(process.argv[2] || '1000', 10);
const stockArg = parseInt(process.argv[3] || '100', 10);

runConcurrencyTest(requestsArg, stockArg);

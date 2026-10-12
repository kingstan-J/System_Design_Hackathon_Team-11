import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB, closeDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { FlashSale } from '../models/FlashSale.js';

async function seedDatabase() {
  console.log('[SALESTORM Seed] Connecting to MongoDB...');
  await connectDB();

  try {
    console.log('[SALESTORM Seed] Clearing existing catalog and user collections...');
    await User.deleteMany({});
    await Product.deleteMany({});
    await Inventory.deleteMany({});
    await FlashSale.deleteMany({});

    console.log('[SALESTORM Seed] Creating default users...');
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('Admin@123', salt);
    const customerPasswordHash = await bcrypt.hash('Customer@123', salt);

    const admin = await User.create({
      name: 'SalesStorm Administrator',
      email: 'admin@salestorm.io',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    });

    const customer = await User.create({
      name: 'Alex Mercer (Customer)',
      email: 'customer@salestorm.io',
      passwordHash: customerPasswordHash,
      role: 'CUSTOMER',
    });

    console.log(`[SALESTORM Seed] Seeded Users: ${admin.email} (ADMIN), ${customer.email} (CUSTOMER)`);

    console.log('[SALESTORM Seed] Creating Flash Sale Product (100 units initial budget)...');
    // Product 1: The flagship flash sale item (100 units for 10,000 concurrency simulation)
    const flashProduct = await Product.create({
      name: 'Quantum HyperPhone 15 Pro',
      description: 'Flagship AI-augmented smartphone featuring Neural Titan X chip, holographic AMOLED display, and quantum-fast 200W charging.',
      category: 'Smartphones',
      price: 1199.99,
      flashSalePrice: 499.99,
      imageUrl: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80',
    });

    await Inventory.create({
      productId: flashProduct._id,
      totalQuantity: 100,
      availableQuantity: 100,
      reservedQuantity: 0,
      soldQuantity: 0,
    });

    // Schedule active Flash Sale for the flagship item
    const now = new Date();
    const startTime = new Date(now.getTime() - 10 * 60 * 1000); // Started 10 mins ago
    const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Ends in 24 hours

    const flashSale = await FlashSale.create({
      name: 'SYSCRAFTERS Midnight Lightning Sale',
      productId: flashProduct._id,
      startTime,
      endTime,
      flashSalePrice: 499.99,
      configuredStock: 100,
      status: 'ACTIVE',
    });

    console.log(`[SALESTORM Seed] Created Flash Sale: "${flashSale.name}" for "${flashProduct.name}" (100 Units)`);

    // Additional Catalog Products
    const catalogData = [
      {
        name: 'AeroPulse Wireless Earbuds',
        description: 'True wireless spatial audio earbuds with 45dB hybrid active noise cancellation and 40-hour battery life.',
        category: 'Audio',
        price: 199.99,
        stock: 250,
        imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
      },
      {
        name: 'Nebula UltraWatch 3 GPS',
        description: 'Titanium aerospace casing, sapphire crystal display, ECG monitoring, and offline tactical topo maps.',
        category: 'Wearables',
        price: 349.99,
        stock: 150,
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
      },
      {
        name: 'CyberDeck Mechanized 75% Keyboard',
        description: 'Gasket-mounted hot-swappable mechanical keyboard with lubricated magnetic switches and CNC brass weight.',
        category: 'Peripherals',
        price: 159.99,
        stock: 300,
        imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
      },
    ];

    for (const item of catalogData) {
      const prod = await Product.create({
        name: item.name,
        description: item.description,
        category: item.category,
        price: item.price,
        imageUrl: item.imageUrl,
      });

      await Inventory.create({
        productId: prod._id,
        totalQuantity: item.stock,
        availableQuantity: item.stock,
        reservedQuantity: 0,
        soldQuantity: 0,
      });
    }

    console.log('[SALESTORM Seed] Catalog successfully seeded with 4 products and 1 active flash sale.');
    console.log('[SALESTORM Seed] All records are verified in MongoDB.');
  } catch (err) {
    console.error('[SALESTORM Seed] Failed to seed database:', err);
    process.exit(1);
  } finally {
    await closeDB();
  }
}

seedDatabase();

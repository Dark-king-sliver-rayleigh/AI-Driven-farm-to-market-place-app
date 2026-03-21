const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');

// Models
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');
const MarketPrice = require('../models/MarketPrice');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * ─── SEED DATA SCRIPT ───
 *
 * Uses EXISTING users (farmer, consumer, logistics) and EXISTING products.
 * Prices in seed orders are always BELOW the market insight (mandi) price
 * to simulate realistic platform-vs-mandi comparison.
 *
 * Also creates two new logistics drivers: Jack and Davos.
 *
 * Run:  node server/scripts/seedData.js
 */

const PICKUP_LOCATION = {
  address: 'Nashik Farm Hub, Maharashtra',
  coordinates: { lat: 19.9975, lng: 73.7898 }
};

const DROP_LOCATION = {
  address: 'Pune City Market',
  coordinates: { lat: 18.5204, lng: 73.8567 }
};

async function seedData() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected.\n');

    console.log('🧹 Clearing old seed data...');
    const seedOrderIds = (await Order.find({ 'paymentStatus': 'PAID', 'lastUpdatedByRole': 'SYSTEM' })
      .select('_id')).map(o => o._id);
    // Only delete deliveries + orders that carry the SEED marker
    await Delivery.deleteMany({ orderId: { $in: seedOrderIds } });
    await Order.deleteMany({ _id: { $in: seedOrderIds } });
    console.log(`   Removed ${seedOrderIds.length} old seed orders.\n`);

    // ──────────────────────────────────────────────────────
    // STEP 1: Create Jack & Davos logistics drivers
    // ──────────────────────────────────────────────────────
    console.log('👥 Creating logistics drivers (Jack & Davos)...');

    let jack = await User.findOne({ name: 'Jack' });
    if (!jack) {
      jack = await User.create({
        name: 'Jack',
        phone: '70000' + String(Math.floor(10000 + Math.random() * 89999)),
        password: 'jack123',       // pre-save hook hashes it
        role: 'LOGISTICS',
        vehicleType: 'VAN',
        vehicleNumber: 'MH-12-JK-1234',
        loadCapacity: 500,
        serviceArea: 'Pune – Nashik',
        isAvailable: true,
        location: { address: 'Pune Hub', coordinates: { lat: 18.52, lng: 73.85 } }
      });
      console.log(`   ✅ Jack created  — Phone: ${jack.phone}  Password: jack123`);
    } else {
      console.log(`   ⏩ Jack already exists — Phone: ${jack.phone}`);
    }

    let davos = await User.findOne({ name: 'Davos' });
    if (!davos) {
      davos = await User.create({
        name: 'Davos',
        phone: '80000' + String(Math.floor(10000 + Math.random() * 89999)),
        password: 'davos123',      // pre-save hook hashes it
        role: 'LOGISTICS',
        vehicleType: 'TRUCK',
        vehicleNumber: 'MH-14-DV-5678',
        loadCapacity: 1000,
        serviceArea: 'Mumbai – Nagpur',
        isAvailable: true,
        location: { address: 'Mumbai Depot', coordinates: { lat: 19.07, lng: 72.87 } }
      });
      console.log(`   ✅ Davos created — Phone: ${davos.phone}  Password: davos123`);
    } else {
      console.log(`   ⏩ Davos already exists — Phone: ${davos.phone}`);
    }

    console.log('\n═══════════════════════════════════════');
    console.log('  DRIVER CREDENTIALS');
    console.log('───────────────────────────────────────');
    console.log(`  Jack  — Phone: ${jack.phone}  | Password: jack123`);
    console.log(`  Davos — Phone: ${davos.phone} | Password: davos123`);
    console.log('═══════════════════════════════════════\n');

    // ──────────────────────────────────────────────────────
    // STEP 2: Find EXISTING farmers, consumers & products
    // ──────────────────────────────────────────────────────
    console.log('🔍 Looking up existing users & products...');

    const farmers = await User.find({ role: 'FARMER' }).limit(5);
    const consumers = await User.find({ role: 'CONSUMER' }).limit(5);
    const drivers = await User.find({ role: 'LOGISTICS' });
    const existingProducts = await Product.find({ isDeleted: false }).limit(20);

    if (farmers.length === 0) {
      console.error('❌ No FARMER users found. Please register at least one farmer first.');
      process.exit(1);
    }
    if (consumers.length === 0) {
      console.error('❌ No CONSUMER users found. Please register at least one consumer first.');
      process.exit(1);
    }
    if (existingProducts.length === 0) {
      console.error('❌ No products found. Please add at least one product first.');
      process.exit(1);
    }

    console.log(`   Farmers: ${farmers.length}, Consumers: ${consumers.length}, Products: ${existingProducts.length}, Drivers: ${drivers.length}\n`);

    // ──────────────────────────────────────────────────────
    // STEP 3: Get mandi prices for each product so seed
    //         order prices are BELOW market price
    // ──────────────────────────────────────────────────────
    console.log('📊 Fetching market (mandi) reference prices...');

    // Build a map:  lowercase product_name → mandi modal price
    const mandiPriceMap = {};
    for (const product of existingProducts) {
      const latestMandi = await MarketPrice.findOne({
        commodity: { $regex: new RegExp(product.name.split(' ')[0], 'i') }
      }).sort({ date: -1 });

      if (latestMandi) {
        // Use modal price (most representative market price, Rs/Quintal)
        // Convert to per-unit if product is in kg: modal / 100
        let referencePrice = latestMandi.modalPrice;
        if (product.unit === 'kg') {
          referencePrice = referencePrice / 100;  // Rs/Quintal → Rs/kg
        }
        mandiPriceMap[product._id.toString()] = referencePrice;
        console.log(`   ${product.name} (${product.unit}): Mandi ₹${referencePrice.toFixed(2)} → seed price will be below this`);
      } else {
        // No mandi data; use product's own price as ceiling
        mandiPriceMap[product._id.toString()] = product.price;
        console.log(`   ${product.name}: No mandi data, using product price ₹${product.price} as ceiling`);
      }
    }

    // ──────────────────────────────────────────────────────
    // STEP 4: Generate 150 DELIVERED orders (past 180 days)
    // ──────────────────────────────────────────────────────
    console.log('\n📜 Generating 150 historical DELIVERED orders...');
    const deliveries = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 180);

    for (let i = 0; i < 150; i++) {
      // Random date
      const orderDate = new Date(
        startDate.getTime() + Math.random() * (Date.now() - startDate.getTime())
      );

      // Pick random existing entities
      const product = existingProducts[Math.floor(Math.random() * existingProducts.length)];
      const farmer = farmers.find(f => f._id.toString() === product.farmerId?.toString()) || farmers[0];
      const consumer = consumers[Math.floor(Math.random() * consumers.length)];
      const driver = drivers[Math.floor(Math.random() * drivers.length)];

      // Price must be BELOW mandi price (5-15% discount)
      const ceiling = mandiPriceMap[product._id.toString()] || product.price;
      const discountPct = 0.05 + Math.random() * 0.10;        // 5-15 % below market
      const seedPrice = parseFloat((ceiling * (1 - discountPct)).toFixed(2));

      const qty = Math.floor(Math.random() * 50) + 5;

      const order = await Order.create({
        consumerId: consumer._id,
        farmerId: farmer._id,
        items: [{
          productId: product._id,
          quantity: qty,
          price: seedPrice
        }],
        totalAmount: parseFloat((seedPrice * qty).toFixed(2)),
        orderStatus: 'DELIVERED',
        paymentMode: 'ONLINE',
        paymentStatus: 'PAID',
        lastUpdatedByRole: 'SYSTEM',     // Marker so we can clean up later
        deliveryAddress: DROP_LOCATION,
        pickupLocation: PICKUP_LOCATION,
        createdAt: orderDate,
        updatedAt: orderDate
      });

      // Delivery record for KPIs — 80 % on-time, 20 % delayed
      const isDelayed = Math.random() > 0.8;
      const deliveryTime = new Date(orderDate);
      const expectedTime = new Date(orderDate);
      if (isDelayed) {
        expectedTime.setHours(expectedTime.getHours() - 4);
      } else {
        expectedTime.setHours(expectedTime.getHours() + 1);
      }

      deliveries.push({
        orderId: order._id,
        driverId: driver._id,
        pickupLocation: PICKUP_LOCATION,
        dropLocation: DROP_LOCATION,
        deliveryStatus: 'DELIVERED',
        distance: Math.floor(Math.random() * 50) + 5,
        expectedDeliveryTime: expectedTime,
        isDelayed,
        lastUpdatedByRole: 'SYSTEM',
        createdAt: new Date(orderDate.getTime() - 86400000),
        updatedAt: deliveryTime
      });
    }

    await Delivery.insertMany(deliveries);
    console.log('   ✅ 150 delivered orders + delivery records created.');

    // ──────────────────────────────────────────────────────
    // STEP 5: Generate 10 ACTIVE orders (for route planning)
    // ──────────────────────────────────────────────────────
    console.log('🚚 Generating 10 active orders for route planning...');
    for (let i = 0; i < 10; i++) {
      const product = existingProducts[Math.floor(Math.random() * existingProducts.length)];
      const farmer = farmers.find(f => f._id.toString() === product.farmerId?.toString()) || farmers[0];
      const consumer = consumers[Math.floor(Math.random() * consumers.length)];

      const ceiling = mandiPriceMap[product._id.toString()] || product.price;
      const seedPrice = parseFloat((ceiling * 0.90).toFixed(2)); // 10% below market

      await Order.create({
        consumerId: consumer._id,
        farmerId: farmer._id,
        items: [{
          productId: product._id,
          quantity: 20,
          price: seedPrice
        }],
        totalAmount: seedPrice * 20,
        orderStatus: 'CREATED',
        paymentMode: 'COD',
        paymentStatus: 'PENDING',
        lastUpdatedByRole: 'SYSTEM',
        deliveryAddress: DROP_LOCATION,
        pickupLocation: PICKUP_LOCATION,
        createdAt: new Date()
      });
    }
    console.log('   ✅ 10 active orders created.\n');

    // ──────────────────────────────────────────────────────
    // DONE
    // ──────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════');
    console.log('  ✨ SEEDING COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log('  → Platform Prices: 150 delivered orders');
    console.log('  → Logistics KPIs:  150 delivery records');
    console.log('  → Route Planning:  10 active orders');
    console.log('  → New Drivers:     Jack & Davos');
    console.log('  → All seed prices are BELOW mandi prices');
    console.log('═══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedData();

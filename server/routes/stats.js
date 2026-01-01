const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');

/**
 * @desc    Get system statistics
 * @route   GET /system/stats
 * @access  Public (can be protected if needed)
 */
router.get('/stats', async (req, res) => {
  try {
    // User stats by role
    const userStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    const users = userStats.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, { FARMER: 0, CONSUMER: 0, LOGISTICS: 0 });

    // Product stats
    const totalProducts = await Product.countDocuments();
    const productsByStatus = await Product.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const productsStatus = productsByStatus.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    // Order stats
    const totalOrders = await Order.countDocuments();
    const ordersByStatus = await Order.aggregate([
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
    ]);
    const ordersStatus = ordersByStatus.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    // Delivery stats
    const totalDeliveries = await Delivery.countDocuments();
    const completedDeliveries = await Delivery.countDocuments({ deliveryStatus: 'DELIVERED' });
    const failedDeliveries = await Delivery.countDocuments({ deliveryStatus: 'FAILED' });
    const activeDeliveries = await Delivery.countDocuments({
      deliveryStatus: { $nin: ['DELIVERED', 'FAILED'] }
    });

    res.json({
      success: true,
      stats: {
        users: {
          total: Object.values(users).reduce((a, b) => a + b, 0),
          byRole: users
        },
        products: {
          total: totalProducts,
          byStatus: productsStatus
        },
        orders: {
          total: totalOrders,
          byStatus: ordersStatus
        },
        deliveries: {
          total: totalDeliveries,
          completed: completedDeliveries,
          failed: failedDeliveries,
          active: activeDeliveries
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error fetching system stats'
      }
    });
  }
});

/**
 * @desc    Health check with database status
 * @route   GET /system/health
 * @access  Public
 */
router.get('/health', async (req, res) => {
  const mongoose = require('mongoose');
  
  res.json({
    success: true,
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

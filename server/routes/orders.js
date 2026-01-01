const express = require('express');
const router = express.Router();
const {
  createOrder,
  getConsumerOrders,
  getFarmerOrders,
  getOrderById,
  cancelOrder
} = require('../controllers/orderController');
const {
  getAvailableProducts,
  getProductById
} = require('../controllers/productController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');

// All routes require authentication
router.use(authenticateUser);

// Product routes (for consumers browsing)
router.get('/products', authorizeRoles('CONSUMER', 'FARMER'), getAvailableProducts);
router.get('/products/:id', authorizeRoles('CONSUMER', 'FARMER'), getProductById);

// Consumer order routes
router.post('/orders', authorizeRoles('CONSUMER'), createOrder);
router.get('/consumer/orders', authorizeRoles('CONSUMER'), getConsumerOrders);
router.delete('/consumer/orders/:orderId', authorizeRoles('CONSUMER'), cancelOrder);

// Farmer order routes
router.get('/farmer/orders', authorizeRoles('FARMER'), getFarmerOrders);

// Generic order route (accessible by consumer, farmer, logistics)
router.get('/orders/:id', getOrderById);

/**
 * @desc    Get read-only delivery timeline for an order
 * @route   GET /api/orders/:id/timeline
 * @access  Private (CONSUMER, FARMER - parties to the order)
 * 
 * READ-ONLY ACCESS:
 * - Consumers can view timeline for their orders
 * - Farmers can view timeline for orders of their products
 * - No modification of events is possible
 */
router.get('/orders/:id/timeline', authorizeRoles('CONSUMER', 'FARMER'), async (req, res) => {
  try {
    const { id: orderId } = req.params;
    
    // Find order to verify access
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Verify user is party to the order
    const userId = req.user._id.toString();
    const isConsumer = order.consumerId.toString() === userId;
    const isFarmer = order.farmerId.toString() === userId;
    
    if (!isConsumer && !isFarmer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this delivery timeline'
      });
    }
    
    // Find delivery
    const delivery = await Delivery.findOne({ orderId })
      .select('deliveryStatus deliveryEvents expectedDeliveryTime isDelayed createdAt');
    
    if (!delivery) {
      return res.status(200).json({
        success: true,
        message: 'No delivery assigned yet',
        timeline: [],
        orderStatus: order.orderStatus
      });
    }
    
    // Return read-only timeline
    res.status(200).json({
      success: true,
      orderId: order._id,
      deliveryStatus: delivery.deliveryStatus,
      expectedDeliveryTime: delivery.expectedDeliveryTime,
      isDelayed: delivery.isDelayed,
      timeline: delivery.deliveryEvents.map(event => ({
        eventType: event.eventType,
        status: event.toStatus || event.fromStatus,
        timestamp: event.timestamp,
        remarks: event.remarks
      }))
    });
    
  } catch (error) {
    console.error('Get delivery timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching delivery timeline'
    });
  }
});

module.exports = router;

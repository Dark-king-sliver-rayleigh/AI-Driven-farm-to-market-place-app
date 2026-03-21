const Order = require('../models/Order');
const Product = require('../models/Product');
const Delivery = require('../models/Delivery');
const Notification = require('../models/Notification');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * @desc    Create a new order
 * @route   POST /api/orders
 * @access  Private (CONSUMER only)
 * 
 * Note: This implementation works without MongoDB transactions
 * For production with replica sets, transactions can be added back
 */
const createOrder = async (req, res) => {
  try {
    const { items, paymentMode, deliveryAddress, deliveryLocation } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must have at least one item'
      });
    }

    if (!paymentMode || !['COD', 'ONLINE'].includes(paymentMode)) {
      return res.status(400).json({
        success: false,
        message: 'Payment mode must be COD or ONLINE'
      });
    }

    // Validate products and calculate total
    let totalAmount = 0;
    let farmerId = null;
    const orderItems = [];
    let hasPreOrderItems = false; // Track if any item is a pre-order
    const productsToUpdate = []; // Track products that need quantity updates
    let fallbackPickupLocation = null;

    // Allowed statuses for ordering
    // AVAILABLE: Regular order, immediate delivery
    // NOT_HARVESTED: Pre-order, will be delivered after harvest
    // PRE_ORDER: Explicitly marked as pre-order by farmer
    const orderableStatuses = ['AVAILABLE', 'NOT_HARVESTED', 'PRE_ORDER'];

    for (const item of items) {
      // Exclude deleted products
      const product = await Product.findOne({ 
        _id: item.productId, 
        isDeleted: { $ne: true } 
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      // Check if product status allows ordering
      if (!orderableStatuses.includes(product.status)) {
        return res.status(400).json({
          success: false,
          message: `Product '${product.name}' cannot be ordered (status: ${product.status}). Only AVAILABLE, NOT_HARVESTED, and PRE_ORDER products can be ordered.`
        });
      }

      // Track pre-order status
      if (product.status === 'NOT_HARVESTED' || product.status === 'PRE_ORDER') {
        hasPreOrderItems = true;
      }

      // Only check quantity for AVAILABLE products (pre-order products may not have final quantity)
      if (product.status === 'AVAILABLE' && product.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient quantity for '${product.name}'. Available: ${product.quantity}, Requested: ${item.quantity}`
        });
      }

      // Ensure all items are from the same farmer
      if (farmerId === null) {
        farmerId = product.farmerId;
      } else if (product.farmerId.toString() !== farmerId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'All items in an order must be from the same farmer'
        });
      }

      // Calculate item total
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        productId: product._id,
        quantity: item.quantity,
        price: product.price
      });

      if (!fallbackPickupLocation && product.pickupLocation?.address) {
        fallbackPickupLocation = {
          label: 'Product Pickup',
          address: product.pickupLocation.address,
          coordinates: product.pickupLocation.coordinates
        };
      }

      // Track products that need quantity updates (only AVAILABLE products)
      if (product.status === 'AVAILABLE') {
        productsToUpdate.push({
          productId: product._id,
          quantityToDeduct: item.quantity
        });
      }
    }

    // Atomic quantity reduction using $inc to prevent race conditions
    for (const { productId, quantityToDeduct } of productsToUpdate) {
      const result = await Product.findOneAndUpdate(
        { 
          _id: productId, 
          quantity: { $gte: quantityToDeduct }  // Ensure sufficient quantity
        },
        { $inc: { quantity: -quantityToDeduct } },
        { new: true }
      );
      
      if (!result) {
        // Race condition detected - quantity is no longer sufficient
        return res.status(400).json({
          success: false,
          message: 'Product quantity changed. Please refresh and try again.'
        });
      }
    }

    // Create order - mark as PRE_ORDER if any items are pre-order
    const orderStatus = hasPreOrderItems ? 'PRE_ORDER' : 'CREATED';
    
    // Get farmer's default pickup location
    const farmerUser = await User.findById(farmerId).select('pickupLocations location');
    const defaultPickup = farmerUser?.pickupLocations?.find(l => l.isDefault) || 
                          farmerUser?.pickupLocations?.[0] || null;
    
    // Get consumer's delivery address (from request or saved default)
    let orderDeliveryAddress = deliveryAddress || deliveryLocation || null;
    if (!orderDeliveryAddress) {
      const consumerUser = await User.findById(req.user._id).select('deliveryAddresses location');
      const defaultAddr = consumerUser?.deliveryAddresses?.find(a => a.isDefault) ||
                          consumerUser?.deliveryAddresses?.[0] || null;
      if (defaultAddr) {
        orderDeliveryAddress = {
          label: defaultAddr.label,
          address: defaultAddr.address,
          coordinates: defaultAddr.coordinates
        };
      }
    }
    
    const order = await Order.create({
      consumerId: req.user._id,
      farmerId,
      items: orderItems,
      totalAmount,
      paymentMode,
      orderStatus,
      deliveryAddress: orderDeliveryAddress,
      pickupLocation: defaultPickup ? {
        label: defaultPickup.label,
        address: defaultPickup.address,
        coordinates: defaultPickup.coordinates
      } : fallbackPickupLocation
    });

    // Notify farmer of new order
    try {
      await Notification.create({
        userId: farmerId,
        role: 'FARMER',
        type: 'ORDER_PLACED',
        message: `New order received! Order #${order._id.toString().slice(-8).toUpperCase()} for ₹${totalAmount}`,
        relatedEntityId: order._id,
        relatedEntityType: 'Order'
      });
    } catch (notifError) {
      console.error('Notification error (non-blocking):', notifError);
    }

    // Populate and return
    const populatedOrder = await Order.findById(order._id)
      .populate('farmerId', 'name phone')
      .populate('items.productId', 'name unit');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: populatedOrder
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating order'
    });
  }
};

/**
 * @desc    Get all orders for logged-in consumer
 * @route   GET /api/consumer/orders
 * @access  Private (CONSUMER only)
 */
const getConsumerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ consumerId: req.user._id })
      .populate('farmerId', 'name phone')
      .populate('items.productId', 'name unit')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('Get consumer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders'
    });
  }
};

/**
 * @desc    Get all orders for logged-in farmer
 * @route   GET /api/farmer/orders
 * @access  Private (FARMER only)
 */
const getFarmerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ farmerId: req.user._id })
      .populate('consumerId', 'name phone')
      .populate('items.productId', 'name unit')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('Get farmer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders'
    });
  }
};

/**
 * @desc    Get single order by ID
 * @route   GET /api/orders/:id
 * @access  Private (Order owner - consumer or farmer)
 */
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('consumerId', 'name phone')
      .populate('farmerId', 'name phone')
      .populate('items.productId', 'name unit price');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user is authorized to view this order
    const userId = req.user._id.toString();
    const isConsumer = order.consumerId._id.toString() === userId;
    const isFarmer = order.farmerId._id.toString() === userId;
    const isLogistics = req.user.role === 'LOGISTICS';

    if (!isConsumer && !isFarmer && !isLogistics) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching order'
    });
  }
};

/**
 * @desc    Cancel an order (consumer only)
 * @route   DELETE /api/consumer/orders/:orderId
 * @access  Private (CONSUMER only)
 * 
 * Rules:
 * - Only order owner can cancel
 * - Cannot cancel after PICKED_UP, DELIVERED, or FAILED
 * - Restores product quantities atomically
 * - Cancels any associated delivery
 */
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    // Find the order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check ownership
    if (order.consumerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }

    // Check if order can be cancelled (not in terminal or picked up state)
    const nonCancellableStatuses = ['PICKED_UP', 'DELIVERED', 'FAILED', 'CANCELLED_BY_CONSUMER'];
    if (nonCancellableStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.orderStatus}. Only orders that have not been picked up can be cancelled.`
      });
    }

    // Validate status transition
    if (!Order.isValidTransition(order.orderStatus, 'CANCELLED_BY_CONSUMER')) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order from status: ${order.orderStatus}`
      });
    }

    // Restore product quantities atomically
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { quantity: item.quantity } }
      );
    }

    // Cancel any associated delivery
    const delivery = await Delivery.findOne({ orderId: order._id });
    if (delivery && !['DELIVERED', 'FAILED'].includes(delivery.deliveryStatus)) {
      delivery.deliveryStatus = 'FAILED';
      delivery.addEvent({
        eventType: 'STATUS_CHANGE',
        fromStatus: delivery.deliveryStatus,
        toStatus: 'FAILED',
        performedByRole: 'CONSUMER',
        performedBy: req.user._id,
        remarks: `Order cancelled by consumer: ${reason || 'No reason provided'}`
      });
      await delivery.save();
    }

    // Update order status
    order.orderStatus = 'CANCELLED_BY_CONSUMER';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by consumer';
    order.lastUpdatedByRole = 'CONSUMER';
    order.lastSyncedAt = new Date();
    await order.save();

    // Notify farmer of cancellation
    try {
      await Notification.create({
        userId: order.farmerId,
        role: 'FARMER',
        type: 'ORDER_CANCELLED',
        message: `Order #${order._id.toString().slice(-8).toUpperCase()} was cancelled by consumer. Reason: ${reason || 'Not specified'}`,
        relatedEntityId: order._id,
        relatedEntityType: 'Order'
      });
    } catch (notifError) {
      console.error('Notification error (non-blocking):', notifError);
    }

    // Populate and return
    const populatedOrder = await Order.findById(order._id)
      .populate('farmerId', 'name phone')
      .populate('items.productId', 'name unit');

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully. Product quantities have been restored.',
      order: populatedOrder
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling order'
    });
  }
};

module.exports = {
  createOrder,
  getConsumerOrders,
  getFarmerOrders,
  getOrderById,
  cancelOrder
};


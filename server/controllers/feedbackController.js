const Feedback = require('../models/Feedback');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');

/**
 * @desc    Submit feedback for an order
 * @route   POST /api/feedback
 * @access  Private (CONSUMER only)
 */
const submitFeedback = async (req, res) => {
  try {
    const { orderId, rating, comment, farmerRating, logisticsRating } = req.body;

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user is the consumer of this order
    if (order.consumerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit feedback for this order'
      });
    }

    // Check if order is delivered
    if (order.orderStatus !== 'DELIVERED') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be submitted for delivered orders'
      });
    }

    // Check if feedback already exists
    const existingFeedback = await Feedback.findOne({ orderId });
    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'Feedback already submitted for this order'
      });
    }

    // Get logistics ID from delivery
    let logisticsId = null;
    const delivery = await Delivery.findOne({ orderId });
    if (delivery) {
      logisticsId = delivery.driverId;
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Create feedback
    const feedback = await Feedback.create({
      orderId,
      consumerId: req.user._id,
      farmerId: order.farmerId,
      logisticsId,
      rating,
      comment: comment || '',
      farmerRating: farmerRating || rating,
      logisticsRating: logisticsRating || rating
    });

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback
    });
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Feedback already submitted for this order'
      });
    }

    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting feedback'
    });
  }
};

/**
 * @desc    Get feedback for farmer's orders
 * @route   GET /api/farmer/feedback
 * @access  Private (FARMER only)
 */
const getFarmerFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.find({ farmerId: req.user._id })
      .populate('consumerId', 'name')
      .populate('orderId', 'totalAmount createdAt')
      .sort({ createdAt: -1 });

    // Calculate average rating
    const totalRatings = feedback.length;
    const avgRating = totalRatings > 0
      ? (feedback.reduce((sum, f) => sum + (f.farmerRating || f.rating), 0) / totalRatings).toFixed(1)
      : 0;

    res.status(200).json({
      success: true,
      count: feedback.length,
      averageRating: parseFloat(avgRating),
      feedback
    });
  } catch (error) {
    console.error('Get farmer feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching feedback'
    });
  }
};

/**
 * @desc    Get feedback for logistics driver
 * @route   GET /api/logistics/feedback
 * @access  Private (LOGISTICS only)
 */
const getLogisticsFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.find({ logisticsId: req.user._id })
      .populate('consumerId', 'name')
      .populate('orderId', 'totalAmount createdAt')
      .sort({ createdAt: -1 });

    // Calculate average rating
    const totalRatings = feedback.length;
    const avgRating = totalRatings > 0
      ? (feedback.reduce((sum, f) => sum + (f.logisticsRating || f.rating), 0) / totalRatings).toFixed(1)
      : 0;

    res.status(200).json({
      success: true,
      count: feedback.length,
      averageRating: parseFloat(avgRating),
      feedback
    });
  } catch (error) {
    console.error('Get logistics feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching feedback'
    });
  }
};

/**
 * @desc    Get feedback for a specific order
 * @route   GET /api/feedback/:orderId
 * @access  Private (Order parties only)
 */
const getOrderFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findOne({ orderId: req.params.orderId })
      .populate('consumerId', 'name');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'No feedback found for this order'
      });
    }

    res.status(200).json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Get order feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching feedback'
    });
  }
};

module.exports = {
  submitFeedback,
  getFarmerFeedback,
  getLogisticsFeedback,
  getOrderFeedback
};

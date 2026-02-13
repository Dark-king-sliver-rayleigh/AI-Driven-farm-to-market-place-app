const Feedback = require('../models/Feedback');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');
const SentimentService = require('../services/SentimentService');

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

    // ═══════════════════════════════════════════
    // AI: Asynchronous Sentiment Analysis
    // Runs after response is sent so it doesn't block the user
    // ═══════════════════════════════════════════
    if (comment && comment.trim()) {
      // Don't await - run in background
      SentimentService.analyze(comment).then(async (sentimentResult) => {
        try {
          await Feedback.findByIdAndUpdate(feedback._id, {
            sentiment: sentimentResult.sentiment,
            sentimentScore: sentimentResult.score,
            themes: sentimentResult.themes,
            sentimentSummary: sentimentResult.summary,
            sentimentMethodology: sentimentResult.methodology
          });
          console.log(`[FeedbackController] Sentiment analysis complete for feedback ${feedback._id}: ${sentimentResult.sentiment}`);
        } catch (err) {
          console.error('[FeedbackController] Failed to save sentiment:', err.message);
        }
      }).catch(err => {
        console.error('[FeedbackController] Sentiment analysis failed:', err.message);
      });
    }

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

/**
 * @desc    Get AI sentiment analytics for farmer's feedback
 * @route   GET /api/farmer/feedback/sentiment
 * @access  Private (FARMER only)
 */
const getSentimentAnalytics = async (req, res) => {
  try {
    const feedback = await Feedback.find({ 
      farmerId: req.user._id,
      comment: { $exists: true, $ne: '' }
    }).select('comment sentiment sentimentScore themes sentimentSummary sentimentMethodology rating createdAt');

    // If any feedback lacks sentiment, analyze them now
    const unanalyzed = feedback.filter(f => !f.sentiment && f.comment);
    if (unanalyzed.length > 0) {
      const batchResult = await SentimentService.batchAnalyze(
        unanalyzed.map(f => ({ id: f._id.toString(), text: f.comment }))
      );
      
      // Update unanalyzed feedback with sentiment results
      for (const result of batchResult.individual) {
        await Feedback.findByIdAndUpdate(result.id, {
          sentiment: result.sentiment,
          sentimentScore: result.score,
          themes: result.themes,
          sentimentSummary: result.summary,
          sentimentMethodology: result.methodology
        });
      }
    }

    // Re-fetch with updated sentiment data
    const updatedFeedback = await Feedback.find({ 
      farmerId: req.user._id,
      comment: { $exists: true, $ne: '' }
    }).select('sentiment sentimentScore themes sentimentSummary rating createdAt');

    // Compute aggregate stats
    const withSentiment = updatedFeedback.filter(f => f.sentiment);
    const distribution = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
    const allThemes = {};
    let totalScore = 0;

    for (const fb of withSentiment) {
      distribution[fb.sentiment] = (distribution[fb.sentiment] || 0) + 1;
      totalScore += fb.sentimentScore || 0;
      (fb.themes || []).forEach(t => { allThemes[t] = (allThemes[t] || 0) + 1; });
    }

    res.json({
      success: true,
      total: withSentiment.length,
      averageSentimentScore: withSentiment.length > 0 ? Math.round((totalScore / withSentiment.length) * 100) / 100 : null,
      overallSentiment: totalScore / Math.max(withSentiment.length, 1) >= 0.6 ? 'POSITIVE' : 
                        totalScore / Math.max(withSentiment.length, 1) <= 0.4 ? 'NEGATIVE' : 'NEUTRAL',
      distribution,
      topThemes: Object.entries(allThemes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([theme, count]) => ({ theme, count })),
      feedback: withSentiment
    });
  } catch (error) {
    console.error('Sentiment analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sentiment analytics'
    });
  }
};

module.exports = {
  submitFeedback,
  getFarmerFeedback,
  getLogisticsFeedback,
  getOrderFeedback,
  getSentimentAnalytics
};

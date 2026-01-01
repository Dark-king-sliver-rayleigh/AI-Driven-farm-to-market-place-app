const mongoose = require('mongoose');

/**
 * Feedback Schema
 * Post-delivery feedback for accountability and system improvement
 */
const FeedbackSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order ID is required'],
    unique: true  // One feedback per order
  },
  consumerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Consumer ID is required']
  },
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Farmer ID is required'],
    index: true
  },
  logisticsId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  comment: {
    type: String,
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  // Separate ratings for farmer and logistics
  farmerRating: {
    type: Number,
    min: 1,
    max: 5
  },
  logisticsRating: {
    type: Number,
    min: 1,
    max: 5
  }
}, { 
  timestamps: true 
});

// Compound indexes for efficient queries
FeedbackSchema.index({ farmerId: 1, createdAt: -1 });
FeedbackSchema.index({ logisticsId: 1, createdAt: -1 });

module.exports = mongoose.model('Feedback', FeedbackSchema);

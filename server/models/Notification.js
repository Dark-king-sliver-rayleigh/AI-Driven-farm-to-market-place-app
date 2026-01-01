const mongoose = require('mongoose');

/**
 * Notification Schema
 * System-generated notifications to keep all roles informed
 */
const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  role: {
    type: String,
    enum: ['FARMER', 'CONSUMER', 'LOGISTICS'],
    required: [true, 'Role is required']
  },
  type: {
    type: String,
    enum: [
      'ORDER_PLACED',
      'ORDER_CANCELLED',
      'DELIVERY_DELAYED',
      'DELIVERY_ASSIGNED',
      'DELIVERY_STATUS_UPDATE',
      'PAYMENT_SUCCESS',
      'PAYMENT_FAILURE',
      'PRODUCT_LOW_STOCK'
    ],
    required: [true, 'Notification type is required']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    maxlength: 500
  },
  relatedEntityId: {
    type: mongoose.Schema.Types.ObjectId,
    // Can reference Order, Product, Delivery, etc.
  },
  relatedEntityType: {
    type: String,
    enum: ['Order', 'Product', 'Delivery', 'Payment']
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  }
}, { 
  timestamps: true 
});

// Compound index for efficient queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

/**
 * Static method to create notification
 */
NotificationSchema.statics.createNotification = async function({
  userId,
  role,
  type,
  message,
  relatedEntityId,
  relatedEntityType
}) {
  return this.create({
    userId,
    role,
    type,
    message,
    relatedEntityId,
    relatedEntityType
  });
};

/**
 * Static method to create bulk notifications
 */
NotificationSchema.statics.createBulkNotifications = async function(notifications) {
  return this.insertMany(notifications);
};

module.exports = mongoose.model('Notification', NotificationSchema);

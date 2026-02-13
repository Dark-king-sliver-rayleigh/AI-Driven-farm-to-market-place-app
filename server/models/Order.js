const mongoose = require('mongoose');

// Valid order status transitions
const ORDER_STATUS_TRANSITIONS = {
  'PRE_ORDER': ['CREATED', 'FAILED', 'CANCELLED_BY_CONSUMER'],  // Pre-order can be cancelled
  'CREATED': ['ASSIGNED', 'FAILED', 'CANCELLED_BY_CONSUMER'],   // Can be cancelled before assignment
  'ASSIGNED': ['PICKED_UP', 'FAILED', 'CANCELLED_BY_CONSUMER'], // Can be cancelled before pickup
  'PICKED_UP': ['DELIVERED', 'FAILED'],  // Cannot cancel after pickup
  'DELIVERED': [],  // Terminal state
  'FAILED': [],     // Terminal state
  'CANCELLED_BY_CONSUMER': []  // Terminal state
};

const OrderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  consumerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Consumer ID is required']
  },
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Farmer ID is required']
  },
  items: {
    type: [OrderItemSchema],
    required: [true, 'Order must have at least one item'],
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'Order must have at least one item'
    }
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  paymentMode: {
    type: String,
    enum: {
      values: ['COD', 'ONLINE'],
      message: 'Payment mode must be COD or ONLINE'
    },
    required: [true, 'Payment mode is required']
  },
  orderStatus: {
    type: String,
    enum: {
      values: ['PRE_ORDER', 'CREATED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'FAILED', 'CANCELLED_BY_CONSUMER'],
      message: 'Invalid order status'
    },
    default: 'CREATED'
  },
  
  // === PAYMENT TRACKING ===
  // Added for mock UPI payment integration
  // Logistics assignment requires: paymentStatus = PAID OR paymentMode = COD
  paymentStatus: {
    type: String,
    enum: {
      values: ['PENDING', 'PAID', 'FAILED'],
      message: 'Invalid payment status'
    },
    default: 'PENDING'
  },
  
  // === CANCELLATION TRACKING ===
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    maxlength: [200, 'Cancellation reason cannot exceed 200 characters'],
    trim: true
  },
  
  // === DELIVERY ADDRESS (set by consumer at checkout) ===
  deliveryAddress: {
    label: { type: String, trim: true, default: 'Home' },
    address: { type: String, trim: true },
    coordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    }
  },
  
  // === PICKUP LOCATION (from farmer's saved locations) ===
  pickupLocation: {
    label: { type: String, trim: true, default: 'Farm' },
    address: { type: String, trim: true },
    coordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    }
  },
  
  // === ASSIGNED DRIVER (for smart assignment) ===
  assignedDriverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Resilience fields for offline support
  lastUpdatedByRole: {
    type: String,
    enum: ['FARMER', 'CONSUMER', 'LOGISTICS', 'SYSTEM'],
    default: 'SYSTEM'
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

/**
 * Check if a status transition is valid
 * @param {string} currentStatus - Current order status
 * @param {string} newStatus - Desired new status
 * @returns {boolean} Whether the transition is allowed
 */
OrderSchema.statics.isValidTransition = function(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  const allowed = ORDER_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
};

/**
 * Get allowed next statuses for a given status
 * @param {string} status - Current status
 * @returns {string[]} Array of allowed next statuses
 */
OrderSchema.statics.getAllowedTransitions = function(status) {
  return ORDER_STATUS_TRANSITIONS[status] || [];
};

module.exports = mongoose.model('Order', OrderSchema);

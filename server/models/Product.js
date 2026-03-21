const mongoose = require('mongoose');

// Valid status transitions
const STATUS_TRANSITIONS = {
  'NOT_HARVESTED': ['AVAILABLE', 'PRE_ORDER'],
  'AVAILABLE': ['NOT_HARVESTED', 'PRE_ORDER'],
  'PRE_ORDER': ['AVAILABLE', 'NOT_HARVESTED']
};

const ProductSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Farmer ID is required']
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },
  unit: {
    type: String,
    enum: {
      values: ['kg', 'quintal', 'dozen', 'piece'],
      message: 'Unit must be kg, quintal, dozen, or piece'
    },
    required: [true, 'Unit is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  status: {
    type: String,
    enum: {
      values: ['NOT_HARVESTED', 'AVAILABLE', 'PRE_ORDER'],
      message: 'Invalid product status'
    },
    default: 'NOT_HARVESTED'
  },
  // Soft delete fields
  isDeleted: {
    type: Boolean,
    default: false,
    index: true  // Index for efficient filtering
  },
  deletedAt: {
    type: Date,
    default: null
  },
  // Optional: product images (base64 data URLs)
  images: {
    type: [String],
    default: []
  },
  pickupLocation: {
    address: {
      type: String,
      trim: true
    },
    coordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    }
  },
  // Optional: product category
  category: {
    type: String,
    trim: true
  }
}, { timestamps: true });

/**
 * Check if a status transition is valid
 * @param {string} currentStatus - Current product status
 * @param {string} newStatus - Desired new status
 * @returns {boolean} Whether the transition is allowed
 */
ProductSchema.statics.isValidTransition = function(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
};

/**
 * Get allowed next statuses for a given status
 * @param {string} status - Current status
 * @returns {string[]} Array of allowed next statuses
 */
ProductSchema.statics.getAllowedTransitions = function(status) {
  return STATUS_TRANSITIONS[status] || [];
};

module.exports = mongoose.model('Product', ProductSchema);

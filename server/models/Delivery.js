const mongoose = require('mongoose');

/**
 * Delivery Schema - Extended Version
 * 
 * ENHANCEMENTS:
 * 1. Append-only deliveryEvents array for immutable audit trail
 * 2. expectedDeliveryTime and isDelayed for SLA tracking
 * 3. Helper methods for event logging and delay detection
 * 
 * ACADEMIC NOTE:
 * The audit trail is append-only to ensure traceability.
 * No events can be deleted or modified after creation.
 */

// Valid delivery status transitions
const DELIVERY_STATUS_TRANSITIONS = {
  'PENDING_REASSIGNMENT': ['ASSIGNED'],  // Can be reassigned to new driver
  'ASSIGNED': ['AT_PICKUP', 'FAILED'],
  'AT_PICKUP': ['PICKED_UP', 'FAILED'],
  'PICKED_UP': ['IN_TRANSIT', 'FAILED'],
  'IN_TRANSIT': ['DELIVERED', 'FAILED'],
  'DELIVERED': [],  // Terminal state
  'FAILED': []      // Terminal state
};

// Mapping from delivery status to order status
const DELIVERY_TO_ORDER_STATUS = {
  'PENDING_REASSIGNMENT': 'ASSIGNED',  // Order remains assigned during reassignment
  'ASSIGNED': 'ASSIGNED',
  'AT_PICKUP': 'ASSIGNED',
  'PICKED_UP': 'PICKED_UP',
  'IN_TRANSIT': 'PICKED_UP',
  'DELIVERED': 'DELIVERED',
  'FAILED': 'FAILED'
};

// Default SLA in hours (can be adjusted based on distance)
const DEFAULT_SLA_HOURS = 4;

/**
 * DeliveryEvent Schema (Embedded)
 * 
 * Append-only audit trail for every delivery status change.
 * Immutable once created - NEVER modify or delete events.
 */
const DeliveryEventSchema = new mongoose.Schema({
  // Event type (STATUS_CHANGE, DELAYED, REASSIGNED, etc.)
  eventType: {
    type: String,
    required: true,
    enum: ['CREATED', 'STATUS_CHANGE', 'DELAYED', 'REASSIGNED', 'FAILED', 'COMPLETED', 'REMARK']
  },
  
  // Previous status (for STATUS_CHANGE events)
  fromStatus: {
    type: String
  },
  
  // New status (for STATUS_CHANGE events)
  toStatus: {
    type: String
  },
  
  // Driver ID at time of event (for tracking reassignments)
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Role of user who triggered the event
  performedByRole: {
    type: String,
    enum: ['LOGISTICS', 'FARMER', 'CONSUMER', 'SYSTEM'],
    default: 'SYSTEM'
  },
  
  // User ID who performed the action
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Human-readable remarks
  remarks: {
    type: String,
    maxlength: 500
  },
  
  // Timestamp of event (immutable, set on creation)
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, { _id: true });

const LocationSchema = new mongoose.Schema({
  address: {
    type: String,
    required: [true, 'Address is required']
  },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  }
}, { _id: false });

const DeliverySchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order ID is required'],
    unique: true  // One delivery per order
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Driver ID is required']
  },
  pickupLocation: {
    type: LocationSchema,
    required: [true, 'Pickup location is required']
  },
  dropLocation: {
    type: LocationSchema,
    required: [true, 'Drop location is required']
  },
  deliveryStatus: {
    type: String,
    enum: {
      values: ['PENDING_REASSIGNMENT', 'ASSIGNED', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED'],
      message: 'Invalid delivery status'
    },
    default: 'ASSIGNED'
  },
  distance: {
    type: Number,
    min: [0, 'Distance cannot be negative']
  },
  payoutAmount: {
    type: Number,
    min: [0, 'Payout cannot be negative'],
    default: 0
  },
  payoutBreakdown: {
    baseFee: { type: Number, default: 0 },
    distanceFee: { type: Number, default: 0 },
    orderValueBonus: { type: Number, default: 0 }
  },
  earningStatus: {
    type: String,
    enum: {
      values: ['PENDING', 'EARNED', 'CANCELLED'],
      message: 'Invalid earning status'
    },
    default: 'PENDING'
  },
  
  // === SLA & DELAY TRACKING ===
  
  // Expected delivery time (computed on assignment)
  expectedDeliveryTime: {
    type: Date
  },
  
  // Whether delivery is delayed (exceeds expected time)
  isDelayed: {
    type: Boolean,
    default: false
  },
  
  // Time when delay was detected
  delayDetectedAt: {
    type: Date
  },
  
  // === AUDIT TRAIL ===
  
  // Append-only array of delivery events
  // NEVER delete or modify existing events
  deliveryEvents: {
    type: [DeliveryEventSchema],
    default: []
  },
  
  // Previous driver (for tracking reassignments)
  previousDriverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Number of reassignments
  reassignmentCount: {
    type: Number,
    default: 0
  },
  
  // Resilience fields for offline support
  lastUpdatedByRole: {
    type: String,
    enum: ['LOGISTICS', 'SYSTEM'],
    default: 'SYSTEM'
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

/**
 * Check if a status transition is valid
 */
DeliverySchema.statics.isValidTransition = function(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  const allowed = DELIVERY_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
};

/**
 * Get the corresponding order status for a delivery status
 */
DeliverySchema.statics.getOrderStatus = function(deliveryStatus) {
  return DELIVERY_TO_ORDER_STATUS[deliveryStatus];
};

/**
 * Get allowed next statuses for a given status
 */
DeliverySchema.statics.getAllowedTransitions = function(status) {
  return DELIVERY_STATUS_TRANSITIONS[status] || [];
};

/**
 * Calculate expected delivery time based on distance
 * Uses a simple heuristic: base SLA + additional time for distance
 * 
 * @param {number} distance - Distance in km
 * @returns {Date} Expected delivery time
 */
DeliverySchema.statics.calculateExpectedDeliveryTime = function(distance = 0) {
  const now = new Date();
  
  // Base SLA: 4 hours
  let slaHours = DEFAULT_SLA_HOURS;
  
  // Add 30 minutes per 10 km beyond first 10 km
  if (distance > 10) {
    slaHours += ((distance - 10) / 10) * 0.5;
  }
  
  // Cap at 8 hours max
  slaHours = Math.min(slaHours, 8);
  
  return new Date(now.getTime() + slaHours * 60 * 60 * 1000);
};

/**
 * Calculate logistics payout from delivery workload.
 * Keeps the formula explicit and deterministic for the UI and reports.
 *
 * @param {number} distance - Distance in km
 * @param {number} orderTotal - Total order amount
 * @returns {{ baseFee: number, distanceFee: number, orderValueBonus: number, total: number }}
 */
DeliverySchema.statics.calculatePayout = function(distance = 0, orderTotal = 0) {
  const normalizedDistance = Math.max(0, Number(distance) || 0);
  const normalizedOrderTotal = Math.max(0, Number(orderTotal) || 0);

  const baseFee = 35;
  const distanceFee = normalizedDistance * 4;
  const orderValueBonus = normalizedOrderTotal * 0.03;
  const total = Number((baseFee + distanceFee + orderValueBonus).toFixed(2));

  return {
    baseFee: Number(baseFee.toFixed(2)),
    distanceFee: Number(distanceFee.toFixed(2)),
    orderValueBonus: Number(orderValueBonus.toFixed(2)),
    total
  };
};

/**
 * Add an event to the audit trail
 * This method ensures immutability - events can only be added, never removed
 * 
 * @param {Object} eventData - Event details
 */
DeliverySchema.methods.addEvent = function(eventData) {
  this.deliveryEvents.push({
    eventType: eventData.eventType,
    fromStatus: eventData.fromStatus,
    toStatus: eventData.toStatus,
    driverId: eventData.driverId || this.driverId,
    performedByRole: eventData.performedByRole || 'SYSTEM',
    performedBy: eventData.performedBy,
    remarks: eventData.remarks,
    timestamp: new Date()
  });
};

/**
 * Check if delivery is delayed and update status
 * 
 * @returns {boolean} Whether delay was newly detected
 */
DeliverySchema.methods.checkAndMarkDelay = function() {
  // Skip if already delayed or in terminal state
  if (this.isDelayed || ['DELIVERED', 'FAILED'].includes(this.deliveryStatus)) {
    return false;
  }
  
  // Check if expected time has passed
  if (this.expectedDeliveryTime && new Date() > this.expectedDeliveryTime) {
    this.isDelayed = true;
    this.delayDetectedAt = new Date();
    
    // Add DELAYED event to audit trail
    this.addEvent({
      eventType: 'DELAYED',
      fromStatus: this.deliveryStatus,
      toStatus: this.deliveryStatus,
      performedByRole: 'SYSTEM',
      remarks: `Delivery exceeded expected time. Expected: ${this.expectedDeliveryTime.toISOString()}`
    });
    
    return true;
  }
  
  return false;
};

/**
 * Check if delivery can be reassigned
 * Only delayed deliveries can be reassigned
 */
DeliverySchema.methods.canBeReassigned = function() {
  // Only delayed deliveries in non-terminal states can be reassigned
  return this.isDelayed && 
         !['DELIVERED', 'FAILED', 'PENDING_REASSIGNMENT'].includes(this.deliveryStatus);
};

module.exports = mongoose.model('Delivery', DeliverySchema);

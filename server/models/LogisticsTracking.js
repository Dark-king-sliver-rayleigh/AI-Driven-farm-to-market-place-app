const mongoose = require('mongoose');

/**
 * LogisticsTracking Schema - Real-Time Delivery Tracking
 * 
 * PURPOSE:
 * Track real-time driver location and logistics state for live map visualization.
 * This model stores the current position of a driver along the delivery route.
 * 
 * LOGISTICS STATE MACHINE (FSM):
 * ORDER_CONFIRMED → DRIVER_ASSIGNED → PICKUP_STARTED → PICKUP_COMPLETED 
 *                → IN_TRANSIT → NEAR_DESTINATION → DELIVERED
 * 
 * Each state transition is:
 * 1. Validated against allowed transitions
 * 2. Timestamped for audit trail
 * 3. Triggers real-time UI updates via polling
 * 
 * ACADEMIC NOTE:
 * The state machine pattern ensures deterministic delivery lifecycle management.
 * All location updates come from backend to prevent client-side location spoofing.
 */

// ============================================
// LOGISTICS STATE MACHINE DEFINITION
// ============================================

/**
 * Valid logistics states - represents delivery lifecycle stages
 */
const LOGISTICS_STATES = [
  'ORDER_CONFIRMED',      // Order placed, awaiting driver assignment
  'DRIVER_ASSIGNED',      // Driver assigned to the order
  'PICKUP_STARTED',       // Driver en route to farmer/pickup location
  'PICKUP_COMPLETED',     // Driver has collected the goods
  'IN_TRANSIT',           // Driver traveling from farmer to consumer
  'NEAR_DESTINATION',     // Driver within proximity threshold (e.g., 500m)
  'DELIVERED'             // Order successfully delivered
];

/**
 * State transition rules - enforces valid lifecycle progressions
 * Key: Current state, Value: Array of allowed next states
 */
const STATE_TRANSITIONS = {
  'ORDER_CONFIRMED': ['DRIVER_ASSIGNED'],
  'DRIVER_ASSIGNED': ['PICKUP_STARTED'],
  'PICKUP_STARTED': ['PICKUP_COMPLETED'],
  'PICKUP_COMPLETED': ['IN_TRANSIT'],
  'IN_TRANSIT': ['NEAR_DESTINATION', 'DELIVERED'], // Can skip NEAR_DESTINATION for short distances
  'NEAR_DESTINATION': ['DELIVERED'],
  'DELIVERED': [] // Terminal state - no further transitions
};

/**
 * Human-readable status messages for UI display
 */
const STATE_DISPLAY_MESSAGES = {
  'ORDER_CONFIRMED': 'Order confirmed, waiting for driver',
  'DRIVER_ASSIGNED': 'Driver assigned to your order',
  'PICKUP_STARTED': 'Driver heading to pickup location',
  'PICKUP_COMPLETED': 'Package collected, delivery starting',
  'IN_TRANSIT': 'Your order is on the way',
  'NEAR_DESTINATION': 'Driver is nearby',
  'DELIVERED': 'Order delivered successfully'
};

/**
 * Driver marker colors based on logistics state (for UI)
 */
const STATE_MARKER_COLORS = {
  'ORDER_CONFIRMED': '#9CA3AF',   // Gray - waiting
  'DRIVER_ASSIGNED': '#3B82F6',   // Blue - assigned
  'PICKUP_STARTED': '#F59E0B',    // Amber - en route to pickup
  'PICKUP_COMPLETED': '#10B981',  // Green - goods collected
  'IN_TRANSIT': '#10B981',        // Green - delivering
  'NEAR_DESTINATION': '#8B5CF6',  // Purple - almost there
  'DELIVERED': '#059669'          // Dark green - complete
};

/**
 * Proximity threshold in meters for NEAR_DESTINATION state
 */
const NEAR_DESTINATION_THRESHOLD_METERS = 500;

// ============================================
// EMBEDDED SCHEMAS
// ============================================

/**
 * Coordinate Schema - Geographic location
 */
const CoordinateSchema = new mongoose.Schema({
  lat: {
    type: Number,
    required: [true, 'Latitude is required'],
    min: [-90, 'Latitude must be between -90 and 90'],
    max: [90, 'Latitude must be between -90 and 90']
  },
  lng: {
    type: Number,
    required: [true, 'Longitude is required'],
    min: [-180, 'Longitude must be between -180 and 180'],
    max: [180, 'Longitude must be between -180 and 180']
  }
}, { _id: false });

/**
 * Location Schema - Address with coordinates
 */
const LocationSchema = new mongoose.Schema({
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  coordinates: {
    type: CoordinateSchema,
    required: [true, 'Coordinates are required']
  }
}, { _id: false });

/**
 * Route Point Schema - Point along the delivery route
 * Used for animating driver movement on the map
 */
const RoutePointSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  // Index in the polyline path (for progress tracking)
  pathIndex: { type: Number, required: true }
}, { _id: false });

/**
 * State Transition Event Schema - Audit log for state changes
 * Immutable once created for traceability
 */
const StateTransitionSchema = new mongoose.Schema({
  fromState: {
    type: String,
    enum: LOGISTICS_STATES
  },
  toState: {
    type: String,
    required: true,
    enum: LOGISTICS_STATES
  },
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  driverLocation: CoordinateSchema,
  remarks: {
    type: String,
    maxlength: 200
  }
}, { _id: true });

// ============================================
// MAIN SCHEMA
// ============================================

const LogisticsTrackingSchema = new mongoose.Schema({
  // Reference to the order being tracked
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order ID is required'],
    unique: true
  },
  
  // Reference to the delivery record
  deliveryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Delivery',
    required: [true, 'Delivery ID is required'],
    index: true
  },
  
  // Assigned driver
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Driver ID is required'],
    index: true
  },
  
  // ============================================
  // LOGISTICS STATE MACHINE
  // ============================================
  
  // Current logistics state
  currentState: {
    type: String,
    enum: {
      values: LOGISTICS_STATES,
      message: 'Invalid logistics state: {VALUE}'
    },
    default: 'ORDER_CONFIRMED',
    index: true
  },
  
  // State transition history (append-only audit trail)
  stateHistory: {
    type: [StateTransitionSchema],
    default: []
  },
  
  // ============================================
  // LOCATIONS
  // ============================================
  
  // Farmer/Pickup location (static)
  farmerLocation: {
    type: LocationSchema,
    required: [true, 'Farmer location is required']
  },
  
  // Consumer/Delivery location (static)
  consumerLocation: {
    type: LocationSchema,
    required: [true, 'Consumer location is required']
  },
  
  // Current driver location (dynamic - updated via polling)
  driverLocation: {
    type: CoordinateSchema,
    required: [true, 'Initial driver location is required']
  },
  
  // ============================================
  // ROUTE INFORMATION
  // ============================================
  
  // Encoded polyline from Google Directions API
  // Used to draw the route on the map
  routePolyline: {
    type: String,
    required: false
  },
  
  // Decoded route points for incremental driver movement
  routePoints: {
    type: [RoutePointSchema],
    default: []
  },
  
  // Current index in routePoints (driver's progress)
  currentRouteIndex: {
    type: Number,
    default: 0
  },
  
  // ============================================
  // DISTANCE & ETA
  // ============================================
  
  // Total route distance in meters
  totalDistanceMeters: {
    type: Number,
    min: 0
  },
  
  // Remaining distance in meters
  remainingDistanceMeters: {
    type: Number,
    min: 0
  },
  
  // Human-readable total distance (e.g., "12.5 km")
  totalDistanceText: {
    type: String
  },
  
  // Human-readable remaining distance
  remainingDistanceText: {
    type: String
  },
  
  // Estimated time of arrival (Date object)
  estimatedArrival: {
    type: Date
  },
  
  // ETA in seconds from now
  etaSeconds: {
    type: Number,
    min: 0
  },
  
  // Human-readable ETA (e.g., "25 mins")
  etaText: {
    type: String
  },
  
  // ============================================
  // METADATA
  // ============================================
  
  // Driver details (denormalized for quick access)
  driverInfo: {
    name: String,
    phone: String,
    vehicleNumber: String
  },
  
  // Last location update timestamp
  lastLocationUpdate: {
    type: Date,
    default: Date.now
  },
  
  // Whether tracking is active (false after delivery)
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Actual delivery completion time
  deliveredAt: {
    type: Date
  }
  
}, { timestamps: true });

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

// Compound index for active tracking queries
LogisticsTrackingSchema.index({ isActive: 1, currentState: 1 });

// Index for driver's active deliveries
LogisticsTrackingSchema.index({ driverId: 1, isActive: 1 });

// ============================================
// STATIC METHODS
// ============================================

/**
 * Check if a state transition is valid
 * @param {string} currentState - Current logistics state
 * @param {string} newState - Desired new state
 * @returns {boolean} Whether the transition is allowed
 */
LogisticsTrackingSchema.statics.isValidTransition = function(currentState, newState) {
  if (currentState === newState) return true; // No change
  const allowed = STATE_TRANSITIONS[currentState] || [];
  return allowed.includes(newState);
};

/**
 * Get allowed next states for a given state
 * @param {string} state - Current state
 * @returns {string[]} Array of allowed next states
 */
LogisticsTrackingSchema.statics.getAllowedTransitions = function(state) {
  return STATE_TRANSITIONS[state] || [];
};

/**
 * Get display message for a state
 * @param {string} state - Logistics state
 * @returns {string} Human-readable message
 */
LogisticsTrackingSchema.statics.getStateMessage = function(state) {
  return STATE_DISPLAY_MESSAGES[state] || 'Unknown status';
};

/**
 * Get marker color for a state
 * @param {string} state - Logistics state
 * @returns {string} Hex color code
 */
LogisticsTrackingSchema.statics.getMarkerColor = function(state) {
  return STATE_MARKER_COLORS[state] || '#6B7280';
};

/**
 * Get all logistics states
 * @returns {string[]} Array of all states
 */
LogisticsTrackingSchema.statics.getAllStates = function() {
  return LOGISTICS_STATES;
};

/**
 * Get proximity threshold for NEAR_DESTINATION
 * @returns {number} Distance in meters
 */
LogisticsTrackingSchema.statics.getNearDestinationThreshold = function() {
  return NEAR_DESTINATION_THRESHOLD_METERS;
};

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Transition to a new state with validation
 * @param {string} newState - New logistics state
 * @param {Object} options - Additional options (remarks, driverLocation)
 * @returns {boolean} Whether transition was successful
 * @throws {Error} If transition is invalid
 */
LogisticsTrackingSchema.methods.transitionTo = function(newState, options = {}) {
  const LogisticsTracking = this.constructor;
  
  // Validate transition
  if (!LogisticsTracking.isValidTransition(this.currentState, newState)) {
    const allowed = LogisticsTracking.getAllowedTransitions(this.currentState);
    throw new Error(
      `Invalid state transition from ${this.currentState} to ${newState}. ` +
      `Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`
    );
  }
  
  // Record the transition
  this.stateHistory.push({
    fromState: this.currentState,
    toState: newState,
    timestamp: new Date(),
    driverLocation: options.driverLocation || this.driverLocation,
    remarks: options.remarks
  });
  
  // Update current state
  const previousState = this.currentState;
  this.currentState = newState;
  
  // Handle terminal state
  if (newState === 'DELIVERED') {
    this.isActive = false;
    this.deliveredAt = new Date();
    this.remainingDistanceMeters = 0;
    this.remainingDistanceText = '0 m';
    this.etaSeconds = 0;
    this.etaText = 'Delivered';
  }
  
  return true;
};

/**
 * Update driver location and recalculate ETA
 * @param {Object} newLocation - { lat, lng }
 * @param {number} newRouteIndex - Current index in route points
 */
LogisticsTrackingSchema.methods.updateDriverLocation = function(newLocation, newRouteIndex = null) {
  this.driverLocation = {
    lat: newLocation.lat,
    lng: newLocation.lng
  };
  this.lastLocationUpdate = new Date();
  
  if (newRouteIndex !== null) {
    this.currentRouteIndex = newRouteIndex;
  }
};

/**
 * Calculate distance to consumer
 * Uses Haversine formula for accuracy
 * @returns {number} Distance in meters
 */
LogisticsTrackingSchema.methods.getDistanceToConsumer = function() {
  const R = 6371000; // Earth's radius in meters
  const lat1 = this.driverLocation.lat * Math.PI / 180;
  const lat2 = this.consumerLocation.coordinates.lat * Math.PI / 180;
  const deltaLat = (this.consumerLocation.coordinates.lat - this.driverLocation.lat) * Math.PI / 180;
  const deltaLng = (this.consumerLocation.coordinates.lng - this.driverLocation.lng) * Math.PI / 180;
  
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

/**
 * Check if driver is near destination and should trigger state change
 * @returns {boolean} Whether driver is within threshold
 */
LogisticsTrackingSchema.methods.isNearDestination = function() {
  if (this.currentState !== 'IN_TRANSIT') return false;
  const distance = this.getDistanceToConsumer();
  return distance <= NEAR_DESTINATION_THRESHOLD_METERS;
};

/**
 * Get tracking data formatted for API response
 * @returns {Object} Formatted tracking data
 */
LogisticsTrackingSchema.methods.toTrackingResponse = function() {
  const LogisticsTracking = this.constructor;
  
  return {
    orderId: this.orderId,
    deliveryId: this.deliveryId,
    currentState: this.currentState,
    stateMessage: LogisticsTracking.getStateMessage(this.currentState),
    markerColor: LogisticsTracking.getMarkerColor(this.currentState),
    driverLocation: this.driverLocation,
    farmerLocation: {
      address: this.farmerLocation.address,
      coordinates: this.farmerLocation.coordinates
    },
    consumerLocation: {
      address: this.consumerLocation.address,
      coordinates: this.consumerLocation.coordinates
    },
    routePolyline: this.routePolyline,
    routeProgress: {
      currentIndex: this.currentRouteIndex,
      totalPoints: this.routePoints.length,
      percentComplete: this.routePoints.length > 0 
        ? Math.round((this.currentRouteIndex / this.routePoints.length) * 100)
        : 0
    },
    distance: {
      total: this.totalDistanceText,
      remaining: this.remainingDistanceText,
      remainingMeters: this.remainingDistanceMeters
    },
    eta: {
      arrival: this.estimatedArrival,
      seconds: this.etaSeconds,
      text: this.etaText
    },
    driver: this.driverInfo,
    lastUpdate: this.lastLocationUpdate,
    isActive: this.isActive,
    deliveredAt: this.deliveredAt,
    stateHistory: this.stateHistory.map(event => ({
      from: event.fromState,
      to: event.toState,
      timestamp: event.timestamp,
      remarks: event.remarks
    }))
  };
};

// ============================================
// VIRTUALS
// ============================================

/**
 * Virtual for progress percentage
 */
LogisticsTrackingSchema.virtual('progressPercentage').get(function() {
  if (this.routePoints.length === 0) return 0;
  return Math.round((this.currentRouteIndex / this.routePoints.length) * 100);
});

/**
 * Virtual for whether delivery is complete
 */
LogisticsTrackingSchema.virtual('isDelivered').get(function() {
  return this.currentState === 'DELIVERED';
});

// Ensure virtuals are included in JSON output
LogisticsTrackingSchema.set('toJSON', { virtuals: true });
LogisticsTrackingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LogisticsTracking', LogisticsTrackingSchema);

// Export constants for use in other modules
module.exports.LOGISTICS_STATES = LOGISTICS_STATES;
module.exports.STATE_TRANSITIONS = STATE_TRANSITIONS;
module.exports.STATE_DISPLAY_MESSAGES = STATE_DISPLAY_MESSAGES;
module.exports.STATE_MARKER_COLORS = STATE_MARKER_COLORS;
module.exports.NEAR_DESTINATION_THRESHOLD_METERS = NEAR_DESTINATION_THRESHOLD_METERS;

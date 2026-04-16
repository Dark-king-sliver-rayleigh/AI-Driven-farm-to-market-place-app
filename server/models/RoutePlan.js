const mongoose = require('mongoose');

/**
 * RoutePlan Schema
 *
 * Represents a milk-run style delivery route combining multiple stops
 * for a single driver on a given date.
 *
 * DESIGN:
 * - Each stop maps to an orderId with pickup/drop coordinates.
 * - Stops are sequenced by the planning algorithm (nearest-neighbor heuristic).
 * - The plan tracks capacity constraints (weight-based).
 * - Status transitions: DRAFT -> ASSIGNED -> IN_PROGRESS -> COMPLETED / CANCELLED
 */

// Valid route plan status transitions
const ROUTE_STATUS_TRANSITIONS = {
  'DRAFT':       ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  'ASSIGNED':    ['IN_PROGRESS', 'CANCELLED'],
  'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
  'COMPLETED':   [],
  'CANCELLED':   []
};

// Valid stop status transitions
const STOP_STATUS_TRANSITIONS = {
  'PENDING':     ['ARRIVED', 'SKIPPED'],
  'ARRIVED':     ['COMPLETED', 'FAILED'],
  'COMPLETED':   [],
  'FAILED':      [],
  'SKIPPED':     []
};

const CoordinateSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
}, { _id: false });

const StopSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order ID is required']
  },
  type: {
    type: String,
    enum: ['PICKUP', 'DROP'],
    required: true
  },
  coordinates: {
    type: CoordinateSchema,
    required: [true, 'Stop coordinates are required']
  },
  address: {
    type: String,
    default: ''
  },
  sequence: {
    type: Number,
    required: true,
    min: 0
  },
  eta: {
    type: Date
  },
  plannedDistanceFromPrevKm: {
    type: Number,
    default: 0,
    min: 0
  },
  estimatedDurationFromPrevMin: {
    type: Number,
    default: 0,
    min: 0
  },
  weightKg: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['PENDING', 'ARRIVED', 'COMPLETED', 'FAILED', 'SKIPPED'],
    default: 'PENDING'
  },
  completedAt: {
    type: Date
  },
  remarks: {
    type: String,
    maxlength: 300
  }
});

const RoutePlanSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'Route date is required'],
    index: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  stops: {
    type: [StopSchema],
    default: [],
    validate: {
      validator: function(stops) {
        return stops && stops.length > 0;
      },
      message: 'Route must have at least one stop'
    }
  },
  totalDistanceKm: {
    type: Number,
    default: 0,
    min: 0
  },
  estimatedDurationMin: {
    type: Number,
    default: 0,
    min: 0
  },
  vehicleCapacityKg: {
    type: Number,
    default: 0,
    min: 0
  },
  usedCapacityKg: {
    type: Number,
    default: 0,
    min: 0
  },
  utilizationPct: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: {
      values: ['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      message: 'Invalid route plan status'
    },
    default: 'DRAFT',
    index: true
  },
  // Origin point for the route (driver starting location)
  originCoordinates: {
    type: CoordinateSchema
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedAt: {
    type: Date
  },
  // === AI OPTIMIZATION METADATA ===
  optimizationMethod: {
    type: String,
    default: 'nearest_neighbor',
    enum: ['nearest_neighbor', '2-opt_local_search', 'none']
  },
  optimizationIterations: {
    type: Number,
    default: 0
  },
  initialDistanceKm: {
    type: Number,
    default: 0
  },
  distanceSavedKm: {
    type: Number,
    default: 0
  },
  distanceSavedPercent: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Indexes
RoutePlanSchema.index({ driverId: 1, date: -1 });
RoutePlanSchema.index({ status: 1, date: -1 });

/**
 * Check if a route status transition is valid
 */
RoutePlanSchema.statics.isValidTransition = function(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  const allowed = ROUTE_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
};

RoutePlanSchema.statics.getAllowedTransitions = function(status) {
  return ROUTE_STATUS_TRANSITIONS[status] || [];
};

/**
 * Check if a stop status transition is valid
 */
RoutePlanSchema.statics.isValidStopTransition = function(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  const allowed = STOP_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
};

RoutePlanSchema.statics.getAllowedStopTransitions = function(status) {
  return STOP_STATUS_TRANSITIONS[status] || [];
};

/**
 * Recalculate utilization percentage after capacity changes
 */
RoutePlanSchema.methods.recalcUtilization = function() {
  if (this.vehicleCapacityKg > 0) {
    this.utilizationPct = Math.round((this.usedCapacityKg / this.vehicleCapacityKg) * 100 * 100) / 100;
  } else {
    this.utilizationPct = 0;
  }
};

module.exports = mongoose.model('RoutePlan', RoutePlanSchema);

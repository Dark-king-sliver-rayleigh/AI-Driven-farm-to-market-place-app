const express = require('express');
const router = express.Router();
const {
  getTracking,
  initializeTracking,
  updateDriverLocation,
  updateState,
  simulateMovement,
  getDriverActiveTracking,
  getConsumerTracking,
  getStatesInfo
} = require('../controllers/logisticsTrackingController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

/**
 * Logistics Tracking Routes
 * 
 * Real-time delivery tracking API endpoints.
 * 
 * PUBLIC ENDPOINTS:
 * - GET /states - Get all logistics states info
 * 
 * PROTECTED ENDPOINTS (require authentication):
 * - GET /:orderId - Get tracking for an order (all participants)
 * - GET /active - Get driver's active tracking (LOGISTICS only)
 * - POST /:orderId/initialize - Initialize tracking (LOGISTICS only)
 * - POST /:orderId/location - Update driver location (LOGISTICS only)
 * - POST /:orderId/state - Update logistics state (LOGISTICS only)
 * - POST /:orderId/simulate - Simulate movement (LOGISTICS, dev only)
 * 
 * POLLING BEHAVIOR:
 * Frontend should poll GET /:orderId every 5-10 seconds for real-time updates.
 * All location data comes from the backend - no client-side location faking.
 */

// ============================================
// PUBLIC ROUTES
// ============================================

// Get logistics states info (FSM configuration)
router.get('/states', getStatesInfo);

// ============================================
// PROTECTED ROUTES
// ============================================

// All subsequent routes require authentication
router.use(authenticateUser);

// Get driver's active tracking (must be before /:orderId to avoid conflict)
router.get('/active', authorizeRoles('LOGISTICS'), getDriverActiveTracking);

// Get tracking for an order (any order participant)
router.get('/:orderId', getTracking);

// Initialize tracking for an order (driver only)
router.post(
  '/:orderId/initialize',
  authorizeRoles('LOGISTICS'),
  initializeTracking
);

// Update driver location (driver only)
router.post(
  '/:orderId/location',
  authorizeRoles('LOGISTICS'),
  updateDriverLocation
);

// Update logistics state (driver only)
router.post(
  '/:orderId/state',
  authorizeRoles('LOGISTICS'),
  updateState
);

// Simulate driver movement (driver only, dev/test only)
router.post(
  '/:orderId/simulate',
  authorizeRoles('LOGISTICS'),
  simulateMovement
);

module.exports = router;

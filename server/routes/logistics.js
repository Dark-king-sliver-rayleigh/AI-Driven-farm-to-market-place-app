const express = require('express');
const router = express.Router();
const {
  getAvailableOrders,
  getMyDeliveries,
  getPendingReassignment,
  getDelayedDeliveries,
  acceptOrder,
  rejectOrder,
  updateDeliveryStatus,
  initiateReassignment,
  acceptReassignment,
  getDeliveryEvents
} = require('../controllers/deliveryController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

/**
 * Logistics Routes - Enhanced Version
 * 
 * NEW ENDPOINTS:
 * - GET /pending-reassignment - Get deliveries awaiting reassignment
 * - GET /delayed - Get delayed deliveries
 * - POST /deliveries/:id/reassign - Initiate reassignment
 * - POST /deliveries/:id/accept-reassignment - Accept reassignment
 * - GET /deliveries/:id/events - Get audit trail
 */

// All routes require authentication and LOGISTICS role
router.use(authenticateUser);
router.use(authorizeRoles('LOGISTICS'));

// Get available orders for pickup
router.get('/orders', getAvailableOrders);

// Get my deliveries
router.get('/my-deliveries', getMyDeliveries);

// Get deliveries pending reassignment
router.get('/pending-reassignment', getPendingReassignment);

// Get delayed deliveries
router.get('/delayed', getDelayedDeliveries);

// Accept an order
router.post('/orders/:orderId/accept', acceptOrder);

// Reject an order
router.post('/orders/:orderId/reject', rejectOrder);

// Update delivery status
router.patch('/orders/:orderId/status', updateDeliveryStatus);

// === REASSIGNMENT ENDPOINTS ===

// Initiate reassignment for a delayed delivery
router.post('/deliveries/:id/reassign', initiateReassignment);

// Accept a reassigned delivery
router.post('/deliveries/:id/accept-reassignment', acceptReassignment);

// === AUDIT TRAIL ===

// Get delivery audit trail/events
router.get('/deliveries/:id/events', getDeliveryEvents);

module.exports = router;

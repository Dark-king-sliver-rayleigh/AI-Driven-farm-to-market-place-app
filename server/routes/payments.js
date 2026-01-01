const express = require('express');
const router = express.Router();
const {
  initiatePayment,
  confirmPayment,
  getPaymentByOrder,
  getMyPayments
} = require('../controllers/paymentController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

/**
 * Payment Routes
 * 
 * ACADEMIC PURPOSE:
 * Mock UPI payment workflow for demonstration.
 * NOT a real payment gateway integration.
 * 
 * ENDPOINTS:
 * POST /api/payments/initiate - Initiate payment (CONSUMER)
 * POST /api/payments/confirm - Confirm payment (CONSUMER)
 * GET /api/payments/order/:orderId - Get payment by order
 * GET /api/payments/my-payments - Get consumer's payments
 */

// All routes require authentication
router.use(authenticateUser);

/**
 * POST /api/payments/initiate
 * Initiate a UPI payment for an order
 * Access: CONSUMER only
 */
router.post('/initiate', authorizeRoles('CONSUMER'), initiatePayment);

/**
 * POST /api/payments/confirm
 * Confirm a payment (simulated callback)
 * Access: CONSUMER only
 */
router.post('/confirm', authorizeRoles('CONSUMER'), confirmPayment);

/**
 * GET /api/payments/order/:orderId
 * Get payment status for a specific order
 * Access: CONSUMER, FARMER (parties to the order)
 */
router.get('/order/:orderId', authorizeRoles('CONSUMER', 'FARMER'), getPaymentByOrder);

/**
 * GET /api/payments/my-payments
 * Get all payments made by the consumer
 * Access: CONSUMER only
 */
router.get('/my-payments', authorizeRoles('CONSUMER'), getMyPayments);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  submitFeedback,
  getFarmerFeedback,
  getLogisticsFeedback,
  getOrderFeedback,
  getSentimentAnalytics
} = require('../controllers/feedbackController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateUser);

// Consumer submits feedback
router.post('/', authorizeRoles('CONSUMER'), submitFeedback);

// Get feedback by order ID
router.get('/:orderId', getOrderFeedback);

// Farmer views their feedback
router.get('/farmer/all', authorizeRoles('FARMER'), getFarmerFeedback);

// Logistics views their feedback
router.get('/logistics/all', authorizeRoles('LOGISTICS'), getLogisticsFeedback);

// AI Sentiment analytics for farmer
router.get('/farmer/sentiment', authorizeRoles('FARMER'), getSentimentAnalytics);

module.exports = router;

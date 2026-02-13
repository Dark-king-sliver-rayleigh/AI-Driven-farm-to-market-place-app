const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeRoles } = require('../middleware/auth');
const cropRecommendationController = require('../controllers/cropRecommendationController');

// GET /api/crop-recommendation?location=Karnataka&season=kharif
// Protected: Only farmers can access crop recommendations
router.get('/', authenticateUser, authorizeRoles('FARMER'), cropRecommendationController.getRecommendations);

module.exports = router;

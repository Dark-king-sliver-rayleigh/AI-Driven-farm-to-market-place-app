const express = require('express');
const router = express.Router();
const {
  getDemandForecast,
  triggerForecastGeneration
} = require('../controllers/demandForecastController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

/**
 * Demand Forecast Routes
 *
 * All endpoints require authentication + FARMER role.
 *
 * GET  /api/farmer/demand-forecast             - Get latest forecast
 * POST /api/farmer/demand-forecast/generate    - Trigger regeneration
 */

router.use(authenticateUser);
router.use(authorizeRoles('FARMER'));

router.get('/demand-forecast', getDemandForecast);
router.post('/demand-forecast/generate', triggerForecastGeneration);

module.exports = router;

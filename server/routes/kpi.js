const express = require('express');
const router = express.Router();
const {
  getKPISummary,
  getOnTimePercentage,
  getAvgDistance,
  getCapacityUtilization,
  getKPITimeSeries
} = require('../controllers/kpiController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

/**
 * Logistics KPI Routes
 *
 * All endpoints require authentication + LOGISTICS role.
 *
 * GET /api/logistics/kpi/summary               - Full KPI summary
 * GET /api/logistics/kpi/on-time               - On-time delivery %
 * GET /api/logistics/kpi/avg-distance           - Average distance per order
 * GET /api/logistics/kpi/capacity-utilization   - Capacity utilization %
 * GET /api/logistics/kpi/time-series            - Time-series breakdown
 */

router.use(authenticateUser);
router.use(authorizeRoles('LOGISTICS'));

router.get('/summary', getKPISummary);
router.get('/on-time', getOnTimePercentage);
router.get('/avg-distance', getAvgDistance);
router.get('/capacity-utilization', getCapacityUtilization);
router.get('/time-series', getKPITimeSeries);

module.exports = router;

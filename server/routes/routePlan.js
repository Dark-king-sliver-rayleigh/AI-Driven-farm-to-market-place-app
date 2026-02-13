const express = require('express');
const router = express.Router();
const {
  createRoutePlan,
  getRoutePlan,
  listRoutePlans,
  assignRoutePlan,
  updateStopStatus
} = require('../controllers/routePlanController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

/**
 * Route Plan Routes
 *
 * All endpoints require authentication + LOGISTICS role.
 *
 * POST   /api/logistics/routes/plan              - Generate a new route plan
 * GET    /api/logistics/routes                    - List route plans (filters)
 * GET    /api/logistics/routes/:id                - Get single route plan
 * POST   /api/logistics/routes/:id/assign         - Assign driver
 * PATCH  /api/logistics/routes/:id/stops/:stopId/status - Update stop status
 */

router.use(authenticateUser);
router.use(authorizeRoles('LOGISTICS'));

router.post('/plan', createRoutePlan);
router.get('/', listRoutePlans);
router.get('/:id', getRoutePlan);
router.post('/:id/assign', assignRoutePlan);
router.patch('/:id/stops/:stopId/status', updateStopStatus);

module.exports = router;

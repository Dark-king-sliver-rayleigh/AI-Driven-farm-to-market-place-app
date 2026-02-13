const RoutePlanningService = require('../services/RoutePlanningService');
const RoutePlan = require('../models/RoutePlan');

/**
 * Route Plan Controller
 *
 * Handles creation, retrieval, assignment, and stop-status updates for
 * milk-run style delivery route plans.
 *
 * All endpoints require LOGISTICS role.
 */

/**
 * @desc    Generate a new route plan from a set of orders
 * @route   POST /api/logistics/routes/plan
 * @access  Private (LOGISTICS)
 *
 * Body: { orderIds: [string], driverId?: string, origin?: {lat,lng},
 *         vehicleCapacityKg?: number, date?: string }
 */
const createRoutePlan = async (req, res) => {
  try {
    const { orderIds, driverId, origin, vehicleCapacityKg, date } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'orderIds array is required and must not be empty'
      });
    }

    const plan = await RoutePlanningService.generatePlan({
      orderIds,
      driverId: driverId || null,
      origin: origin || null,
      vehicleCapacityKg: vehicleCapacityKg || null,
      date: date || null,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Route plan created',
      routePlan: plan
    });
  } catch (error) {
    console.error('createRoutePlan error:', error);
    res.status(error.message.includes('not found') || error.message.includes('No eligible') ? 400 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get a route plan by ID
 * @route   GET /api/logistics/routes/:id
 * @access  Private (LOGISTICS)
 */
const getRoutePlan = async (req, res) => {
  try {
    const plan = await RoutePlanningService.getPlan(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Route plan not found'
      });
    }

    res.status(200).json({
      success: true,
      routePlan: plan
    });
  } catch (error) {
    console.error('getRoutePlan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching route plan'
    });
  }
};

/**
 * @desc    List route plans (with optional filters)
 * @route   GET /api/logistics/routes
 * @access  Private (LOGISTICS)
 *
 * Query: status, driverId, from, to
 */
const listRoutePlans = async (req, res) => {
  try {
    const { status, driverId, from, to } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (driverId) filter.driverId = driverId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const plans = await RoutePlan.find(filter)
      .populate('driverId', 'name phone vehicleType')
      .sort({ date: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      count: plans.length,
      routePlans: plans
    });
  } catch (error) {
    console.error('listRoutePlans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while listing route plans'
    });
  }
};

/**
 * @desc    Assign a driver to a route plan
 * @route   POST /api/logistics/routes/:id/assign
 * @access  Private (LOGISTICS)
 *
 * Body: { driverId: string }
 */
const assignRoutePlan = async (req, res) => {
  try {
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: 'driverId is required'
      });
    }

    const plan = await RoutePlanningService.assignDriver(req.params.id, driverId);

    res.status(200).json({
      success: true,
      message: 'Driver assigned to route plan',
      routePlan: plan
    });
  } catch (error) {
    console.error('assignRoutePlan error:', error);
    const status = error.message.includes('not found') ? 404
      : error.message.includes('Cannot') || error.message.includes('Invalid') ? 400
      : 500;
    res.status(status).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Update the status of a stop in a route plan
 * @route   PATCH /api/logistics/routes/:id/stops/:stopId/status
 * @access  Private (LOGISTICS)
 *
 * Body: { status: string, remarks?: string }
 */
const updateStopStatus = async (req, res) => {
  try {
    const { id, stopId } = req.params;
    const { status, remarks } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'status is required'
      });
    }

    const plan = await RoutePlanningService.updateStopStatus(id, stopId, status, remarks);

    res.status(200).json({
      success: true,
      message: `Stop status updated to ${status}`,
      routePlan: plan
    });
  } catch (error) {
    console.error('updateStopStatus error:', error);
    const statusCode = error.message.includes('not found') ? 404
      : error.message.includes('Invalid') ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createRoutePlan,
  getRoutePlan,
  listRoutePlans,
  assignRoutePlan,
  updateStopStatus
};

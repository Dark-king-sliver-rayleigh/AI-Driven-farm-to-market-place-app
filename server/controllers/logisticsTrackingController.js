const LogisticsTrackingService = require('../services/LogisticsTrackingService');
const LogisticsTracking = require('../models/LogisticsTracking');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');

/**
 * Logistics Tracking Controller
 * 
 * PURPOSE:
 * HTTP handlers for real-time logistics tracking endpoints.
 * Provides APIs for:
 * - Fetching current tracking state (polling endpoint)
 * - Updating driver location
 * - Transitioning logistics states
 * - Initializing tracking when driver is assigned
 * 
 * API DESIGN:
 * All location updates come from the backend. Frontend NEVER computes fake locations.
 * State transitions are validated server-side to ensure delivery lifecycle integrity.
 */

/**
 * @desc    Get tracking data for an order
 * @route   GET /api/logistics/tracking/:orderId
 * @access  Private (CONSUMER, FARMER, LOGISTICS - order participants only)
 * 
 * POLLING ENDPOINT:
 * Frontend calls this every 5-10 seconds for real-time updates.
 * Returns current driver location, ETA, distance, and logistics state.
 */
const getTracking = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    // Fetch order to verify access
    const order = await Order.findById(orderId);
    if (!order) {
      return next(AppError.notFound('Order'));
    }
    
    // Authorization: Only order participants can view tracking
    const isConsumer = order.consumerId.toString() === userId.toString();
    const isFarmer = order.farmerId.toString() === userId.toString();
    const isLogistics = userRole === 'LOGISTICS';
    
    if (!isConsumer && !isFarmer && !isLogistics) {
      return next(AppError.forbidden('You are not authorized to view this tracking'));
    }
    
    // Get tracking data
    const tracking = await LogisticsTrackingService.getTracking(orderId);
    
    if (!tracking) {
      return res.status(200).json({
        success: true,
        tracking: null,
        message: 'Tracking not yet initialized for this order'
      });
    }
    
    res.status(200).json({
      success: true,
      tracking
    });
  } catch (error) {
    console.error('Get tracking error:', error);
    next(AppError.serverError('Error fetching tracking data'));
  }
};

/**
 * @desc    Initialize tracking for an order (when driver accepts)
 * @route   POST /api/logistics/tracking/:orderId/initialize
 * @access  Private (LOGISTICS only)
 * 
 * Called automatically when a driver accepts an order.
 * Creates tracking document with route information.
 */
const initializeTracking = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const driverId = req.user._id;
    
    // Verify order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return next(AppError.notFound('Order'));
    }
    
    // Verify delivery exists and is assigned to this driver
    const delivery = await Delivery.findOne({ orderId });
    if (!delivery) {
      return next(AppError.notFound('Delivery'));
    }
    
    if (delivery.driverId.toString() !== driverId.toString()) {
      return next(AppError.forbidden('You are not assigned to this delivery'));
    }
    
    // Check if tracking already exists
    const existingTracking = await LogisticsTracking.findOne({ orderId });
    if (existingTracking) {
      return res.status(200).json({
        success: true,
        tracking: existingTracking.toTrackingResponse(),
        message: 'Tracking already initialized'
      });
    }
    
    // Initialize tracking
    const tracking = await LogisticsTrackingService.initializeTracking(
      orderId,
      delivery._id,
      driverId
    );
    
    res.status(201).json({
      success: true,
      tracking,
      message: 'Tracking initialized successfully'
    });
  } catch (error) {
    console.error('Initialize tracking error:', error);
    next(AppError.serverError(error.message || 'Error initializing tracking'));
  }
};

/**
 * @desc    Update driver location
 * @route   POST /api/logistics/tracking/:orderId/location
 * @access  Private (LOGISTICS only - assigned driver)
 * 
 * DRIVER LOCATION UPDATE ENDPOINT:
 * Called by driver's device every 5-10 seconds with GPS coordinates.
 * This is the ONLY way driver position updates - no client-side faking.
 * 
 * Request body:
 * {
 *   "lat": number,
 *   "lng": number,
 *   "routeIndex": number (optional - current position in route)
 * }
 */
const updateDriverLocation = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { lat, lng, routeIndex } = req.body;
    const driverId = req.user._id;
    
    // Validate coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return next(AppError.badRequest('Valid latitude and longitude are required'));
    }
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return next(AppError.badRequest('Coordinates out of valid range'));
    }
    
    // Verify tracking exists and driver is assigned
    const tracking = await LogisticsTracking.findOne({ orderId });
    if (!tracking) {
      return next(AppError.notFound('Tracking'));
    }
    
    if (tracking.driverId.toString() !== driverId.toString()) {
      return next(AppError.forbidden('You are not assigned to this delivery'));
    }
    
    // Update location
    const updatedTracking = await LogisticsTrackingService.updateDriverLocation(
      orderId,
      { lat, lng },
      routeIndex
    );
    
    res.status(200).json({
      success: true,
      tracking: updatedTracking
    });
  } catch (error) {
    console.error('Update driver location error:', error);
    next(AppError.serverError(error.message || 'Error updating location'));
  }
};

/**
 * @desc    Update logistics state
 * @route   POST /api/logistics/tracking/:orderId/state
 * @access  Private (LOGISTICS only - assigned driver)
 * 
 * STATE TRANSITION ENDPOINT:
 * Transitions the delivery through the FSM states.
 * Validates that the transition is allowed before applying.
 * 
 * Request body:
 * {
 *   "state": "PICKUP_STARTED" | "PICKUP_COMPLETED" | "IN_TRANSIT" | "NEAR_DESTINATION" | "DELIVERED",
 *   "remarks": string (optional)
 * }
 */
const updateState = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { state, remarks } = req.body;
    const driverId = req.user._id;
    
    // Validate state
    if (!state) {
      return next(AppError.badRequest('State is required'));
    }
    
    const validStates = LogisticsTracking.getAllStates();
    if (!validStates.includes(state)) {
      return next(AppError.badRequest(
        `Invalid state. Must be one of: ${validStates.join(', ')}`
      ));
    }
    
    // Verify tracking exists and driver is assigned
    const tracking = await LogisticsTracking.findOne({ orderId });
    if (!tracking) {
      return next(AppError.notFound('Tracking'));
    }
    
    if (tracking.driverId.toString() !== driverId.toString()) {
      return next(AppError.forbidden('You are not assigned to this delivery'));
    }
    
    // Validate transition
    if (!LogisticsTracking.isValidTransition(tracking.currentState, state)) {
      const allowed = LogisticsTracking.getAllowedTransitions(tracking.currentState);
      return next(AppError.invalidTransition(
        tracking.currentState,
        state,
        allowed
      ));
    }
    
    // Update state
    const updatedTracking = await LogisticsTrackingService.updateState(
      orderId,
      state,
      { remarks }
    );
    
    // If delivered, also update delivery and order status
    if (state === 'DELIVERED') {
      await Delivery.findByIdAndUpdate(tracking.deliveryId, {
        deliveryStatus: 'DELIVERED',
        $push: {
          deliveryEvents: {
            eventType: 'COMPLETED',
            fromStatus: 'IN_TRANSIT',
            toStatus: 'DELIVERED',
            driverId,
            performedByRole: 'LOGISTICS',
            performedBy: driverId,
            remarks: remarks || 'Order delivered successfully'
          }
        }
      });
      
      await Order.findByIdAndUpdate(orderId, {
        orderStatus: 'DELIVERED'
      });
    }
    
    res.status(200).json({
      success: true,
      tracking: updatedTracking,
      message: `State updated to ${state}`
    });
  } catch (error) {
    console.error('Update state error:', error);
    
    if (error.message.includes('Invalid state transition')) {
      return next(AppError.badRequest(error.message));
    }
    
    next(AppError.serverError(error.message || 'Error updating state'));
  }
};

/**
 * @desc    Simulate driver movement (FOR TESTING ONLY)
 * @route   POST /api/logistics/tracking/:orderId/simulate
 * @access  Private (LOGISTICS only)
 * 
 * WARNING: This endpoint is for development/testing only.
 * In production, real GPS updates come from driver's device.
 * 
 * Request body:
 * {
 *   "steps": number (default: 1) - number of route points to advance
 * }
 */
const simulateMovement = async (req, res, next) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return next(AppError.forbidden('Simulation not allowed in production'));
    }
    
    const { orderId } = req.params;
    const { steps = 1 } = req.body;
    const driverId = req.user._id;
    
    // Verify tracking exists and driver is assigned
    const tracking = await LogisticsTracking.findOne({ orderId });
    if (!tracking) {
      return next(AppError.notFound('Tracking'));
    }
    
    if (tracking.driverId.toString() !== driverId.toString()) {
      return next(AppError.forbidden('You are not assigned to this delivery'));
    }
    
    // Simulate movement
    const updatedTracking = await LogisticsTrackingService.simulateDriverMovement(
      orderId,
      steps
    );
    
    res.status(200).json({
      success: true,
      tracking: updatedTracking,
      message: `Driver moved ${steps} step(s) along route`
    });
  } catch (error) {
    console.error('Simulate movement error:', error);
    next(AppError.serverError(error.message || 'Error simulating movement'));
  }
};

/**
 * @desc    Get all active tracking for logged-in driver
 * @route   GET /api/logistics/tracking/active
 * @access  Private (LOGISTICS only)
 */
const getDriverActiveTracking = async (req, res, next) => {
  try {
    const driverId = req.user._id;
    
    const trackings = await LogisticsTrackingService.getDriverActiveTracking(driverId);
    
    res.status(200).json({
      success: true,
      count: trackings.length,
      trackings
    });
  } catch (error) {
    console.error('Get driver active tracking error:', error);
    next(AppError.serverError('Error fetching active tracking'));
  }
};

/**
 * @desc    Get tracking for consumer's orders
 * @route   GET /api/orders/tracking
 * @access  Private (CONSUMER only)
 * 
 * Query params:
 * - activeOnly: boolean (default: false)
 */
const getConsumerTracking = async (req, res, next) => {
  try {
    const consumerId = req.user._id;
    const { activeOnly } = req.query;
    
    const trackings = await LogisticsTrackingService.getConsumerTracking(
      consumerId,
      activeOnly === 'true'
    );
    
    res.status(200).json({
      success: true,
      count: trackings.length,
      trackings
    });
  } catch (error) {
    console.error('Get consumer tracking error:', error);
    next(AppError.serverError('Error fetching tracking'));
  }
};

/**
 * @desc    Get tracking state machine info
 * @route   GET /api/logistics/tracking/states
 * @access  Public
 * 
 * Returns all logistics states with their display messages and marker colors.
 * Useful for frontend to know valid states without hardcoding.
 */
const getStatesInfo = async (req, res) => {
  const states = LogisticsTracking.getAllStates();
  
  const statesInfo = states.map(state => ({
    state,
    message: LogisticsTracking.getStateMessage(state),
    markerColor: LogisticsTracking.getMarkerColor(state),
    allowedTransitions: LogisticsTracking.getAllowedTransitions(state)
  }));
  
  res.status(200).json({
    success: true,
    states: statesInfo,
    nearDestinationThreshold: LogisticsTracking.getNearDestinationThreshold()
  });
};

module.exports = {
  getTracking,
  initializeTracking,
  updateDriverLocation,
  updateState,
  simulateMovement,
  getDriverActiveTracking,
  getConsumerTracking,
  getStatesInfo
};

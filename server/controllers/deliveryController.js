const Delivery = require('../models/Delivery');
const Order = require('../models/Order');

/**
 * Delivery Controller - Enhanced Version
 * 
 * ENHANCEMENTS:
 * 1. Audit trail logging on every status change
 * 2. SLA calculation and expected delivery time
 * 3. Delay detection on status updates
 * 4. Backup reassignment for delayed deliveries
 * 
 * ACADEMIC NOTE:
 * All operations are logged for traceability and compliance.
 */

/**
 * @desc    Get available orders (status = CREATED) for logistics
 * @route   GET /api/logistics/orders
 * @access  Private (LOGISTICS only)
 */
const getAvailableOrders = async (req, res) => {
  try {
    const { status } = req.query;

    // Build query
    const query = {};
    if (status) {
      query.orderStatus = status;
    } else {
      // Default: show CREATED orders (available for pickup)
      query.orderStatus = 'CREATED';
    }

    const orders = await Order.find(query)
      .populate('consumerId', 'name phone')
      .populate('farmerId', 'name phone')
      .populate('items.productId', 'name unit')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('Get available orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders'
    });
  }
};

/**
 * @desc    Get orders assigned to logged-in driver
 * @route   GET /api/logistics/my-deliveries
 * @access  Private (LOGISTICS only)
 */
const getMyDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find({ driverId: req.user._id })
      .populate({
        path: 'orderId',
        populate: [
          { path: 'consumerId', select: 'name phone' },
          { path: 'farmerId', select: 'name phone' },
          { path: 'items.productId', select: 'name unit' }
        ]
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: deliveries.length,
      deliveries
    });
  } catch (error) {
    console.error('Get my deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching deliveries'
    });
  }
};

/**
 * @desc    Get deliveries pending reassignment
 * @route   GET /api/logistics/pending-reassignment
 * @access  Private (LOGISTICS only)
 */
const getPendingReassignment = async (req, res) => {
  try {
    const deliveries = await Delivery.find({ 
      deliveryStatus: 'PENDING_REASSIGNMENT' 
    })
      .populate({
        path: 'orderId',
        populate: [
          { path: 'consumerId', select: 'name phone' },
          { path: 'farmerId', select: 'name phone' }
        ]
      })
      .populate('previousDriverId', 'name phone')
      .sort({ delayDetectedAt: -1 });

    res.status(200).json({
      success: true,
      count: deliveries.length,
      deliveries
    });
  } catch (error) {
    console.error('Get pending reassignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching deliveries'
    });
  }
};

/**
 * @desc    Get delayed deliveries
 * @route   GET /api/logistics/delayed
 * @access  Private (LOGISTICS only)
 */
const getDelayedDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find({ 
      isDelayed: true,
      deliveryStatus: { $nin: ['DELIVERED', 'FAILED'] }
    })
      .populate({
        path: 'orderId',
        populate: [
          { path: 'consumerId', select: 'name phone' },
          { path: 'farmerId', select: 'name phone' }
        ]
      })
      .populate('driverId', 'name phone')
      .sort({ delayDetectedAt: -1 });

    res.status(200).json({
      success: true,
      count: deliveries.length,
      deliveries
    });
  } catch (error) {
    console.error('Get delayed deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching delayed deliveries'
    });
  }
};

/**
 * @desc    Accept an order (create delivery)
 * @route   POST /api/logistics/orders/:orderId/accept
 * @access  Private (LOGISTICS only)
 * 
 * ENHANCEMENTS:
 * - Calculates expected delivery time based on distance
 * - Logs CREATED event to audit trail
 */
const acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { pickupLocation, dropLocation, distance } = req.body;

    // Validate required fields
    if (!pickupLocation || !pickupLocation.address) {
      return res.status(400).json({
        success: false,
        message: 'Pickup location with address is required'
      });
    }

    if (!dropLocation || !dropLocation.address) {
      return res.status(400).json({
        success: false,
        message: 'Drop location with address is required'
      });
    }

    // Find order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order is available
    if (order.orderStatus !== 'CREATED') {
      return res.status(400).json({
        success: false,
        message: `Order cannot be accepted. Current status: ${order.orderStatus}`
      });
    }

    // PAYMENT VALIDATION:
    // Logistics assignment allowed only if:
    // - paymentStatus = PAID (for ONLINE payments)
    // - OR paymentMode = COD
    if (order.paymentMode === 'ONLINE' && order.paymentStatus !== 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign delivery. Payment is not completed.',
        paymentMode: order.paymentMode,
        paymentStatus: order.paymentStatus,
        hint: 'Consumer must complete payment before logistics assignment'
      });
    }

    // Check if delivery already exists
    const existingDelivery = await Delivery.findOne({ orderId });
    if (existingDelivery) {
      return res.status(400).json({
        success: false,
        message: 'Order already has a delivery assigned'
      });
    }

    // Calculate expected delivery time based on distance
    const expectedDeliveryTime = Delivery.calculateExpectedDeliveryTime(distance || 0);

    // Create delivery with audit trail
    const delivery = new Delivery({
      orderId,
      driverId: req.user._id,
      pickupLocation,
      dropLocation,
      distance,
      deliveryStatus: 'ASSIGNED',
      expectedDeliveryTime,
      lastUpdatedByRole: 'LOGISTICS',
      lastSyncedAt: new Date()
    });

    // Add CREATED event to audit trail
    delivery.addEvent({
      eventType: 'CREATED',
      toStatus: 'ASSIGNED',
      performedByRole: 'LOGISTICS',
      performedBy: req.user._id,
      remarks: `Delivery accepted by driver. Expected delivery: ${expectedDeliveryTime.toISOString()}`
    });

    await delivery.save();

    // Update order status
    order.orderStatus = 'ASSIGNED';
    order.lastUpdatedByRole = 'LOGISTICS';
    order.lastSyncedAt = new Date();
    await order.save();

    // Populate and return
    const populatedDelivery = await Delivery.findById(delivery._id)
      .populate({
        path: 'orderId',
        populate: [
          { path: 'consumerId', select: 'name phone' },
          { path: 'farmerId', select: 'name phone' }
        ]
      });

    res.status(201).json({
      success: true,
      message: 'Order accepted successfully',
      delivery: populatedDelivery
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Order already has a delivery assigned'
      });
    }

    console.error('Accept order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while accepting order'
    });
  }
};

/**
 * @desc    Reject an order (just log, order stays in pool)
 * @route   POST /api/logistics/orders/:orderId/reject
 * @access  Private (LOGISTICS only)
 */
const rejectOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    // Find order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Log rejection (could be expanded to track rejections)
    console.log(`Order ${orderId} rejected by driver ${req.user._id}. Reason: ${reason || 'Not specified'}`);

    res.status(200).json({
      success: true,
      message: 'Order rejected. It remains available for other drivers.'
    });
  } catch (error) {
    console.error('Reject order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rejecting order'
    });
  }
};

/**
 * @desc    Update delivery status
 * @route   PATCH /api/logistics/orders/:orderId/status
 * @access  Private (LOGISTICS only)
 * 
 * ENHANCEMENTS:
 * - Logs STATUS_CHANGE event to audit trail
 * - Checks for delay on every update
 * - Adds DELAYED event if delay detected
 */
const updateDeliveryStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, remarks } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Find delivery
    const delivery = await Delivery.findOne({ orderId });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found for this order'
      });
    }

    // Check ownership
    if (delivery.driverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this delivery'
      });
    }

    // Idempotent update: if same status, return success without changes
    if (delivery.deliveryStatus === status) {
      return res.status(200).json({
        success: true,
        message: 'Status unchanged (idempotent)',
        delivery: {
          _id: delivery._id,
          deliveryStatus: delivery.deliveryStatus
        }
      });
    }

    // Validate status transition
    if (!Delivery.isValidTransition(delivery.deliveryStatus, status)) {
      const allowed = Delivery.getAllowedTransitions(delivery.deliveryStatus);
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${delivery.deliveryStatus} to ${status}`,
        allowedTransitions: allowed
      });
    }

    const previousStatus = delivery.deliveryStatus;

    // Check for delay BEFORE status update
    const wasDelayed = delivery.checkAndMarkDelay();

    // Add STATUS_CHANGE event to audit trail
    delivery.addEvent({
      eventType: 'STATUS_CHANGE',
      fromStatus: previousStatus,
      toStatus: status,
      performedByRole: 'LOGISTICS',
      performedBy: req.user._id,
      remarks: remarks || `Status changed from ${previousStatus} to ${status}`
    });

    // Update delivery status with resilience fields
    delivery.deliveryStatus = status;
    delivery.lastUpdatedByRole = 'LOGISTICS';
    delivery.lastSyncedAt = new Date();

    // If completed, add COMPLETED event
    if (status === 'DELIVERED') {
      delivery.addEvent({
        eventType: 'COMPLETED',
        fromStatus: previousStatus,
        toStatus: 'DELIVERED',
        performedByRole: 'LOGISTICS',
        performedBy: req.user._id,
        remarks: 'Delivery completed successfully'
      });
    }

    // If failed, add FAILED event
    if (status === 'FAILED') {
      delivery.addEvent({
        eventType: 'FAILED',
        fromStatus: previousStatus,
        toStatus: 'FAILED',
        performedByRole: 'LOGISTICS',
        performedBy: req.user._id,
        remarks: remarks || 'Delivery failed'
      });
    }

    await delivery.save();

    // Sync order status with resilience fields
    const order = await Order.findById(orderId);
    if (order) {
      const newOrderStatus = Delivery.getOrderStatus(status);
      if (newOrderStatus && Order.isValidTransition(order.orderStatus, newOrderStatus)) {
        order.orderStatus = newOrderStatus;
        order.lastUpdatedByRole = 'LOGISTICS';
        order.lastSyncedAt = new Date();
        await order.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Delivery status updated successfully',
      delivery: {
        _id: delivery._id,
        deliveryStatus: delivery.deliveryStatus,
        isDelayed: delivery.isDelayed,
        expectedDeliveryTime: delivery.expectedDeliveryTime
      },
      order: {
        _id: order._id,
        orderStatus: order.orderStatus
      },
      delayDetected: wasDelayed
    });
  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating delivery status'
    });
  }
};

/**
 * @desc    Initiate reassignment for a delayed delivery
 * @route   POST /api/logistics/deliveries/:id/reassign
 * @access  Private (LOGISTICS only)
 * 
 * RULES:
 * - Only delayed deliveries can be reassigned
 * - Old driver is unassigned
 * - Delivery goes to PENDING_REASSIGNMENT status
 * - New driver must accept to complete reassignment
 * - REASSIGNED event is logged
 */
const initiateReassignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Find delivery
    const delivery = await Delivery.findById(id);

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    // Check if delivery can be reassigned
    if (!delivery.canBeReassigned()) {
      return res.status(400).json({
        success: false,
        message: 'Only delayed deliveries in non-terminal states can be reassigned',
        currentStatus: delivery.deliveryStatus,
        isDelayed: delivery.isDelayed
      });
    }

    const previousDriverId = delivery.driverId;
    const previousStatus = delivery.deliveryStatus;

    // Add REASSIGNED event to audit trail
    delivery.addEvent({
      eventType: 'REASSIGNED',
      fromStatus: previousStatus,
      toStatus: 'PENDING_REASSIGNMENT',
      driverId: previousDriverId,
      performedByRole: 'LOGISTICS',
      performedBy: req.user._id,
      remarks: reason || `Reassignment initiated due to delay. Previous driver: ${previousDriverId}`
    });

    // Update delivery for reassignment
    delivery.previousDriverId = previousDriverId;
    delivery.deliveryStatus = 'PENDING_REASSIGNMENT';
    delivery.reassignmentCount += 1;
    delivery.lastUpdatedByRole = 'LOGISTICS';
    delivery.lastSyncedAt = new Date();

    await delivery.save();

    res.status(200).json({
      success: true,
      message: 'Delivery marked for reassignment. Awaiting new driver acceptance.',
      delivery: {
        _id: delivery._id,
        deliveryStatus: delivery.deliveryStatus,
        previousDriverId: delivery.previousDriverId,
        reassignmentCount: delivery.reassignmentCount
      }
    });
  } catch (error) {
    console.error('Initiate reassignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while initiating reassignment'
    });
  }
};

/**
 * @desc    Accept a reassigned delivery
 * @route   POST /api/logistics/deliveries/:id/accept-reassignment
 * @access  Private (LOGISTICS only)
 * 
 * RULES:
 * - Only PENDING_REASSIGNMENT deliveries can be accepted
 * - New driver becomes the assigned driver
 * - Delivery goes back to ASSIGNED status
 * - Event logged to audit trail
 */
const acceptReassignment = async (req, res) => {
  try {
    const { id } = req.params;

    // Find delivery
    const delivery = await Delivery.findById(id);

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    // Check if delivery is pending reassignment
    if (delivery.deliveryStatus !== 'PENDING_REASSIGNMENT') {
      return res.status(400).json({
        success: false,
        message: 'Delivery is not pending reassignment',
        currentStatus: delivery.deliveryStatus
      });
    }

    // Cannot accept own reassignment
    if (delivery.previousDriverId && 
        delivery.previousDriverId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Previous driver cannot accept their own reassigned delivery'
      });
    }

    // Calculate new expected delivery time
    const newExpectedTime = Delivery.calculateExpectedDeliveryTime(delivery.distance || 0);

    // Add event to audit trail
    delivery.addEvent({
      eventType: 'STATUS_CHANGE',
      fromStatus: 'PENDING_REASSIGNMENT',
      toStatus: 'ASSIGNED',
      driverId: req.user._id,
      performedByRole: 'LOGISTICS',
      performedBy: req.user._id,
      remarks: `Reassignment accepted by new driver. New expected time: ${newExpectedTime.toISOString()}`
    });

    // Update delivery
    delivery.driverId = req.user._id;
    delivery.deliveryStatus = 'ASSIGNED';
    delivery.expectedDeliveryTime = newExpectedTime;
    delivery.isDelayed = false;  // Reset delay flag for new driver
    delivery.delayDetectedAt = null;
    delivery.lastUpdatedByRole = 'LOGISTICS';
    delivery.lastSyncedAt = new Date();

    await delivery.save();

    // Populate and return
    const populatedDelivery = await Delivery.findById(delivery._id)
      .populate({
        path: 'orderId',
        populate: [
          { path: 'consumerId', select: 'name phone' },
          { path: 'farmerId', select: 'name phone' }
        ]
      });

    res.status(200).json({
      success: true,
      message: 'Reassignment accepted successfully',
      delivery: populatedDelivery
    });
  } catch (error) {
    console.error('Accept reassignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while accepting reassignment'
    });
  }
};

/**
 * @desc    Get delivery audit trail
 * @route   GET /api/logistics/deliveries/:id/events
 * @access  Private (LOGISTICS only)
 */
const getDeliveryEvents = async (req, res) => {
  try {
    const { id } = req.params;

    const delivery = await Delivery.findById(id)
      .select('deliveryEvents orderId deliveryStatus isDelayed expectedDeliveryTime')
      .populate('deliveryEvents.driverId', 'name phone')
      .populate('deliveryEvents.performedBy', 'name');

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    res.status(200).json({
      success: true,
      deliveryId: delivery._id,
      currentStatus: delivery.deliveryStatus,
      isDelayed: delivery.isDelayed,
      expectedDeliveryTime: delivery.expectedDeliveryTime,
      eventCount: delivery.deliveryEvents.length,
      events: delivery.deliveryEvents
    });
  } catch (error) {
    console.error('Get delivery events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching delivery events'
    });
  }
};

module.exports = {
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
};

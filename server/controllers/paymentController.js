const Payment = require('../models/Payment');
const Order = require('../models/Order');

/**
 * Payment Controller
 * 
 * ACADEMIC PURPOSE:
 * Implements a SIMULATED UPI payment workflow for demonstration.
 * This is NOT a real payment gateway integration.
 * 
 * FRAUD DETECTION RULES (non-AI):
 * 1. Only one payment per order
 * 2. Amount must match order total exactly
 * 3. Duplicate confirmations are rejected
 * 4. Payer must be the order's consumer
 * 
 * All violations are logged but do NOT crash the system.
 */

/**
 * @desc    Initiate a payment for an order
 * @route   POST /api/payments/initiate
 * @access  Private (CONSUMER only)
 * 
 * Flow:
 * 1. Validate order exists and belongs to consumer
 * 2. Check for existing payment
 * 3. Verify amount matches order total
 * 4. Generate mock UPI transaction reference
 * 5. Create payment with INITIATED status
 */
const initiatePayment = async (req, res) => {
  try {
    const { orderId, amount, upiId } = req.body;
    const payerId = req.user._id;

    // Validate required fields
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment amount is required'
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

    // FRAUD RULE: Payer must be the order's consumer
    if (order.consumerId.toString() !== payerId.toString()) {
      console.log(`FRAUD ATTEMPT: User ${payerId} tried to pay for order ${orderId} belonging to ${order.consumerId}`);
      return res.status(403).json({
        success: false,
        message: 'You can only pay for your own orders'
      });
    }

    // FRAUD RULE: Only one payment per order
    const existingPayment = await Payment.findOne({ orderId });
    if (existingPayment) {
      if (existingPayment.status === 'SUCCESS') {
        return res.status(400).json({
          success: false,
          message: 'Order has already been paid',
          paymentId: existingPayment._id
        });
      }
      
      // If existing payment is INITIATED, allow retry
      if (existingPayment.status === 'INITIATED') {
        return res.status(200).json({
          success: true,
          message: 'Payment already initiated',
          payment: {
            _id: existingPayment._id,
            transactionRef: existingPayment.transactionRef,
            status: existingPayment.status,
            amount: existingPayment.amount
          }
        });
      }
    }

    // FRAUD RULE: Amount must match order total exactly
    if (amount !== order.totalAmount) {
      console.log(`FRAUD FLAG: Amount mismatch. Order: ${order.totalAmount}, Provided: ${amount}`);
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${amount}) does not match order total (₹${order.totalAmount})`,
        fraudFlag: 'AMOUNT_MISMATCH'
      });
    }

    // Check payment mode
    if (order.paymentMode === 'COD') {
      return res.status(400).json({
        success: false,
        message: 'This order is Cash on Delivery. No online payment needed.'
      });
    }

    // Generate mock UPI transaction reference
    const transactionRef = Payment.generateTransactionRef();

    // Create payment
    const payment = await Payment.create({
      orderId,
      payerId,
      amount,
      method: 'UPI',
      status: 'INITIATED',
      transactionRef,
      upiId: upiId || 'demo@upi',
      initiatedByRole: 'CONSUMER'
    });

    res.status(201).json({
      success: true,
      message: 'Payment initiated successfully',
      payment: {
        _id: payment._id,
        transactionRef: payment.transactionRef,
        status: payment.status,
        amount: payment.amount,
        upiId: payment.upiId
      },
      // Mock UPI deep link (for demonstration)
      mockUpiLink: `upi://pay?pa=${upiId || 'agrodirect@upi'}&pn=AgroDirect&am=${amount}&tr=${transactionRef}&cu=INR`
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Payment already exists for this order'
      });
    }

    console.error('Initiate payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while initiating payment'
    });
  }
};

/**
 * @desc    Confirm a payment (simulated)
 * @route   POST /api/payments/confirm
 * @access  Private (CONSUMER only)
 * 
 * Flow:
 * 1. Find payment by ID or transaction reference
 * 2. Validate payment can be confirmed
 * 3. Simulate SUCCESS or FAILED (based on flag)
 * 4. Update payment status
 * 5. Update order paymentStatus
 */
const confirmPayment = async (req, res) => {
  try {
    const { paymentId, transactionRef, simulateFailure } = req.body;

    if (!paymentId && !transactionRef) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID or transaction reference is required'
      });
    }

    // Find payment
    const query = paymentId ? { _id: paymentId } : { transactionRef };
    const payment = await Payment.findOne(query);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // FRAUD RULE: Only payer can confirm
    if (payment.payerId.toString() !== req.user._id.toString()) {
      console.log(`FRAUD ATTEMPT: User ${req.user._id} tried to confirm payment ${payment._id} belonging to ${payment.payerId}`);
      return res.status(403).json({
        success: false,
        message: 'You can only confirm your own payments'
      });
    }

    // FRAUD RULE: Check if payment can be confirmed
    const confirmCheck = payment.canBeConfirmed();
    if (!confirmCheck.canConfirm) {
      console.log(`FRAUD FLAG: Duplicate confirmation attempt for payment ${payment._id}`);
      return res.status(400).json({
        success: false,
        message: confirmCheck.reason,
        fraudFlag: 'DUPLICATE_CONFIRMATION'
      });
    }

    // Simulate payment result
    // In production, this would be a callback from the payment gateway
    const isSuccess = !simulateFailure;

    if (isSuccess) {
      payment.status = 'SUCCESS';
      payment.confirmedAt = new Date();
    } else {
      payment.status = 'FAILED';
      payment.failureReason = 'Simulated payment failure for testing';
    }

    await payment.save();

    // Update order payment status
    const order = await Order.findById(payment.orderId);
    if (order) {
      order.paymentStatus = isSuccess ? 'PAID' : 'FAILED';
      order.lastUpdatedByRole = 'SYSTEM';
      order.lastSyncedAt = new Date();
      await order.save();
    }

    res.status(200).json({
      success: true,
      message: isSuccess ? 'Payment confirmed successfully' : 'Payment failed',
      payment: {
        _id: payment._id,
        transactionRef: payment.transactionRef,
        status: payment.status,
        amount: payment.amount,
        confirmedAt: payment.confirmedAt
      },
      order: order ? {
        _id: order._id,
        paymentStatus: order.paymentStatus
      } : null
    });

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while confirming payment'
    });
  }
};

/**
 * @desc    Get payment status for an order
 * @route   GET /api/payments/order/:orderId
 * @access  Private (CONSUMER, FARMER)
 */
const getPaymentByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const payment = await Payment.findOne({ orderId })
      .populate('payerId', 'name phone');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'No payment found for this order'
      });
    }

    // Check access - only consumer or farmer of the order
    const order = await Order.findById(orderId);
    if (order) {
      const userId = req.user._id.toString();
      const isConsumer = order.consumerId.toString() === userId;
      const isFarmer = order.farmerId.toString() === userId;

      if (!isConsumer && !isFarmer) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this payment'
        });
      }
    }

    res.status(200).json({
      success: true,
      payment: {
        _id: payment._id,
        status: payment.status,
        amount: payment.amount,
        method: payment.method,
        transactionRef: payment.transactionRef,
        confirmedAt: payment.confirmedAt,
        createdAt: payment.createdAt
      }
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment'
    });
  }
};

/**
 * @desc    Get my payments
 * @route   GET /api/payments/my-payments
 * @access  Private (CONSUMER)
 */
const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ payerId: req.user._id })
      .populate('orderId', 'totalAmount orderStatus')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      payments
    });

  } catch (error) {
    console.error('Get my payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payments'
    });
  }
};

module.exports = {
  initiatePayment,
  confirmPayment,
  getPaymentByOrder,
  getMyPayments
};

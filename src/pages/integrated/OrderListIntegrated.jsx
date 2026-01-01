import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConsumerOrders, useOrderTimeline } from '../../hooks/useData';
import { orderAPI } from '../../services/api';

// Order status configuration
const STATUS_CONFIG = {
  PRE_ORDER: { label: 'Pre-Order', color: 'bg-indigo-100 text-indigo-800', icon: '📋', step: 0 },
  CREATED: { label: 'Order Placed', color: 'bg-blue-100 text-blue-800', icon: '✓', step: 1 },
  ASSIGNED: { label: 'Driver Assigned', color: 'bg-purple-100 text-purple-800', icon: '🚗', step: 2 },
  PICKED_UP: { label: 'Picked Up', color: 'bg-yellow-100 text-yellow-800', icon: '📦', step: 3 },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: '🎉', step: 4 },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: '❌', step: -1 },
  CANCELLED_BY_CONSUMER: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600', icon: '🚫', step: -1 }
};

const TIMELINE_STEPS = ['Order Placed', 'Driver Assigned', 'Picked Up', 'Delivered'];

/**
 * Order Timeline Component
 */
function OrderTimeline({ order, isExpanded }) {
  const { timeline, deliveryStatus, isDelayed, expectedDeliveryTime, loading } = useOrderTimeline(
    isExpanded ? order._id : null
  );

  const currentStatus = order.orderStatus;
  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.CREATED;
  const currentStep = config.step;

  if (!isExpanded) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      {/* Delay Warning */}
      {isDelayed && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-orange-700">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-medium">Delivery Delayed</p>
            <p className="text-sm">This order is taking longer than expected. We apologize for the inconvenience.</p>
          </div>
        </div>
      )}

      {/* Expected Delivery */}
      {expectedDeliveryTime && currentStep > 0 && currentStep < 4 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
          <p className="text-sm">
            <span className="font-medium">Expected Delivery:</span>{' '}
            {new Date(expectedDeliveryTime).toLocaleString()}
          </p>
        </div>
      )}

      {/* Visual Timeline */}
      {currentStep >= 0 && (
        <div className="relative">
          <div className="flex justify-between items-center">
            {TIMELINE_STEPS.map((step, idx) => {
              const stepNum = idx + 1;
              const isCompleted = currentStep >= stepNum;
              const isCurrent = currentStep === stepNum;

              return (
                <div key={step} className="flex-1 relative">
                  {/* Connector line */}
                  {idx > 0 && (
                    <div className={`absolute top-4 left-0 right-1/2 h-1 -translate-y-1/2 ${
                      currentStep >= stepNum ? 'bg-green-500' : 'bg-gray-200'
                    }`}></div>
                  )}
                  {idx < TIMELINE_STEPS.length - 1 && (
                    <div className={`absolute top-4 left-1/2 right-0 h-1 -translate-y-1/2 ${
                      currentStep > stepNum ? 'bg-green-500' : 'bg-gray-200'
                    }`}></div>
                  )}

                  {/* Step circle */}
                  <div className="flex flex-col items-center relative z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                      isCompleted 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : isCurrent 
                          ? 'bg-white border-green-500 text-green-600'
                          : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                      {isCompleted ? '✓' : stepNum}
                    </div>
                    <p className={`mt-2 text-xs text-center ${
                      isCompleted || isCurrent ? 'text-gray-900 font-medium' : 'text-gray-400'
                    }`}>
                      {step}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delivery Events Timeline */}
      {loading ? (
        <div className="mt-4 text-center text-gray-500 text-sm">Loading timeline...</div>
      ) : timeline && timeline.length > 0 ? (
        <div className="mt-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Delivery Updates</p>
          <div className="space-y-2">
            {timeline.map((event, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-green-500"></div>
                <div className="flex-1">
                  <p className="text-gray-800">{event.remarks || event.eventType}</p>
                  <p className="text-gray-400 text-xs">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * API-Integrated Consumer Orders List
 * Features: Order timeline, Cancel order, Delay indicators
 */
export function OrderListIntegrated() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { orders, loading, error, refetch } = useConsumerOrders();
  
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [updateError, setUpdateError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Check if order can be cancelled
  const canCancel = (order) => {
    const nonCancellable = ['PICKED_UP', 'DELIVERED', 'FAILED', 'CANCELLED_BY_CONSUMER'];
    return !nonCancellable.includes(order.orderStatus);
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    try {
      setCancelling(cancelModal._id);
      setUpdateError(null);
      await orderAPI.cancel(cancelModal._id, cancelReason);
      showSuccess('Order cancelled successfully. Product quantities restored.');
      setCancelModal(null);
      setCancelReason('');
      refetch();
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setCancelling(null);
    }
  };

  const toggleExpand = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-8 px-4 mb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">My Orders</h1>
              <p className="text-blue-200 mt-1">Track and manage your orders</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/consumer/home')}
                className="px-4 py-2 bg-white/20 text-white rounded-md hover:bg-white/30"
              >
                Browse Products
              </button>
              <button
                onClick={() => navigate('/consumer/profile')}
                className="px-4 py-2 bg-white/20 text-white rounded-md hover:bg-white/30"
              >
                Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
            <span>✓</span> {successMessage}
          </div>
        )}

        {/* Error Message */}
        {updateError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center justify-between">
            <span>{updateError}</span>
            <button onClick={() => setUpdateError(null)} className="underline text-sm">Dismiss</button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">Loading orders...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
            <button onClick={refetch} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm">
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && orders.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Yet</h3>
            <p className="text-gray-500 mb-6">Your orders will appear here after you make a purchase.</p>
            <button
              onClick={() => navigate('/consumer/home')}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Start Shopping
            </button>
          </div>
        )}

        {/* Orders List */}
        {!loading && !error && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => {
              const config = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.CREATED;
              const isExpanded = expandedOrder === order._id;

              return (
                <div 
                  key={order._id} 
                  className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
                    order.orderStatus === 'CANCELLED_BY_CONSUMER' ? 'opacity-75 border-gray-200' : 'border-gray-100'
                  }`}
                >
                  {/* Order Header */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleExpand(order._id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{config.icon}</span>
                        <div>
                          <div className="font-semibold text-gray-900">
                            Order #{order._id.slice(-8).toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(order.createdAt).toLocaleDateString()} • {order.farmerId?.name || 'Farmer'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Quick Summary */}
                    <div className="mt-3 flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        {order.items?.length} item{order.items?.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-lg font-bold text-green-600">₹{order.totalAmount}</div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      {/* Items */}
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Order Items</p>
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm py-1">
                            <span className="text-gray-700">
                              {item.productId?.name || 'Product'} × {item.quantity} {item.productId?.unit || ''}
                            </span>
                            <span className="text-gray-900 font-medium">₹{item.price * item.quantity}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-medium pt-2 border-t border-gray-200 mt-2">
                          <span>Total</span>
                          <span className="text-green-600">₹{order.totalAmount}</span>
                        </div>
                      </div>

                      {/* Payment Info */}
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                        <span className="flex items-center gap-1">
                          <span>💵</span> {order.paymentMode}
                        </span>
                        <span className="flex items-center gap-1">
                          <span>📅</span> {new Date(order.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {/* Timeline */}
                      <OrderTimeline order={order} isExpanded={isExpanded} />

                      {/* Actions */}
                      <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end gap-3">
                        {/* Cancel Button */}
                        {canCancel(order) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setCancelModal(order); }}
                            className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium"
                          >
                            Cancel Order
                          </button>
                        )}

                        {/* Cancellation Info */}
                        {order.orderStatus === 'CANCELLED_BY_CONSUMER' && order.cancelledAt && (
                          <div className="text-sm text-gray-500">
                            Cancelled on {new Date(order.cancelledAt).toLocaleDateString()}
                            {order.cancellationReason && ` - ${order.cancellationReason}`}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="text-center mb-4">
              <span className="text-4xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Cancel Order?</h3>
            <p className="text-gray-600 text-center mb-4">
              Are you sure you want to cancel order <strong>#{cancelModal._id.slice(-8).toUpperCase()}</strong>? 
              The product quantities will be restored.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why are you cancelling?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setCancelModal(null); setCancelReason(''); }}
                className="flex-1 px-4 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

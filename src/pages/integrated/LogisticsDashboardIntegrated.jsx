import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAvailableOrders, useMyDeliveries } from '../../hooks/useData';
import { logisticsAPI } from '../../services/api';

/**
 * API-Integrated Logistics Dashboard
 * Shows available orders and assigned deliveries
 */
export function LogisticsDashboardIntegrated() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('available');
  
  // API data
  const { orders: availableOrders, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useAvailableOrders();
  const { deliveries, loading: deliveriesLoading, error: deliveriesError, refetch: refetchDeliveries } = useMyDeliveries();

  // Action states
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const handleAcceptOrder = async (orderId) => {
    try {
      setActionLoading(orderId);
      setActionError(null);

      // For demo, use placeholder location data
      await logisticsAPI.acceptOrder(orderId, {
        pickupLocation: { address: 'Farm Location - To be confirmed' },
        dropLocation: { address: 'Consumer Location - To be confirmed' },
        distance: 10
      });

      setActionSuccess('Order accepted successfully!');
      refetchOrders();
      refetchDeliveries();
      setActiveTab('my-deliveries');

      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      setActionLoading(orderId);
      setActionError(null);

      await logisticsAPI.updateStatus(orderId, newStatus);

      setActionSuccess(`Status updated to ${newStatus}`);
      refetchDeliveries();

      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const statusColors = {
    ASSIGNED: 'bg-purple-100 text-purple-800',
    AT_PICKUP: 'bg-yellow-100 text-yellow-800',
    PICKED_UP: 'bg-blue-100 text-blue-800',
    IN_TRANSIT: 'bg-indigo-100 text-indigo-800',
    DELIVERED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800'
  };

  const getNextStatus = (currentStatus) => {
    const flow = {
      ASSIGNED: 'AT_PICKUP',
      AT_PICKUP: 'PICKED_UP',
      PICKED_UP: 'IN_TRANSIT',
      IN_TRANSIT: 'DELIVERED'
    };
    return flow[currentStatus];
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-purple-600 text-white px-4 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Logistics Dashboard</h1>
            <p className="text-purple-200 text-sm mt-1">
              Welcome, {user?.name || 'Driver'}
            </p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Messages */}
      {actionSuccess && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            ✅ {actionSuccess}
          </div>
        </div>
      )}

      {actionError && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ❌ {actionError}
            <button onClick={() => setActionError(null)} className="ml-4 underline">Dismiss</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex">
          <button
            onClick={() => setActiveTab('available')}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 ${
              activeTab === 'available'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            Available Orders ({availableOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('my-deliveries')}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 ${
              activeTab === 'my-deliveries'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            My Deliveries ({deliveries.length})
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* Available Orders Tab */}
        {activeTab === 'available' && (
          <div>
            {ordersLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {ordersError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600">{ordersError}</p>
                <button onClick={refetchOrders} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm">
                  Retry
                </button>
              </div>
            )}

            {!ordersLoading && !ordersError && availableOrders.length === 0 && (
              <div className="bg-white rounded-xl p-8 text-center">
                <div className="text-5xl mb-4">📦</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Available Orders</h3>
                <p className="text-gray-500">Check back soon for new delivery opportunities.</p>
              </div>
            )}

            {!ordersLoading && !ordersError && availableOrders.length > 0 && (
              <div className="space-y-4">
                {availableOrders.map((order) => (
                  <div key={order._id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">
                          Order #{order._id.slice(-8).toUpperCase()}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          Farmer: {order.farmerId?.name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Consumer: {order.consumerId?.name || 'Unknown'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">₹{order.totalAmount}</div>
                        <div className="text-xs text-gray-400">
                          {order.items?.length || 0} item(s)
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAcceptOrder(order._id)}
                      disabled={actionLoading === order._id}
                      className={`mt-4 w-full py-3 rounded-lg font-medium text-white ${
                        actionLoading === order._id
                          ? 'bg-gray-400'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {actionLoading === order._id ? 'Accepting...' : '✓ Accept Delivery'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Deliveries Tab */}
        {activeTab === 'my-deliveries' && (
          <div>
            {deliveriesLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {deliveriesError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600">{deliveriesError}</p>
                <button onClick={refetchDeliveries} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm">
                  Retry
                </button>
              </div>
            )}

            {!deliveriesLoading && !deliveriesError && deliveries.length === 0 && (
              <div className="bg-white rounded-xl p-8 text-center">
                <div className="text-5xl mb-4">🚚</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Deliveries</h3>
                <p className="text-gray-500">Accept an order to start delivering.</p>
              </div>
            )}

            {!deliveriesLoading && !deliveriesError && deliveries.length > 0 && (
              <div className="space-y-4">
                {deliveries.map((delivery) => {
                  const order = delivery.orderId;
                  const nextStatus = getNextStatus(delivery.deliveryStatus);

                  return (
                    <div key={delivery._id} className="bg-white rounded-xl shadow-sm p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">
                            Order #{order?._id?.slice(-8).toUpperCase() || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            Consumer: {order?.consumerId?.name || 'Unknown'}
                          </div>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusColors[delivery.deliveryStatus]}`}>
                          {delivery.deliveryStatus}
                        </span>
                      </div>

                      {/* Locations */}
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-green-600">📍</span>
                          <span className="text-gray-600">
                            Pickup: {delivery.pickupLocation?.address || 'Not set'}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-red-600">📍</span>
                          <span className="text-gray-600">
                            Drop: {delivery.dropLocation?.address || 'Not set'}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      {nextStatus && (
                        <button
                          onClick={() => handleUpdateStatus(order._id, nextStatus)}
                          disabled={actionLoading === order._id}
                          className={`mt-4 w-full py-3 rounded-lg font-medium text-white ${
                            actionLoading === order._id
                              ? 'bg-gray-400'
                              : 'bg-purple-600 hover:bg-purple-700'
                          }`}
                        >
                          {actionLoading === order._id ? 'Updating...' : `Mark as ${nextStatus.replace('_', ' ')}`}
                        </button>
                      )}

                      {delivery.deliveryStatus === 'DELIVERED' && (
                        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-center">
                          ✅ Delivery completed!
                        </div>
                      )}

                      {!['DELIVERED', 'FAILED'].includes(delivery.deliveryStatus) && (
                        <button
                          onClick={() => handleUpdateStatus(order._id, 'FAILED')}
                          disabled={actionLoading === order._id}
                          className="mt-2 w-full py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 text-sm"
                        >
                          Mark as Failed
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

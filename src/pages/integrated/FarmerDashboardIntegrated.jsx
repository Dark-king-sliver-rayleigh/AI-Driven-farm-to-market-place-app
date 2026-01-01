import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFarmerProducts, useFarmerOrders } from '../../hooks/useData';
import { InventoryTableIntegrated } from '../../components/integrated/InventoryTableIntegrated';

/**
 * API-Integrated Farmer Dashboard
 * Uses real backend data instead of local store
 */
export function FarmerDashboardIntegrated() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory');

  // Fetch real data from API
  const { products, loading: productsLoading, error: productsError, refetch: refetchProducts } = useFarmerProducts();
  const { orders, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useFarmerOrders();

  // Stats
  const totalProducts = products.length;
  const availableProducts = products.filter(p => p.status === 'AVAILABLE').length;
  const pendingOrders = orders.filter(o => o.orderStatus === 'CREATED').length;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Farmer Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {user?.name || 'Farmer'}
          </p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm text-red-600 border border-red-600 rounded-md hover:bg-red-50"
        >
          Logout
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">Total Products</div>
          <div className="text-2xl font-bold text-gray-800 mt-2">
            {productsLoading ? '...' : totalProducts}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">Available Products</div>
          <div className="text-2xl font-bold text-green-600 mt-2">
            {productsLoading ? '...' : availableProducts}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">Pending Orders</div>
          <div className="text-2xl font-bold text-yellow-600 mt-2">
            {ordersLoading ? '...' : pendingOrders}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b">
          <div className="flex space-x-1 p-4">
            {[
              { id: 'inventory', label: 'My Products' },
              { id: 'orders', label: 'Orders' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-t-lg font-medium ${
                  activeTab === tab.id
                    ? 'bg-green-50 text-green-600 border-b-2 border-green-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'inventory' && (
            <InventoryTableIntegrated
              products={products}
              loading={productsLoading}
              error={productsError}
              onRefresh={refetchProducts}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersSection orders={orders} loading={ordersLoading} error={ordersError} onRefresh={refetchOrders} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Orders section for farmer
 */
function OrdersSection({ orders, loading, error, onRefresh }) {
  const statusColors = {
    CREATED: 'bg-blue-100 text-blue-800',
    ASSIGNED: 'bg-purple-100 text-purple-800',
    PICKED_UP: 'bg-yellow-100 text-yellow-800',
    DELIVERED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button onClick={onRefresh} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <div className="text-5xl mb-4">📦</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Yet</h3>
        <p className="text-gray-500">Orders for your products will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order._id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium text-gray-900">
                Order #{order._id.slice(-8).toUpperCase()}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Consumer: {order.consumerId?.name || 'Unknown'}
              </div>
              <div className="text-sm text-gray-500">
                {order.items?.length || 0} item(s) • ₹{order.totalAmount}
              </div>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[order.orderStatus]}`}>
              {order.orderStatus}
            </span>
          </div>
          <div className="mt-3 text-xs text-gray-400">
            {new Date(order.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

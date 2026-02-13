import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRoutePlans } from '../../hooks/useNewFeatures';
import { logisticsAPI, routePlanAPI } from '../../services/api';

export function RoutePlanningPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plans, loading, error, refetch, createPlan } = useRoutePlans();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [vehicleCapacity, setVehicleCapacity] = useState(user?.loadCapacity || 500);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    if (showCreateForm) {
      fetchAvailableOrders();
    }
  }, [showCreateForm]);

  async function fetchAvailableOrders() {
    try {
      setOrdersLoading(true);
      const response = await logisticsAPI.getAvailableOrders('CREATED');
      setAvailableOrders(response.orders || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  }

  function toggleOrder(orderId) {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  }

  async function handleCreatePlan(e) {
    e.preventDefault();
    if (selectedOrders.length === 0) {
      setCreateError('Select at least one order');
      return;
    }
    try {
      setCreating(true);
      setCreateError(null);
      await createPlan({
        orderIds: selectedOrders,
        vehicleCapacityKg: Number(vehicleCapacity),
        startLocation: { lat: 19.076, lng: 72.8777 },
        startTime: new Date().toISOString()
      });
      setShowCreateForm(false);
      setSelectedOrders([]);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const filteredPlans = filterStatus
    ? plans.filter(p => p.status === filterStatus)
    : plans;

  const statusColors = {
    PLANNED: 'bg-blue-100 text-blue-800',
    ASSIGNED: 'bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'bg-purple-100 text-purple-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 text-white px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate('/logistics/home')} className="mb-4 p-2 hover:bg-purple-700 rounded-full transition-colors">
            &#8592; Back
          </button>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">&#x1F5FA;&#xFE0F; Route Planning</h1>
              <p className="text-purple-200 mt-1">Optimize multi-stop delivery routes</p>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-white text-purple-800 rounded-xl font-semibold hover:bg-purple-50 transition-colors"
            >
              + New Route
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Create Route Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Create Route Plan</h2>
                <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
              </div>

              <form onSubmit={handleCreatePlan} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Capacity (kg)</label>
                  <input
                    type="number"
                    value={vehicleCapacity}
                    onChange={e => setVehicleCapacity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Orders ({selectedOrders.length} selected)</label>
                  {ordersLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : availableOrders.length === 0 ? (
                    <p className="text-gray-500 text-sm py-4 text-center">No available orders to route</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {availableOrders.map(order => (
                        <label
                          key={order._id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedOrders.includes(order._id)
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order._id)}
                            onChange={() => toggleOrder(order._id)}
                            className="w-4 h-4 text-purple-600 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm">
                              #{order._id?.slice(-6).toUpperCase()}
                            </p>
                            <p className="text-gray-500 text-xs truncate">
                              {order.items?.map(i => i.name || i.productId?.name).join(', ') || 'Order items'}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400">
                            {order.totalAmount ? `₹${order.totalAmount}` : ''}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {createError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {createError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || selectedOrders.length === 0}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? 'Creating...' : `Create Route (${selectedOrders.length} stops)`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['', 'PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === status
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-purple-50'
              }`}
            >
              {status || 'All'}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-700">{error}</p>
            <button onClick={refetch} className="mt-2 text-sm text-red-600 underline">Retry</button>
          </div>
        )}

        {/* Route Plans List */}
        {!loading && !error && filteredPlans.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="text-5xl mb-3 opacity-50">&#x1F5FA;&#xFE0F;</div>
            <h3 className="text-lg font-semibold text-gray-900">No Route Plans</h3>
            <p className="text-gray-500 mt-1">Create your first optimized delivery route</p>
          </div>
        )}

        {!loading && filteredPlans.map(plan => (
          <button
            key={plan._id}
            onClick={() => navigate(`/logistics/routes/${plan._id}`)}
            className="w-full bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all text-left"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">
                    Route #{plan._id?.slice(-6).toUpperCase()}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[plan.status] || 'bg-gray-100 text-gray-800'}`}>
                    {plan.status?.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-gray-500 text-sm mt-1">
                  {new Date(plan.date || plan.createdAt).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <span className="text-gray-400 text-lg">&#8594;</span>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div>
                <p className="text-gray-400 text-xs">Stops</p>
                <p className="font-bold text-gray-900">{plan.stops?.length || 0}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Distance</p>
                <p className="font-bold text-gray-900">{plan.totalDistanceKm?.toFixed(1) || '—'} km</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Utilization</p>
                <p className="font-bold text-gray-900">{plan.utilizationPct?.toFixed(0) || '—'}%</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

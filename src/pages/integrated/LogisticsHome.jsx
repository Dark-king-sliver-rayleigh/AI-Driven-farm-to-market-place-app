import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMyDeliveries, useNotifications } from '../../hooks/useData';
import { logisticsAPI } from '../../services/api';
import { DriverLocationPanel } from '../../components/integrated/DriverLocationPanel';

/**
 * Logistics Home Page
 * Dashboard with stats, active delivery, delayed alerts, notifications
 */
export function LogisticsHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { deliveries, loading: deliveriesLoading, refetch: refetchDeliveries } = useMyDeliveries();
  const { notifications, loading: notifLoading } = useNotifications();

  const [delayedDeliveries, setDelayedDeliveries] = useState([]);
  const [delayedLoading, setDelayedLoading] = useState(true);

  // Fetch delayed deliveries
  useEffect(() => {
    async function fetchDelayed() {
      try {
        setDelayedLoading(true);
        const response = await logisticsAPI.getDelayedDeliveries();
        setDelayedDeliveries(response.deliveries || []);
      } catch (err) {
        console.error('Failed to fetch delayed deliveries:', err);
      } finally {
        setDelayedLoading(false);
      }
    }
    fetchDelayed();
  }, []);

  // Calculate stats
  const activeDeliveries = deliveries.filter(d => 
    !['DELIVERED', 'FAILED'].includes(d.deliveryStatus)
  );
  const completedToday = deliveries.filter(d => {
    if (d.deliveryStatus !== 'DELIVERED') return false;
    const deliveredAt = new Date(d.updatedAt);
    const today = new Date();
    return deliveredAt.toDateString() === today.toDateString();
  });
  const currentActive = activeDeliveries[0];
  const recentNotifications = notifications.slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with Profile and Notification Icons */}
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">Welcome, {user?.name || 'Driver'}</h1>
              <p className="text-purple-200 mt-1">Your delivery dashboard</p>
            </div>
            {/* Top Right Icons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/logistics/notifications')}
                className="relative w-11 h-11 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                title="Notifications"
              >
                <span className="text-xl">🔔</span>
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {notifications.filter(n => !n.isRead).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate('/logistics/profile')}
                className="w-11 h-11 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                title="Profile"
              >
                <span className="text-xl">👤</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Driver Location & Availability */}
        <DriverLocationPanel />

        {/* Top Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/logistics/orders')}
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl p-5 shadow-lg hover:shadow-xl transition-all flex flex-col items-center gap-3"
          >
            <span className="text-3xl">📋</span>
            <span className="font-semibold text-lg">Available Orders</span>
          </button>
          <button
            onClick={() => navigate('/logistics/earnings')}
            className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl p-5 shadow-lg hover:shadow-xl transition-all flex flex-col items-center gap-3"
          >
            <span className="text-3xl">💰</span>
            <span className="font-semibold text-lg">Earnings</span>
          </button>
          <button
            onClick={() => navigate('/logistics/routes')}
            className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl p-5 shadow-lg hover:shadow-xl transition-all flex flex-col items-center gap-3"
          >
            <span className="text-3xl">🗺️</span>
            <span className="font-semibold text-lg">Route Planning</span>
          </button>
          <button
            onClick={() => navigate('/logistics/kpi')}
            className="bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl p-5 shadow-lg hover:shadow-xl transition-all flex flex-col items-center gap-3"
          >
            <span className="text-3xl">📊</span>
            <span className="font-semibold text-lg">KPI Dashboard</span>
          </button>
        </div>

        {/* Current Active Delivery - Large Button */}
        {currentActive && (
          <button
            onClick={() => navigate(`/logistics/delivery/${currentActive.orderId?._id || currentActive._id}`)}
            className="w-full bg-white border-2 border-purple-200 text-gray-900 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium uppercase tracking-wide">Active Delivery</p>
                <p className="text-2xl font-bold mt-1">
                  Order #{(currentActive.orderId?._id || currentActive._id).slice(-8).toUpperCase()}
                </p>
                <p className="text-gray-500 mt-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  {currentActive.deliveryStatus?.replace('_', ' ')}
                </p>
              </div>
              <div className="text-6xl opacity-80">🚚</div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-purple-600 text-lg font-medium">
              Tap to view details →
            </div>
          </button>
        )}

        {/* No Active Delivery */}
        {!deliveriesLoading && !currentActive && (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <div className="text-5xl mb-3 opacity-50">📦</div>
            <h3 className="text-lg font-semibold text-gray-900">No Active Delivery</h3>
            <p className="text-gray-500 mt-1">Accept an order to start delivering</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="text-3xl font-bold text-purple-600">{activeDeliveries.length}</div>
            <div className="text-gray-500 text-sm mt-1">Active Deliveries</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="text-3xl font-bold text-green-600">{completedToday.length}</div>
            <div className="text-gray-500 text-sm mt-1">Completed Today</div>
          </div>
        </div>

        {/* Delayed Deliveries Alert */}
        {!delayedLoading && delayedDeliveries.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-800">Delayed Deliveries ({delayedDeliveries.length})</h3>
                <p className="text-orange-600 text-sm mt-1">Some deliveries need attention</p>
                <div className="mt-3 space-y-2">
                  {delayedDeliveries.slice(0, 2).map(d => (
                    <button
                      key={d._id}
                      onClick={() => navigate(`/logistics/delivery/${d.orderId?._id || d._id}`)}
                      className="w-full text-left p-3 bg-white rounded-lg border border-orange-200 hover:border-orange-300"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">
                          Order #{(d.orderId?._id || d._id).slice(-8).toUpperCase()}
                        </span>
                        <span className="text-orange-600 text-sm">View →</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

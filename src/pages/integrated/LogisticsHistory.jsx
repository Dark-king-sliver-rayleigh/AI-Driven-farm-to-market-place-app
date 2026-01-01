import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyDeliveries } from '../../hooks/useData';
import { logisticsAPI } from '../../services/api';

/**
 * Logistics Delivery History
 * Shows completed and failed deliveries with audit trail
 */
export function LogisticsHistory() {
  const navigate = useNavigate();
  const { deliveries, loading } = useMyDeliveries();
  const [filter, setFilter] = useState('all'); // all, completed, failed
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Filter deliveries by status
  const completedStatuses = ['DELIVERED'];
  const failedStatuses = ['FAILED'];
  
  const historyDeliveries = deliveries.filter(d => 
    completedStatuses.includes(d.deliveryStatus) || failedStatuses.includes(d.deliveryStatus)
  );

  const filteredDeliveries = historyDeliveries.filter(d => {
    if (filter === 'completed') return completedStatuses.includes(d.deliveryStatus);
    if (filter === 'failed') return failedStatuses.includes(d.deliveryStatus);
    return true;
  });

  // Fetch events for selected delivery
  useEffect(() => {
    async function fetchEvents() {
      if (!selectedDelivery) return;
      try {
        setEventsLoading(true);
        const response = await logisticsAPI.getDeliveryEvents(selectedDelivery._id);
        setEvents(response.events || []);
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setEventsLoading(false);
      }
    }
    fetchEvents();
  }, [selectedDelivery]);

  const completedCount = historyDeliveries.filter(d => completedStatuses.includes(d.deliveryStatus)).length;
  const failedCount = historyDeliveries.filter(d => failedStatuses.includes(d.deliveryStatus)).length;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-purple-600 text-white px-4 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-purple-500 rounded-full">
            <span className="text-2xl">←</span>
          </button>
          <h1 className="text-xl font-bold">Delivery History</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-bold text-green-600">{completedCount}</div>
            <div className="text-gray-500 text-sm">Completed</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-bold text-red-600">{failedCount}</div>
            <div className="text-gray-500 text-sm">Failed</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'all', label: 'All' },
            { key: 'completed', label: '✅ Completed' },
            { key: 'failed', label: '❌ Failed' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 py-3 rounded-xl font-medium ${
                filter === f.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredDeliveries.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <div className="text-5xl mb-3 opacity-50">📜</div>
            <h3 className="text-lg font-semibold text-gray-900">No History Yet</h3>
            <p className="text-gray-500 mt-1">Completed deliveries will appear here.</p>
          </div>
        )}

        {/* Deliveries List */}
        {!loading && filteredDeliveries.length > 0 && (
          <div className="space-y-3">
            {filteredDeliveries.map(delivery => {
              const order = delivery.orderId || {};
              const isCompleted = completedStatuses.includes(delivery.deliveryStatus);

              return (
                <button
                  key={delivery._id}
                  onClick={() => setSelectedDelivery(delivery)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">
                        Order #{order._id?.slice(-8).toUpperCase() || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {order.consumerId?.name || 'Consumer'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        isCompleted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {isCompleted ? '✅ Delivered' : '❌ Failed'}
                      </span>
                      <p className="text-sm text-gray-400 mt-1">
                        {new Date(delivery.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-gray-500">{order.items?.length || 0} items</span>
                    <span className="font-medium text-green-600">₹{order.totalAmount || 0}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Delivery Detail Modal */}
      {selectedDelivery && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h2 className="text-lg font-bold">Delivery Details</h2>
              <button 
                onClick={() => setSelectedDelivery(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Order Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-medium text-lg">
                  Order #{(selectedDelivery.orderId?._id || selectedDelivery._id).slice(-8).toUpperCase()}
                </p>
                <p className="text-gray-500 mt-1">
                  {selectedDelivery.orderId?.consumerId?.name || 'Consumer'}
                </p>
                <p className="text-green-600 font-bold text-lg mt-2">
                  ₹{selectedDelivery.orderId?.totalAmount || 0}
                </p>
              </div>

              {/* Audit Timeline */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">📜 Audit Trail</h3>
                {eventsLoading ? (
                  <p className="text-center text-gray-500 py-4">Loading...</p>
                ) : events.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No events recorded</p>
                ) : (
                  <div className="space-y-3">
                    {events.map((event, idx) => (
                      <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-2 h-2 mt-2 rounded-full bg-purple-500"></div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{event.eventType}</p>
                          {event.remarks && <p className="text-gray-500 text-sm">{event.remarks}</p>}
                          <p className="text-gray-400 text-xs mt-1">
                            {new Date(event.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

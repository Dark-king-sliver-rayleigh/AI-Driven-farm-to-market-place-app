import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { logisticsAPI } from '../../services/api';
import { useMyDeliveries } from '../../hooks/useData';

// Status configuration with actions
const STATUS_CONFIG = {
  ASSIGNED: { 
    label: 'Assigned', 
    color: 'bg-purple-100 text-purple-800',
    nextAction: 'AT_PICKUP',
    actionLabel: '📍 Arrived at Pickup',
    actionColor: 'bg-yellow-500 hover:bg-yellow-600'
  },
  AT_PICKUP: { 
    label: 'At Pickup', 
    color: 'bg-yellow-100 text-yellow-800',
    nextAction: 'PICKED_UP',
    actionLabel: '📦 Confirm Pickup',
    actionColor: 'bg-blue-500 hover:bg-blue-600'
  },
  PICKED_UP: { 
    label: 'Picked Up', 
    color: 'bg-blue-100 text-blue-800',
    nextAction: 'IN_TRANSIT',
    actionLabel: '🚚 Out for Delivery',
    actionColor: 'bg-indigo-500 hover:bg-indigo-600'
  },
  IN_TRANSIT: { 
    label: 'Out for Delivery', 
    color: 'bg-indigo-100 text-indigo-800',
    nextAction: 'DELIVERED',
    actionLabel: '✅ Mark Delivered',
    actionColor: 'bg-green-500 hover:bg-green-600'
  },
  DELIVERED: { 
    label: 'Delivered', 
    color: 'bg-green-100 text-green-800',
    nextAction: null,
    actionLabel: null,
    actionColor: null
  },
  FAILED: { 
    label: 'Failed', 
    color: 'bg-red-100 text-red-800',
    nextAction: null,
    actionLabel: null,
    actionColor: null
  }
};

const TIMELINE_STEPS = ['Assigned', 'At Pickup', 'Picked Up', 'In Transit', 'Delivered'];

/**
 * Focused Active Delivery View
 * Shows full delivery details, farmer/consumer info, map link, actions
 */
export function LogisticsActiveDelivery() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { deliveries, refetch } = useMyDeliveries();

  const [delivery, setDelivery] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showEvents, setShowEvents] = useState(false);

  // Find delivery from list
  useEffect(() => {
    const found = deliveries.find(d => 
      (d.orderId?._id === orderId || d._id === orderId)
    );
    if (found) {
      setDelivery(found);
      setLoading(false);
    } else if (!loading) {
      setError('Delivery not found');
      setLoading(false);
    }
  }, [orderId, deliveries]);

  // Fetch audit events
  const fetchEvents = async () => {
    if (!delivery) return;
    try {
      setEventsLoading(true);
      const response = await logisticsAPI.getDeliveryEvents(delivery._id);
      setEvents(response.events || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    if (showEvents && events.length === 0) {
      fetchEvents();
    }
  }, [showEvents]);

  const handleStatusUpdate = async (newStatus) => {
    try {
      setActionLoading(true);
      await logisticsAPI.updateStatus(orderId, newStatus);
      await refetch();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openGoogleMaps = (address) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading delivery...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !delivery) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <span className="text-5xl block mb-4">❌</span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Delivery Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'This delivery may have been reassigned.'}</p>
          <button
            onClick={() => navigate('/logistics/home')}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium text-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const order = delivery.orderId || {};
  const farmer = order.farmerId || {};
  const consumer = order.consumerId || {};
  const config = STATUS_CONFIG[delivery.deliveryStatus] || STATUS_CONFIG.ASSIGNED;
  const isActive = !['DELIVERED', 'FAILED'].includes(delivery.deliveryStatus);

  // Calculate step for timeline
  const currentStepIndex = TIMELINE_STEPS.findIndex(s => 
    s.toUpperCase().replace(' ', '_') === delivery.deliveryStatus
  );

  return (
    <div className="min-h-screen bg-gray-100 pb-32">
      {/* Header */}
      <div className="bg-purple-600 text-white px-4 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-purple-500 rounded-full">
            <span className="text-2xl">←</span>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">
              Order #{order._id?.slice(-8).toUpperCase() || 'N/A'}
            </h1>
            <span className={`inline-block mt-1 px-3 py-0.5 text-xs font-medium rounded-full ${config.color}`}>
              {config.label}
            </span>
          </div>
          {delivery.isDelayed && (
            <span className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">
              ⚠️ DELAYED
            </span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Timeline Progress */}
        {isActive && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center">
              {TIMELINE_STEPS.map((step, idx) => {
                const stepStatus = delivery.deliveryStatus?.replace('_', ' ').toUpperCase();
                const currentStep = step.toUpperCase();
                const isCompleted = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div key={step} className="flex-1 relative">
                    {idx > 0 && (
                      <div className={`absolute top-3 left-0 right-1/2 h-1 -translate-y-1/2 ${
                        idx <= currentStepIndex ? 'bg-purple-500' : 'bg-gray-200'
                      }`}></div>
                    )}
                    {idx < TIMELINE_STEPS.length - 1 && (
                      <div className={`absolute top-3 left-1/2 right-0 h-1 -translate-y-1/2 ${
                        idx < currentStepIndex ? 'bg-purple-500' : 'bg-gray-200'
                      }`}></div>
                    )}
                    <div className="flex flex-col items-center relative z-10">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCompleted ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {isCompleted ? '✓' : idx + 1}
                      </div>
                      <p className={`text-xs mt-1 text-center ${isCurrent ? 'font-bold text-purple-600' : 'text-gray-400'}`}>
                        {step.split(' ')[0]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delay Warning */}
        {delivery.isDelayed && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 flex items-center gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h3 className="font-bold text-orange-800">Delivery Delayed</h3>
              <p className="text-orange-600 text-sm">Please expedite or contact support.</p>
            </div>
          </div>
        )}

        {/* Pickup Location */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-green-50 px-4 py-3 border-b border-green-100">
            <h2 className="font-semibold text-green-800 flex items-center gap-2">
              <span>🌾</span> Pickup - Farmer
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
                👨‍🌾
              </div>
              <div>
                <p className="font-medium text-gray-900">{farmer.name || 'Farmer'}</p>
                {farmer.phone && <p className="text-sm text-gray-500">📞 {farmer.phone}</p>}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-700">{delivery.pickupLocation?.address || 'Address not set'}</p>
            </div>
            <button
              onClick={() => openGoogleMaps(delivery.pickupLocation?.address || farmer.location || 'Farm')}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-medium text-lg flex items-center justify-center gap-2"
            >
              <span>🗺️</span> Open in Google Maps
            </button>
          </div>
        </div>

        {/* Drop Location */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
            <h2 className="font-semibold text-blue-800 flex items-center gap-2">
              <span>🏠</span> Drop - Consumer
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                👤
              </div>
              <div>
                <p className="font-medium text-gray-900">{consumer.name || 'Consumer'}</p>
                {consumer.phone && <p className="text-sm text-gray-500">📞 {consumer.phone}</p>}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-700">{delivery.dropLocation?.address || 'Address not set'}</p>
            </div>
            <button
              onClick={() => openGoogleMaps(delivery.dropLocation?.address || consumer.location || 'Consumer')}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-lg flex items-center justify-center gap-2"
            >
              <span>🗺️</span> Open in Google Maps
            </button>
          </div>
        </div>

        {/* Product Summary */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <span>📦</span> Order Items
            </h2>
          </div>
          <div className="p-4">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-700">
                  {item.productId?.name || 'Product'} × {item.quantity}
                </span>
                <span className="font-medium">₹{item.price * item.quantity}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 mt-3 border-t-2 border-gray-200 font-bold text-lg">
              <span>Total</span>
              <span className="text-green-600">₹{order.totalAmount || 0}</span>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Payment: {order.paymentMode || 'COD'}
            </div>
          </div>
        </div>

        {/* Expected Delivery */}
        {delivery.expectedDeliveryTime && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏰</span>
              <div>
                <p className="text-sm text-gray-500">Expected Delivery</p>
                <p className="font-medium text-gray-900">
                  {new Date(delivery.expectedDeliveryTime).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Audit Trail */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowEvents(!showEvents)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
          >
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <span>📜</span> Delivery Timeline
            </h2>
            <span className="text-gray-400">{showEvents ? '▲' : '▼'}</span>
          </button>
          {showEvents && (
            <div className="px-4 pb-4">
              {eventsLoading ? (
                <p className="text-center text-gray-500 py-4">Loading...</p>
              ) : events.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No events recorded</p>
              ) : (
                <div className="space-y-3">
                  {events.map((event, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="w-2 h-2 mt-2 rounded-full bg-purple-500"></div>
                      <div className="flex-1">
                        <p className="text-gray-800 font-medium">{event.eventType}</p>
                        {event.remarks && <p className="text-gray-500 text-sm">{event.remarks}</p>}
                        <p className="text-gray-400 text-xs">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Action Buttons */}
      {isActive && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 space-y-2">
          {config.nextAction && (
            <button
              onClick={() => handleStatusUpdate(config.nextAction)}
              disabled={actionLoading}
              className={`w-full py-4 rounded-xl font-bold text-xl text-white ${config.actionColor} disabled:opacity-50`}
            >
              {actionLoading ? 'Updating...' : config.actionLabel}
            </button>
          )}
          <button
            onClick={() => handleStatusUpdate('FAILED')}
            disabled={actionLoading}
            className="w-full py-3 border-2 border-red-300 text-red-600 rounded-xl font-medium hover:bg-red-50"
          >
            ❌ Delivery Failed
          </button>
        </div>
      )}

      {/* Completed/Failed Message */}
      {!isActive && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className={`text-center py-4 rounded-xl ${
            delivery.deliveryStatus === 'DELIVERED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            <span className="text-3xl block mb-2">
              {delivery.deliveryStatus === 'DELIVERED' ? '✅' : '❌'}
            </span>
            <p className="font-bold text-lg">
              {delivery.deliveryStatus === 'DELIVERED' ? 'Delivery Completed!' : 'Delivery Failed'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

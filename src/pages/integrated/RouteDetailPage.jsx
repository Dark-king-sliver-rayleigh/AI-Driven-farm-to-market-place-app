import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRoutePlan } from '../../hooks/useNewFeatures';

export function RouteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan, loading, error, refetch, assignDriver, updateStopStatus } = useRoutePlan(id);

  const [updatingStop, setUpdatingStop] = useState(null);
  const [assigning, setAssigning] = useState(false);

  async function handleAssignToMe() {
    try {
      setAssigning(true);
      await assignDriver(user?._id || user?.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleUpdateStop(stopId, status) {
    try {
      setUpdatingStop(stopId);
      await updateStopStatus(stopId, { status });
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingStop(null);
    }
  }

  const statusColors = {
    PENDING: 'bg-gray-100 text-gray-700',
    ARRIVED: 'bg-blue-100 text-blue-700',
    PICKED_UP: 'bg-yellow-100 text-yellow-700',
    DELIVERED: 'bg-green-100 text-green-700',
    SKIPPED: 'bg-red-100 text-red-700',
  };

  const nextStatus = {
    PENDING: 'ARRIVED',
    ARRIVED: 'PICKED_UP',
    PICKED_UP: 'DELIVERED',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <button onClick={() => navigate(-1)} className="text-purple-600 underline">Go back</button>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Route not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 text-white px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate('/logistics/routes')} className="mb-4 p-2 hover:bg-purple-700 rounded-full transition-colors">
            &#8592; Back
          </button>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Route #{plan._id?.slice(-6).toUpperCase()}</h1>
              <p className="text-purple-200 mt-1">
                {new Date(plan.date || plan.createdAt).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              plan.status === 'COMPLETED' ? 'bg-green-500/20 text-green-200' :
              plan.status === 'IN_PROGRESS' ? 'bg-yellow-500/20 text-yellow-200' :
              'bg-white/20 text-white'
            }`}>
              {plan.status?.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-gray-400 text-xs">Total Distance</p>
            <p className="text-2xl font-bold text-gray-900">{plan.totalDistanceKm?.toFixed(1) || '—'}<span className="text-sm text-gray-400 ml-1">km</span></p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-gray-400 text-xs">Est. Duration</p>
            <p className="text-2xl font-bold text-gray-900">{plan.estimatedDurationMin || '—'}<span className="text-sm text-gray-400 ml-1">min</span></p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-gray-400 text-xs">Capacity Used</p>
            <p className="text-2xl font-bold text-gray-900">{plan.usedCapacityKg?.toFixed(0) || '—'}<span className="text-sm text-gray-400 ml-1">/ {plan.vehicleCapacityKg} kg</span></p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-gray-400 text-xs">Utilization</p>
            <p className={`text-2xl font-bold ${(plan.utilizationPct || 0) >= 80 ? 'text-green-600' : (plan.utilizationPct || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {plan.utilizationPct?.toFixed(0) || '—'}%
            </p>
          </div>
        </div>

        {/* Assign Button */}
        {plan.status === 'PLANNED' && (
          <button
            onClick={handleAssignToMe}
            disabled={assigning}
            className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {assigning ? 'Assigning...' : '&#x1F69A; Assign This Route to Me'}
          </button>
        )}

        {/* Stops Timeline */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">&#x1F4CD; Delivery Stops ({plan.stops?.length || 0})</h2>
          <div className="space-y-4">
            {(plan.stops || []).sort((a, b) => a.sequence - b.sequence).map((stop, idx) => (
              <div key={stop._id || idx} className="relative pl-8">
                {/* Timeline line */}
                {idx < (plan.stops?.length || 0) - 1 && (
                  <div className="absolute left-3 top-8 w-0.5 h-full bg-gray-200"></div>
                )}
                {/* Timeline dot */}
                <div className={`absolute left-1 top-2 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${
                  stop.status === 'DELIVERED' ? 'bg-green-500 border-green-500 text-white' :
                  stop.status === 'ARRIVED' || stop.status === 'PICKED_UP' ? 'bg-purple-500 border-purple-500 text-white' :
                  'bg-white border-gray-300 text-gray-400'
                }`}>
                  {stop.status === 'DELIVERED' ? '\u2713' : idx + 1}
                </div>

                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Stop {stop.sequence} — {stop.type === 'PICKUP' ? '&#x1F4E6; Pickup' : '&#x1F4CD; Drop-off'}
                      </p>
                      {stop.orderId && (
                        <p className="text-gray-500 text-sm mt-0.5">
                          Order #{(typeof stop.orderId === 'string' ? stop.orderId : stop.orderId?._id)?.slice(-6).toUpperCase()}
                        </p>
                      )}
                      {stop.eta && (
                        <p className="text-gray-400 text-xs mt-1">
                          ETA: {new Date(stop.eta).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {stop.plannedDistanceFromPrevKm > 0 && (
                        <p className="text-gray-400 text-xs">
                          {stop.plannedDistanceFromPrevKm?.toFixed(1)} km from previous
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[stop.status] || 'bg-gray-100 text-gray-700'}`}>
                      {stop.status}
                    </span>
                  </div>

                  {/* Action buttons */}
                  {plan.status !== 'COMPLETED' && plan.status !== 'CANCELLED' && nextStatus[stop.status] && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                      <button
                        onClick={() => handleUpdateStop(stop._id, nextStatus[stop.status])}
                        disabled={updatingStop === stop._id}
                        className="flex-1 py-2 bg-purple-600 text-white text-sm rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
                      >
                        {updatingStop === stop._id ? 'Updating...' : `Mark ${nextStatus[stop.status].replace('_', ' ')}`}
                      </button>
                      {stop.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateStop(stop._id, 'SKIPPED')}
                          disabled={updatingStop === stop._id}
                          className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

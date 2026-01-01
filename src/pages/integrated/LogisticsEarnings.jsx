import { useNavigate } from 'react-router-dom';
import { useMyDeliveries } from '../../hooks/useData';

// Mock earnings rate per delivery
const EARNING_PER_DELIVERY = 50;

/**
 * Logistics Earnings Summary
 * Shows total deliveries and mock earnings
 */
export function LogisticsEarnings() {
  const navigate = useNavigate();
  const { deliveries, loading } = useMyDeliveries();

  // Calculate stats
  const completedDeliveries = deliveries.filter(d => d.deliveryStatus === 'DELIVERED');
  const totalEarnings = completedDeliveries.length * EARNING_PER_DELIVERY;

  // Group by date (last 7 days)
  const earningsByDay = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toDateString();
    
    const dayDeliveries = completedDeliveries.filter(d => {
      const deliveryDate = new Date(d.updatedAt);
      return deliveryDate.toDateString() === dateStr;
    });

    earningsByDay.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      deliveries: dayDeliveries.length,
      earnings: dayDeliveries.length * EARNING_PER_DELIVERY
    });
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-600 to-green-700 text-white px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="mb-4 p-2 hover:bg-green-500 rounded-full">
            ← Back
          </button>
          <h1 className="text-2xl font-bold">Earnings Summary</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Total Earnings Card */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
              <p className="text-green-100 text-sm font-medium">Total Earnings</p>
              <p className="text-4xl font-bold mt-2">₹{totalEarnings}</p>
              <div className="mt-4 pt-4 border-t border-green-400/30 flex justify-between">
                <div>
                  <p className="text-green-100 text-sm">Deliveries</p>
                  <p className="text-2xl font-bold">{completedDeliveries.length}</p>
                </div>
                <div>
                  <p className="text-green-100 text-sm">Per Delivery</p>
                  <p className="text-2xl font-bold">₹{EARNING_PER_DELIVERY}</p>
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl">ℹ️</span>
              <p className="text-blue-700 text-sm">
                Earnings are calculated at ₹{EARNING_PER_DELIVERY} per successful delivery. 
                Actual payouts may vary based on distance and order value.
              </p>
            </div>

            {/* Daily Breakdown */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Last 7 Days</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {earningsByDay.map((day, idx) => (
                  <div key={idx} className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{day.date}</p>
                      <p className="text-sm text-gray-500">{day.deliveries} deliveries</p>
                    </div>
                    <p className={`font-bold ${day.earnings > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {day.earnings > 0 ? `₹${day.earnings}` : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm text-center">
                <div className="text-3xl font-bold text-purple-600">{completedDeliveries.length}</div>
                <div className="text-gray-500 text-sm mt-1">Total Deliveries</div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm text-center">
                <div className="text-3xl font-bold text-green-600">
                  {(completedDeliveries.length / Math.max(7, 1)).toFixed(1)}
                </div>
                <div className="text-gray-500 text-sm mt-1">Avg / Day</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

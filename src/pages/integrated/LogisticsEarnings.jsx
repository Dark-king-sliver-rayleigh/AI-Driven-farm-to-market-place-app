import { useNavigate } from 'react-router-dom';
import { useMyDeliveries } from '../../hooks/useData';

function calculateFallbackPayout(delivery) {
  const distance = Math.max(0, Number(delivery.distance) || 0);
  const orderTotal = Math.max(0, Number(delivery.orderId?.totalAmount) || 0);
  return Number((35 + (distance * 4) + (orderTotal * 0.03)).toFixed(2));
}

function getDeliveryPayout(delivery) {
  return Number(delivery.payoutAmount ?? calculateFallbackPayout(delivery));
}

/**
 * Logistics Earnings Summary
 * Uses backend-calculated payouts tied to actual delivery workload.
 */
export function LogisticsEarnings() {
  const navigate = useNavigate();
  const { deliveries, loading } = useMyDeliveries();

  const earnedDeliveries = deliveries.filter(
    (delivery) => delivery.earningStatus === 'EARNED' || delivery.deliveryStatus === 'DELIVERED'
  );
  const pendingDeliveries = deliveries.filter(
    (delivery) => !['EARNED', 'CANCELLED'].includes(delivery.earningStatus) && delivery.deliveryStatus !== 'FAILED'
  );

  const totalEarnings = earnedDeliveries.reduce((sum, delivery) => sum + getDeliveryPayout(delivery), 0);
  const pendingEarnings = pendingDeliveries.reduce((sum, delivery) => sum + getDeliveryPayout(delivery), 0);

  const earningsByDay = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toDateString();

    const dayDeliveries = earnedDeliveries.filter((delivery) => {
      const deliveryDate = new Date(delivery.updatedAt);
      return deliveryDate.toDateString() === dateStr;
    });

    earningsByDay.push({
      date: date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }),
      deliveries: dayDeliveries.length,
      earnings: Number(dayDeliveries.reduce((sum, delivery) => sum + getDeliveryPayout(delivery), 0).toFixed(2))
    });
  }

  const averagePayout = earnedDeliveries.length > 0
    ? totalEarnings / earnedDeliveries.length
    : 0;

  return (
    <div className="min-h-screen bg-gray-100">
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
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
              <p className="text-green-100 text-sm font-medium">Total Earned</p>
              <p className="text-4xl font-bold mt-2">₹{totalEarnings.toFixed(2)}</p>
              <div className="mt-4 pt-4 border-t border-green-400/30 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-green-100 text-sm">Completed</p>
                  <p className="text-2xl font-bold">{earnedDeliveries.length}</p>
                </div>
                <div>
                  <p className="text-green-100 text-sm">Pending</p>
                  <p className="text-2xl font-bold">₹{pendingEarnings.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-green-100 text-sm">Avg Payout</p>
                  <p className="text-2xl font-bold">₹{averagePayout.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl">ℹ️</span>
              <p className="text-blue-700 text-sm">
                Payouts are calculated from a base delivery fee, traveled distance, and order value.
                Pending deliveries are shown separately until the order is marked delivered.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Last 7 Days</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {earningsByDay.map((day, idx) => (
                  <div key={idx} className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{day.date}</p>
                      <p className="text-sm text-gray-500">{day.deliveries} completed deliveries</p>
                    </div>
                    <p className={`font-bold ${day.earnings > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {day.earnings > 0 ? `₹${day.earnings.toFixed(2)}` : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm text-center">
                <div className="text-3xl font-bold text-purple-600">{earnedDeliveries.length}</div>
                <div className="text-gray-500 text-sm mt-1">Paid Deliveries</div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm text-center">
                <div className="text-3xl font-bold text-amber-600">{pendingDeliveries.length}</div>
                <div className="text-gray-500 text-sm mt-1">Pending Deliveries</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

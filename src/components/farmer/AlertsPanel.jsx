import { memo, useMemo } from 'react';

/**
 * Alerts Panel Component
 * Displays read-only price and MSP alerts derived from market data
 * 
 * Props:
 * - insights: Array of market insight objects
 */
function AlertsPanelComponent({ insights = [] }) {
  // Generate alerts from insights
  const alerts = useMemo(() => {
    const alertList = [];

    insights.forEach((insight) => {
      const { commodity, trend, msp, suggestedPrice } = insight;

      // Price movement alerts
      if (trend === 'RISING') {
        alertList.push({
          id: `${commodity}-rising`,
          type: 'success',
          icon: '📈',
          message: `${commodity} prices are rising. Good time to sell!`
        });
      } else if (trend === 'FALLING') {
        alertList.push({
          id: `${commodity}-falling`,
          type: 'warning',
          icon: '📉',
          message: `${commodity} prices are falling. Consider holding stock.`
        });
      }

      // MSP alerts
      if (msp && suggestedPrice) {
        if (suggestedPrice < msp * 1.1) {
          alertList.push({
            id: `${commodity}-msp`,
            type: 'info',
            icon: '🏛️',
            message: `${commodity}: Market price near MSP floor (₹${msp}/quintal)`
          });
        }
      }
    });

    return alertList.slice(0, 4); // Show max 4 alerts
  }, [insights]);

  // Alert style config
  const alertStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    error: 'bg-red-50 border-red-200 text-red-800'
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <div className="text-4xl mb-2">🔔</div>
        <p className="text-gray-600">No market alerts at this time</p>
        <p className="text-sm text-gray-500 mt-1">Alerts will appear when prices change significantly</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
        <span>🔔</span> Market Alerts
      </h3>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 p-4 rounded-lg border ${alertStyles[alert.type]}`}
        >
          <span className="text-xl flex-shrink-0">{alert.icon}</span>
          <p className="text-sm font-medium leading-relaxed">{alert.message}</p>
        </div>
      ))}
    </div>
  );
}

export const AlertsPanel = memo(AlertsPanelComponent);

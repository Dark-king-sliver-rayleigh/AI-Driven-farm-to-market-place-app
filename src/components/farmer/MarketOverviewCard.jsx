import { memo } from 'react';

/**
 * Market Overview Card Component
 * Displays a single commodity's price info with trend indicator
 * 
 * Props:
 * - commodity: string
 * - mandi: string
 * - suggestedPrice: number
 * - minPrice: number
 * - maxPrice: number
 * - trend: 'RISING' | 'FALLING' | 'STABLE'
 * - confidence: 'HIGH' | 'MEDIUM' | 'LOW'
 */
function MarketOverviewCardComponent({
  commodity,
  mandi,
  suggestedPrice,
  minPrice,
  maxPrice,
  trend,
  confidence
}) {
  // Trend indicator config
  const trendConfig = {
    RISING: { icon: '↑', color: 'text-green-600', bg: 'bg-green-100', label: 'Rising' },
    FALLING: { icon: '↓', color: 'text-red-600', bg: 'bg-red-100', label: 'Falling' },
    STABLE: { icon: '→', color: 'text-gray-600', bg: 'bg-gray-100', label: 'Stable' }
  };

  const trendInfo = trendConfig[trend] || trendConfig.STABLE;

  // Confidence colors
  const confidenceColors = {
    HIGH: 'text-green-700',
    MEDIUM: 'text-yellow-700',
    LOW: 'text-gray-500'
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-shadow">
      {/* Commodity Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 truncate">{commodity}</h3>
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${trendInfo.bg} ${trendInfo.color}`}>
          <span className="text-base">{trendInfo.icon}</span>
          {trendInfo.label}
        </span>
      </div>

      {/* Price Display */}
      <div className="mb-3">
        <div className="text-3xl font-bold text-gray-900">
          ₹{suggestedPrice?.toLocaleString('en-IN') || '--'}
          <span className="text-sm font-normal text-gray-500">/quintal</span>
        </div>
      </div>

      {/* Min-Max Range */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
        <span className="font-medium">Range:</span>
        <span className="text-red-600">₹{minPrice?.toLocaleString('en-IN') || '--'}</span>
        <span>—</span>
        <span className="text-green-600">₹{maxPrice?.toLocaleString('en-IN') || '--'}</span>
      </div>

      {/* Mandi & Confidence */}
      <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3">
        <span className="truncate" title={mandi}>📍 {mandi}</span>
        <span className={confidenceColors[confidence] || confidenceColors.LOW}>
          {confidence} confidence
        </span>
      </div>
    </div>
  );
}

export const MarketOverviewCard = memo(MarketOverviewCardComponent);

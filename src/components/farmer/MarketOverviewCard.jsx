import { memo } from 'react';

/**
 * Market Overview Card Component
 * Displays comprehensive commodity price info with all available data
 * 
 * Props:
 * - commodity: string
 * - mandi: string
 * - location: { state, district, mandi } (NEW)
 * - suggestedPrice: number
 * - minPrice: number
 * - maxPrice: number
 * - trend: 'RISING' | 'FALLING' | 'STABLE'
 * - confidence: 'HIGH' | 'MEDIUM' | 'LOW'
 * - varieties: string[] (NEW)
 * - avgArrivals: number (NEW)
 * - sources: object (NEW)
 * - dataFreshness: object (NEW)
 * - msp: number (NEW)
 */
function MarketOverviewCardComponent({
  commodity,
  mandi,
  location,
  suggestedPrice,
  minPrice,
  maxPrice,
  trend,
  confidence,
  varieties = [],
  avgArrivals = 0,
  sources = {},
  dataFreshness = {},
  msp = null,
  latestPriceDate,
  unit = 'Rs./Quintal'
}) {
  // Extract short display label from unit (e.g. 'Rs./Quintal' → 'quintal', 'Rs./Each' → 'each')
  const unitLabel = unit ? unit.replace(/^Rs\.\//, '').toLowerCase() : 'quintal';
  // Trend indicator config
  const trendConfig = {
    RISING: { icon: '↑', color: 'text-green-600', bg: 'bg-green-100', label: 'Rising' },
    FALLING: { icon: '↓', color: 'text-red-600', bg: 'bg-red-100', label: 'Falling' },
    STABLE: { icon: '→', color: 'text-gray-600', bg: 'bg-gray-100', label: 'Stable' }
  };

  const trendInfo = trendConfig[trend] || trendConfig.STABLE;

  // Confidence colors
  const confidenceColors = {
    HIGH: 'bg-green-100 text-green-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    LOW: 'bg-gray-100 text-gray-500'
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Get source label
  const getSourceLabel = (source) => {
    const labels = {
      'data.gov.in': 'Daily Mandi',
      'data.gov.in-variety': 'Variety-wise',
      'seed': 'Sample Data',
      'manual': 'Manual Entry',
      'csv': 'CSV Import'
    };
    return labels[source] || source;
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-shadow">
      {/* Commodity Header with Trend */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-800 truncate">{commodity}</h3>
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${trendInfo.bg} ${trendInfo.color}`}>
          <span className="text-base">{trendInfo.icon}</span>
          {trendInfo.label}
        </span>
      </div>

      {/* Location Info */}
      <div className="mb-3 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <span className="text-base">📍</span>
          <span className="font-medium">{mandi}</span>
        </div>
        {location && (location.district || location.state) && (
          <div className="text-xs text-gray-500 ml-5">
            {location.district && <span>{location.district}, </span>}
            {location.state && <span>{location.state}</span>}
          </div>
        )}
      </div>

      {/* Price Display */}
      <div className="mb-3">
        <div className="text-3xl font-bold text-gray-900">
          ₹{suggestedPrice?.toLocaleString('en-IN') || '--'}
          <span className="text-sm font-normal text-gray-500">/{unitLabel}</span>
        </div>
        {msp && (
          <div className="text-xs text-green-600 mt-1">
            MSP: ₹{msp.toLocaleString('en-IN')}/{unitLabel}
          </div>
        )}
      </div>

      {/* Min-Max Range */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
        <span className="font-medium">Range:</span>
        <span className="text-red-600 font-medium">₹{minPrice?.toLocaleString('en-IN') || '--'}</span>
        <span>—</span>
        <span className="text-green-600 font-medium">₹{maxPrice?.toLocaleString('en-IN') || '--'}</span>
      </div>

      {/* Varieties */}
      {varieties && varieties.length > 0 && (
        <div className="mb-3">
          <span className="text-xs text-gray-500">Varieties: </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {varieties.slice(0, 3).map((variety, index) => (
              <span
                key={index}
                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full"
              >
                {variety}
              </span>
            ))}
            {varieties.length > 3 && (
              <span className="text-xs text-gray-500">+{varieties.length - 3} more</span>
            )}
          </div>
        </div>
      )}

      {/* Arrivals */}
      {avgArrivals > 0 && (
        <div className="text-xs text-gray-500 mb-3">
          📦 Avg. Arrivals: <span className="font-medium text-gray-700">{avgArrivals.toLocaleString('en-IN')}</span>
        </div>
      )}

      {/* Data Sources */}
      {sources && Object.keys(sources).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {Object.entries(sources).map(([source, count]) => (
            <span
              key={source}
              className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full"
              title={`${count} records from ${source}`}
            >
              {getSourceLabel(source)} ({count})
            </span>
          ))}
        </div>
      )}

      {/* Footer: Confidence & Freshness */}
      <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-3 mt-2">
        <span className={`px-2 py-0.5 rounded-full ${confidenceColors[confidence] || confidenceColors.LOW}`}>
          {confidence} confidence
        </span>
        <div className="text-gray-500">
          {dataFreshness?.isStale && (
            <span className="text-orange-500 mr-1" title="Data may be outdated">⚠️</span>
          )}
          {latestPriceDate && (
            <span title="Latest price date">{formatDate(latestPriceDate)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export const MarketOverviewCard = memo(MarketOverviewCardComponent);

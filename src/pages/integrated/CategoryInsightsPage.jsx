import { useParams, Link } from 'react-router-dom';
import { useCategoryInsights } from '../../hooks/usePriceInsight';
import { MarketOverviewCard } from '../../components/farmer/MarketOverviewCard';

/**
 * Category Insights Page
 * Displays all commodities with price insights for a selected category
 */
export function CategoryInsightsPage() {
  const { categoryId } = useParams();
  const { category, commodities, totalCommodities, loading, error, refetch } = useCategoryInsights(categoryId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/farmer/home"
          className="text-2xl text-gray-600 hover:text-gray-800"
        >
          ←
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {category?.icon || '📊'} {category?.name || 'Category'} Market Insights
          </h1>
          <p className="text-gray-600 text-sm">
            {totalCommodities} commodities in this category
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="px-4 py-2 text-sm text-green-600 border border-green-300 rounded-lg hover:bg-green-50 disabled:opacity-50"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading market data for {category?.name || 'category'}...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h3 className="text-lg font-bold text-red-800 mb-2">Error Loading Data</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={refetch}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && commodities.length === 0 && (
        <div className="bg-gray-50 rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Commodities Found</h3>
          <p className="text-gray-600">
            No market data available for {category?.name || 'this category'} at this time.
          </p>
          <Link
            to="/farmer/home"
            className="inline-block mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            ← Back to Home
          </Link>
        </div>
      )}

      {/* Commodities Grid */}
      {!loading && !error && commodities.length > 0 && (
        <div>
          {/* Summary stats */}
          <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex items-center gap-6">
            <div>
              <span className="text-sm text-gray-600">With Price Data</span>
              <span className="block text-2xl font-bold text-green-600">
                {commodities.filter(c => c.hasData).length}
              </span>
            </div>
            <div className="h-10 w-px bg-gray-200" />
            <div>
              <span className="text-sm text-gray-600">Total in Category</span>
              <span className="block text-2xl font-bold text-gray-800">
                {totalCommodities}
              </span>
            </div>
          </div>

          {/* Commodity cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {commodities.map((item) => (
              item.hasData ? (
                <MarketOverviewCard
                  key={item.commodity}
                  commodity={item.commodity}
                  mandi={item.mandi}
                  suggestedPrice={item.suggestedPrice}
                  minPrice={item.minPrice}
                  maxPrice={item.maxPrice}
                  trend={item.trend}
                  confidence={item.confidence}
                />
              ) : (
                <div
                  key={item.commodity}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-5 opacity-75"
                >
                  <h3 className="text-lg font-bold text-gray-600">{item.commodity}</h3>
                  <p className="text-sm text-gray-500 mt-2">No recent market data available</p>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

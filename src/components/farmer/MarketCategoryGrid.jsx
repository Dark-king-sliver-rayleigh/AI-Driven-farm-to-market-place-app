import { memo } from 'react';
import { Link } from 'react-router-dom';

/**
 * Market Category Grid Component
 * Displays 6 category thumbnails for market insights navigation
 * 
 * Props:
 * - categories: Array of { id, name, icon, color, commodityCount }
 * - loading: boolean
 * - error: string|null
 * - onRefresh: () => void
 */
function MarketCategoryGridComponent({ categories = [], loading, error, onRefresh }) {
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-2">⚠️</div>
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={onRefresh}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (categories.length === 0) {
    return (
      <div className="bg-gray-50 rounded-2xl p-8 text-center">
        <div className="text-5xl mb-3">📊</div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">No Market Data</h3>
        <p className="text-gray-600">Market categories will appear here once data is available.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          to={`/farmer/market/${category.id}`}
          className={`
            relative flex flex-col items-center justify-center p-6 rounded-2xl
            bg-gradient-to-br ${category.color} text-white
            shadow-lg hover:shadow-xl hover:scale-105 transition-all
            min-h-[140px]
          `}
        >
          <span className="text-5xl mb-2">{category.icon}</span>
          <span className="text-lg font-bold">{category.name}</span>
          <span className="text-sm opacity-90 mt-1">
            {category.commodityCount} commodities
          </span>
        </Link>
      ))}
    </div>
  );
}

export const MarketCategoryGrid = memo(MarketCategoryGridComponent);

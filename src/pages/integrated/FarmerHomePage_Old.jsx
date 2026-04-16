import { useMarketCategories } from '../../hooks/usePriceInsight';
import { useAuth } from '../../context/AuthContext';
import { MarketCategoryGrid } from '../../components/farmer/MarketCategoryGrid';
import { Link } from 'react-router-dom';

/**
 * Farmer Home Page
 * New default landing page with Category-based Market Insights
 */
export function FarmerHomePage() {
  const { user, logout } = useAuth();
  const { categories, loading, error, refetch } = useMarketCategories();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            🌾 Welcome, {user?.name || 'Farmer'}!
          </h1>
          <p className="text-gray-600 mt-1">
            View market prices and manage your products
          </p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Link
          to="/farmer/add-product"
          className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        >
          <span className="text-4xl mb-2">➕</span>
          <span className="font-bold text-lg">Add Product</span>
        </Link>
        <Link
          to="/farmer/dashboard"
          className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        >
          <span className="text-4xl mb-2">📦</span>
          <span className="font-bold text-lg">Inventory</span>
        </Link>
        <Link
          to="/farmer/dashboard"
          className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        >
          <span className="text-4xl mb-2">📋</span>
          <span className="font-bold text-lg">Orders</span>
        </Link>
        <Link
          to="/farmer/settings"
          className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        >
          <span className="text-4xl mb-2">⚙️</span>
          <span className="font-bold text-lg">Settings</span>
        </Link>
      </div>

      {/* Market Insights by Category */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span>📊</span> Market Insights
          </h2>
          <button
            onClick={refetch}
            disabled={loading}
            className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
          >
            ↻ Refresh
          </button>
        </div>
        
        <p className="text-gray-600 mb-4">
          Select a category to view current market prices for all commodities
        </p>

        <MarketCategoryGrid
          categories={categories}
          loading={loading}
          error={error}
          onRefresh={refetch}
        />
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
          <span>💡</span> How to Use Market Insights
        </h3>
        <ul className="text-gray-600 space-y-2 text-sm">
          <li>• <strong>Tap a category</strong> to view all commodities with current prices</li>
          <li>• Prices are based on <strong>actual mandi transactions</strong> from government data</li>
          <li>• <strong>Trend indicators</strong> show if prices are rising (↑), falling (↓), or stable (→)</li>
          <li>• Use these insights to <strong>set competitive prices</strong> for your products</li>
        </ul>
      </div>
    </div>
  );
}


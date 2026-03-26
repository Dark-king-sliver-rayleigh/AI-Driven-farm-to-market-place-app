import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFarmerProducts, useFarmerOrders } from '../../hooks/useData';
import { InventoryTableIntegrated } from '../../components/integrated/InventoryTableIntegrated';
import { priceInsightAPI } from '../../services/api';

/**
 * API-Integrated Farmer Dashboard
 * Tabs: My Products | Orders | 🤖 Price Intelligence
 */
export function FarmerDashboardIntegrated() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory');

  const { products, loading: productsLoading, error: productsError, refetch: refetchProducts } = useFarmerProducts();
  const { orders, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useFarmerOrders();

  const totalProducts   = products.length;
  const availableProducts = products.filter(p => p.status === 'AVAILABLE').length;
  const pendingOrders   = orders.filter(o => o.orderStatus === 'CREATED').length;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Farmer Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, {user?.name || 'Farmer'}</p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm text-red-600 border border-red-600 rounded-md hover:bg-red-50"
        >
          Logout
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">Total Products</div>
          <div className="text-2xl font-bold text-gray-800 mt-2">
            {productsLoading ? '...' : totalProducts}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">Available Products</div>
          <div className="text-2xl font-bold text-green-600 mt-2">
            {productsLoading ? '...' : availableProducts}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">Pending Orders</div>
          <div className="text-2xl font-bold text-yellow-600 mt-2">
            {ordersLoading ? '...' : pendingOrders}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b">
          <div className="flex space-x-1 p-4">
            {[
              { id: 'inventory',         label: 'My Products' },
              { id: 'orders',            label: 'Orders' },
              { id: 'priceIntelligence', label: '🤖 Price Intelligence' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-t-lg font-medium ${
                  activeTab === tab.id
                    ? 'bg-green-50 text-green-600 border-b-2 border-green-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'inventory' && (
            <InventoryTableIntegrated
              products={products}
              loading={productsLoading}
              error={productsError}
              onRefresh={refetchProducts}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersSection orders={orders} loading={ordersLoading} error={ordersError} onRefresh={refetchOrders} />
          )}

          {activeTab === 'priceIntelligence' && (
            <PriceIntelligenceSection products={products} productsLoading={productsLoading} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE INTELLIGENCE SECTION
// Shows each product's current price + AI-predicted future prices (day+1/3/7)
// ─────────────────────────────────────────────────────────────────────────────

function PriceIntelligenceSection({ products, productsLoading }) {
  const [insights, setInsights]   = useState({});   // keyed by product._id
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [mandiInput, setMandiInput] = useState('');
  const [fetchedMandi, setFetchedMandi] = useState(null);

  // Default mandi hint from product description or empty
  const handleFetchInsight = useCallback(async (product, mandi) => {
    if (!product || !mandi.trim()) return;

    const key = `${product._id}`;
    setInsights(prev => ({ ...prev, [key]: { loading: true } }));

    try {
      const res = await priceInsightAPI.getInsight(product.name, mandi.trim());
      setInsights(prev => ({ ...prev, [key]: { ...res, mandi: mandi.trim(), loading: false } }));
    } catch (err) {
      setInsights(prev => ({ ...prev, [key]: { error: err.message, loading: false } }));
    }
  }, []);

  if (productsLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-10 text-center">
        <div className="text-5xl mb-3">🌾</div>
        <h3 className="text-lg font-semibold text-gray-800">No Products Listed</h3>
        <p className="text-gray-500 mt-1">Add products first to see price intelligence.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Explanation banner */}
      <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-2xl">🤖</span>
        <div>
          <p className="font-semibold text-green-800">AI/ML-Powered Price Intelligence</p>
          <p className="text-sm text-green-700 mt-1">
            Shows your <strong>current listed price</strong> alongside <strong>AI-predicted market prices</strong> for the next 1, 3, and 7 days — trained on government Agmarknet mandi data.
            Enter the nearest mandi name next to any product to get its AI forecast.
          </p>
        </div>
      </div>

      {/* Product cards */}
      <div className="space-y-4">
        {products.map(product => {
          const insight = insights[product._id];
          return (
            <ProductPriceCard
              key={product._id}
              product={product}
              insight={insight}
              onFetchInsight={(mandi) => handleFetchInsight(product, mandi)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT PRICE CARD — shows today's price + AI forecast
// ─────────────────────────────────────────────────────────────────────────────

function ProductPriceCard({ product, insight, onFetchInsight }) {
  const [mandi, setMandi] = useState('');

  const trendConfig = {
    RISING:  { icon: '📈', color: 'text-emerald-600', label: 'Rising' },
    FALLING: { icon: '📉', color: 'text-red-500',     label: 'Falling' },
    STABLE:  { icon: '➡️', color: 'text-yellow-600',  label: 'Stable' },
  };

  const confidenceColors = {
    HIGH:   'bg-green-100 text-green-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    LOW:    'bg-red-100 text-red-700',
  };

  const tc = trendConfig[insight?.trend] || trendConfig.STABLE;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Product header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-white font-bold text-lg">{product.name}</h3>
          <p className="text-green-100 text-sm">
            {product.quantity} {product.unit} available
            <span className="mx-2">·</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              product.status === 'AVAILABLE' ? 'bg-green-200 text-green-900' : 'bg-white/20 text-white'
            }`}>{product.status}</span>
          </p>
        </div>

        {/* Today's listed price — always shown */}
        <div className="bg-white/15 rounded-xl px-5 py-3 text-right backdrop-blur-sm">
          <p className="text-green-100 text-xs uppercase tracking-wide">Your Listed Price</p>
          <p className="text-white text-2xl font-extrabold">₹{product.price}</p>
          <p className="text-green-200 text-xs">per {product.unit}</p>
        </div>
      </div>

      <div className="p-5 bg-white">
        {/* Mandi input row */}
        {!insight && (
          <div className="flex gap-3 items-center mb-1">
            <input
              type="text"
              value={mandi}
              onChange={e => setMandi(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onFetchInsight(mandi)}
              placeholder="Enter nearest mandi (e.g. Bangalore APMC)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              onClick={() => onFetchInsight(mandi)}
              disabled={!mandi.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Get AI Forecast →
            </button>
          </div>
        )}

        {/* Loading */}
        {insight?.loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
            <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            Fetching AI price forecast from mandi data...
          </div>
        )}

        {/* Error */}
        {insight?.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex justify-between items-center">
            <span>⚠️ {insight.error}</span>
            <button
              onClick={() => { setMandi(insight.mandi || ''); }}
              className="text-xs text-red-600 underline ml-3"
            >
              Try again
            </button>
          </div>
        )}

        {/* Forecast result */}
        {insight && !insight.loading && !insight.error && (
          <div className="space-y-4">
            {/* Mandi label + refresh */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                📍 {insight.mandi} &nbsp;·&nbsp; {insight.dataPoints} data point{insight.dataPoints !== 1 ? 's' : ''} used
              </span>
              <button
                onClick={() => {
                  const newMandi = prompt('Change mandi:', insight.mandi) || insight.mandi;
                  onFetchInsight(newMandi);
                }}
                className="text-xs text-green-600 underline"
              >
                Change mandi
              </button>
            </div>

            {/* Price cards row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Today's market price */}
              <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Today (Market)</p>
                <p className="text-xl font-bold text-gray-900">
                  {insight.modalPrice ? `₹${insight.modalPrice}` : '—'}
                </p>
                <p className="text-xs text-gray-400">modal price</p>
              </div>

              {/* Day +1 forecast */}
              <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                <p className="text-xs text-blue-400 uppercase tracking-wide mb-1">Tomorrow</p>
                <p className="text-xl font-bold text-blue-700">
                  {insight.forecasts?.day1 ? `₹${insight.forecasts.day1}` : `₹${insight.predictedPrice || '—'}`}
                </p>
                <p className="text-xs text-blue-400">predicted</p>
              </div>

              {/* Day +3 forecast */}
              <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
                <p className="text-xs text-purple-400 uppercase tracking-wide mb-1">In 3 Days</p>
                <p className="text-xl font-bold text-purple-700">
                  {insight.forecasts?.day3 ? `₹${insight.forecasts.day3}` : '—'}
                </p>
                <p className="text-xs text-purple-400">predicted</p>
              </div>

              {/* Day +7 forecast */}
              <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                <p className="text-xs text-amber-400 uppercase tracking-wide mb-1">In 7 Days</p>
                <p className="text-xl font-bold text-amber-700">
                  {insight.forecasts?.day7 ? `₹${insight.forecasts.day7}` : '—'}
                </p>
                <p className="text-xs text-amber-400">predicted</p>
              </div>
            </div>

            {/* Trend + confidence + AI suggestion row */}
            <div className="flex flex-wrap gap-3 items-center">
              <span className={`flex items-center gap-1 font-semibold text-sm ${tc.color}`}>
                {tc.icon} {tc.label} Trend
              </span>
              {insight.confidence && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${confidenceColors[insight.confidence] || confidenceColors.LOW}`}>
                  {insight.confidence} confidence
                </span>
              )}
              {insight.mlMetrics?.methodology && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                  🤖 {insight.mlMetrics.methodology.replace(/_/g, ' ')}
                </span>
              )}
              {insight.msp && (
                <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-medium">
                  MSP floor ₹{insight.msp}
                </span>
              )}
            </div>

            {/* AI suggested price vs your listed price */}
            {insight.suggestedPrice && (
              <div className={`rounded-xl p-4 border ${
                product.price >= insight.suggestedPrice
                  ? 'bg-green-50 border-green-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {product.price >= insight.suggestedPrice
                        ? '✅ Your price is above the AI-suggested market rate'
                        : '⚠️ Market is predicting higher — consider adjusting your price'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{insight.rationale}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">AI Suggested</p>
                    <p className="text-lg font-bold text-gray-800">₹{insight.suggestedPrice}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Model metrics */}
            {insight.mlMetrics?.rSquared !== null && insight.mlMetrics?.rSquared !== undefined && (
              <div className="flex flex-wrap gap-4 text-xs text-gray-400 border-t pt-3">
                {insight.mlMetrics.rSquared != null  && <span>R² = {insight.mlMetrics.rSquared}</span>}
                {insight.mlMetrics.meanAbsoluteError != null && <span>MAE = ₹{insight.mlMetrics.meanAbsoluteError}</span>}
                {insight.mlMetrics.mape != null && <span>Error ≈ {insight.mlMetrics.mape}%</span>}
                {insight.mlMetrics.directionalAccuracy != null && <span>Trend accuracy = {(insight.mlMetrics.directionalAccuracy * 100).toFixed(0)}%</span>}
                <span>Trained on {insight.mlMetrics.trainingDataPoints} days of data</span>
              </div>
            )}

            {/* No sufficient data note */}
            {!insight.hasValidData && (
              <p className="text-xs text-gray-400 italic">
                ℹ️ Limited market data available. Forecast accuracy improves as daily mandi data accumulates.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS SECTION (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function OrdersSection({ orders, loading, error, onRefresh }) {
  const statusColors = {
    CREATED:   'bg-blue-100 text-blue-800',
    ASSIGNED:  'bg-purple-100 text-purple-800',
    PICKED_UP: 'bg-yellow-100 text-yellow-800',
    DELIVERED: 'bg-green-100 text-green-800',
    FAILED:    'bg-red-100 text-red-800'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button onClick={onRefresh} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <div className="text-5xl mb-4">📦</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Yet</h3>
        <p className="text-gray-500">Orders for your products will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order._id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium text-gray-900">
                Order #{order._id.slice(-8).toUpperCase()}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Consumer: {order.consumerId?.name || 'Unknown'}
              </div>
              <div className="text-sm text-gray-500">
                {order.items?.length || 0} item(s) • ₹{order.totalAmount}
              </div>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[order.orderStatus]}`}>
              {order.orderStatus}
            </span>
          </div>
          <div className="mt-3 text-xs text-gray-400">
            {new Date(order.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

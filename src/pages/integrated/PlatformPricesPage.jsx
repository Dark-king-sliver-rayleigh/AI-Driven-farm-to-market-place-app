import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCommodities, useMandis } from '../../hooks/usePriceInsight';
import { usePlatformPrices, usePriceComparison } from '../../hooks/useNewFeatures';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function PlatformPricesPage() {
  const { user } = useAuth();
  const [commodity, setCommodity] = useState('');
  const [mandi, setMandi] = useState('');
  const [dateRange, setDateRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('prices');

  const { commodities, loading: commLoading } = useCommodities();
  const { mandis, loading: mandiLoading } = useMandis(commodity);

  const dateParams = (() => {
    const to = new Date();
    const from = new Date();
    if (dateRange === '7d') from.setDate(from.getDate() - 7);
    else if (dateRange === '30d') from.setDate(from.getDate() - 30);
    else from.setDate(from.getDate() - 90);
    return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
  })();

  const { prices, loading: pricesLoading, error: pricesError } = usePlatformPrices(
    commodity ? { commodity, ...dateParams, ...(mandi ? { mandi } : {}) } : {}
  );

  const { comparison, loading: compLoading, error: compError } = usePriceComparison(
    commodity && mandi ? { commodity, mandi } : {}
  );

  const compData = comparison?.comparison || comparison;

  const barChartData = compData ? [
    {
      name: commodity || 'Commodity',
      'Platform Price': compData.platformPrice?.weightedAvgPrice || compData.platformAvgPrice || 0,
      'Mandi Price': compData.mandiPrice?.avgPrice || compData.mandiAvgPrice || 0,
    }
  ] : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">&#x1F4B0; Platform Prices</h1>
        <p className="text-gray-600 mt-1">Compare your selling prices vs market mandis</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commodity</label>
            <select
              value={commodity}
              onChange={e => { setCommodity(e.target.value); setMandi(''); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select commodity...</option>
              {(commodities || []).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mandi (optional)</label>
            <select
              value={mandi}
              onChange={e => setMandi(e.target.value)}
              disabled={!commodity}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">All mandis</option>
              {(mandis || []).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="flex gap-2 w-full">
              <button
                onClick={() => setActiveTab('prices')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'prices' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Prices
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                disabled={!commodity || !mandi}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  activeTab === 'compare' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Compare
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* No commodity selected */}
      {!commodity && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <div className="text-5xl mb-3 opacity-50">&#x1F4B0;</div>
          <h3 className="text-lg font-semibold text-gray-900">Select a Commodity</h3>
          <p className="text-gray-500 mt-1">Choose a commodity to view platform prices and market comparison</p>
        </div>
      )}

      {/* Prices Tab */}
      {commodity && activeTab === 'prices' && (
        <div className="space-y-6">
          {pricesLoading && (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {pricesError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-700">{pricesError}</p>
            </div>
          )}

          {!pricesLoading && prices && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-gray-400 text-xs font-medium uppercase">Weighted Avg</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  &#x20B9;{(prices.weightedAvgPrice || prices.data?.weightedAvgPrice || 0).toFixed(2)}
                </p>
                <p className="text-gray-400 text-xs mt-1">per unit</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-gray-400 text-xs font-medium uppercase">Min Price</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  &#x20B9;{(prices.minPrice || prices.data?.minPrice || 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-gray-400 text-xs font-medium uppercase">Max Price</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  &#x20B9;{(prices.maxPrice || prices.data?.maxPrice || 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-gray-400 text-xs font-medium uppercase">Volume</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {(prices.totalVolume || prices.data?.totalVolume || 0).toFixed(0)}
                </p>
                <p className="text-gray-400 text-xs mt-1">{prices.orderCount || prices.data?.orderCount || 0} orders</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compare Tab */}
      {commodity && mandi && activeTab === 'compare' && (
        <div className="space-y-6">
          {compLoading && (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {compError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-700">{compError}</p>
            </div>
          )}

          {!compLoading && compData && (
            <>
              {/* Comparison Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white shadow-lg">
                  <p className="text-green-100 text-sm">Platform Price</p>
                  <p className="text-3xl font-bold mt-1">
                    &#x20B9;{(compData.platformPrice?.weightedAvgPrice || compData.platformAvgPrice || 0).toFixed(2)}
                  </p>
                  <p className="text-green-200 text-xs mt-2">Your selling price on AgroDirect</p>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
                  <p className="text-blue-100 text-sm">Mandi Price</p>
                  <p className="text-3xl font-bold mt-1">
                    &#x20B9;{(compData.mandiPrice?.avgPrice || compData.mandiAvgPrice || 0).toFixed(2)}
                  </p>
                  <p className="text-blue-200 text-xs mt-2">Average at {mandi}</p>
                </div>

                <div className={`rounded-2xl p-5 text-white shadow-lg ${
                  (compData.spreadPct || compData.spread?.pct || 0) >= 0
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                    : 'bg-gradient-to-br from-red-500 to-red-600'
                }`}>
                  <p className="text-white/80 text-sm">Spread</p>
                  <p className="text-3xl font-bold mt-1">
                    {(compData.spreadPct || compData.spread?.pct || 0) >= 0 ? '+' : ''}
                    {(compData.spreadPct || compData.spread?.pct || 0).toFixed(1)}%
                  </p>
                  <p className="text-white/70 text-xs mt-2">
                    &#x20B9;{(compData.spreadAmount || compData.spread?.amount || 0).toFixed(2)} difference
                  </p>
                </div>
              </div>

              {/* Bar Chart Comparison */}
              {barChartData.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Price Comparison</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={barChartData} barGap={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 14 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(val) => `\u20B9${val.toFixed(2)}`} />
                      <Legend />
                      <Bar dataKey="Platform Price" fill="#22c55e" radius={[8, 8, 0, 0]} barSize={50} />
                      <Bar dataKey="Mandi Price" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Insight */}
              <div className={`border rounded-2xl p-5 ${
                (compData.spreadPct || compData.spread?.pct || 0) >= 0
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  {(compData.spreadPct || compData.spread?.pct || 0) >= 0 ? '\u2705' : '\u26A0\uFE0F'}
                  {' '}Price Insight
                </h3>
                <p className="text-gray-600 mt-2 text-sm">
                  {(compData.spreadPct || compData.spread?.pct || 0) >= 0
                    ? `You are earning ${(compData.spreadPct || compData.spread?.pct || 0).toFixed(1)}% more than the average mandi price for ${commodity} at ${mandi}. Keep selling on the platform!`
                    : `Your platform price is ${Math.abs(compData.spreadPct || compData.spread?.pct || 0).toFixed(1)}% lower than the mandi. Consider adjusting your pricing.`
                  }
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

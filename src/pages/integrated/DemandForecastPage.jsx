import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTradedCommodities, useDemandForecast } from '../../hooks/useNewFeatures';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function DemandForecastPage() {
  const { user } = useAuth();
  const [commodity, setCommodity] = useState('');
  const [location, setLocation] = useState('');
  const [horizon, setHorizon] = useState('90d');
  const [generating, setGenerating] = useState(false);

  const { commodities, loading: commLoading } = useTradedCommodities();
  const { forecast, loading, error, refetch, generateForecast } = useDemandForecast(
    commodity ? { commodity, ...(location ? { location } : {}), horizon } : {}
  );

  async function handleGenerate() {
    if (!commodity) return;
    try {
      setGenerating(true);
      await generateForecast({ commodity, ...(location ? { location } : {}), horizon });
    } catch (err) {
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  }

  // Map forecast-level confidence string to a numeric value
  const confidenceMap = { HIGH: 90, MEDIUM: 60, LOW: 30 };
  const forecastConfidence = confidenceMap[(forecast?.confidence || '').toUpperCase()] || 0;

  const weeklyData = (forecast?.weeklyBreakdown || forecast?.weekly || []).map((w, i) => ({
    week: w.weekLabel || `Week ${w.weekNumber || w.week || i + 1}`,
    quantity: w.forecastQty || w.qty || 0,
    confidence: forecastConfidence,
    lowerBound: w.lowerBound || 0,
    upperBound: w.upperBound || 0,
  }));

  const totalQty = weeklyData.reduce((s, w) => s + w.quantity, 0);
  const avgConfidence = weeklyData.length > 0
    ? weeklyData.reduce((s, w) => s + w.confidence, 0) / weeklyData.length
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">&#x1F4C8; Demand Forecast</h1>
        <p className="text-gray-600 mt-1">AI-powered demand predictions to plan your production</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commodity</label>
            <select
              value={commodity}
              onChange={e => setCommodity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select commodity...</option>
              {(commodities || []).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Mumbai"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horizon</label>
            <select
              value={horizon}
              onChange={e => setHorizon(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="30d">30 days</option>
              <option value="60d">60 days</option>
              <option value="90d">90 days (recommended)</option>
              <option value="12w">12 weeks</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={!commodity || generating}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? '\u23F3 Generating...' : '\u{1F504} Generate Forecast'}
            </button>
          </div>
        </div>
      </div>

      {/* No commodity selected */}
      {!commodity && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <div className="text-5xl mb-3 opacity-50">&#x1F4C8;</div>
          <h3 className="text-lg font-semibold text-gray-900">Select a Commodity</h3>
          <p className="text-gray-500 mt-1">Choose a commodity to view demand forecast predictions</p>
        </div>
      )}

      {/* Loading */}
      {commodity && loading && (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-red-700">{error}</p>
          <button onClick={refetch} className="mt-2 text-sm text-red-600 underline">Retry</button>
        </div>
      )}

      {/* Forecast Results */}
      {commodity && !loading && forecast && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-gray-400 text-xs font-medium uppercase">Total Forecast</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{totalQty.toFixed(0)}</p>
              <p className="text-gray-400 text-xs mt-1">units</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-gray-400 text-xs font-medium uppercase">Confidence</p>
              <p className={`text-3xl font-bold mt-1 ${avgConfidence >= 70 ? 'text-green-600' : avgConfidence >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                {avgConfidence.toFixed(0)}%
              </p>
              <p className="text-gray-400 text-xs mt-1">avg confidence</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-gray-400 text-xs font-medium uppercase">Commodity</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{forecast.commodity || commodity}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-gray-400 text-xs font-medium uppercase">Generated</p>
              <p className="text-sm font-bold text-gray-900 mt-1">
                {forecast.generatedAt
                  ? new Date(forecast.generatedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Just now'
                }
              </p>
            </div>
          </div>

          {/* Forecast Area Chart */}
          {weeklyData.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">&#x1F4CA; Demand Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="quantity" stroke="#22c55e" strokeWidth={2} fill="url(#colorQty)" name="Forecast Qty" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Weekly Breakdown Table */}
          {weeklyData.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm overflow-x-auto">
              <h3 className="text-lg font-bold text-gray-900 mb-4">&#x1F4CB; Weekly Breakdown</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="pb-3 font-semibold text-gray-600">Period</th>
                    <th className="pb-3 font-semibold text-gray-600 text-right">Forecast Qty</th>
                    <th className="pb-3 font-semibold text-gray-600 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyData.map((w, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-3 font-medium text-gray-900">{w.week}</td>
                      <td className="py-3 text-right font-bold text-gray-900">{w.quantity.toFixed(0)}</td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          w.confidence >= 70 ? 'bg-green-100 text-green-700' :
                          w.confidence >= 40 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {w.confidence.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Assumptions */}
          {(forecast.assumptions || []).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <h3 className="font-bold text-blue-900 flex items-center gap-2">
                <span>&#x2139;&#xFE0F;</span> Forecast Assumptions
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-blue-700">
                {forecast.assumptions.map((a, i) => (
                  <li key={i}>&#x2022; {a}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Method Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
            <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm">
              <span>&#x1F52C;</span> Methodology
            </h3>
            <p className="text-gray-500 text-xs mt-2">
              This forecast uses a statistical baseline method combining moving averages, linear trend detection,
              day-of-week seasonality patterns, and recency weighting from historical order data.
              Confidence levels indicate data sufficiency — more historical data improves accuracy.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

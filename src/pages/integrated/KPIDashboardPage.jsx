import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKPISummary, useKPITimeSeries } from '../../hooks/useNewFeatures';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

export function KPIDashboardPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  
  const dateParams = useMemo(() => {
    const to = new Date();
    const from = new Date();
    if (range === '7d') from.setDate(from.getDate() - 7);
    else if (range === '30d') from.setDate(from.getDate() - 30);
    else if (range === '90d') from.setDate(from.getDate() - 90);
    else from.setFullYear(from.getFullYear() - 1);
    return { from: formatDate(from), to: formatDate(to) };
  }, [range]);

  const { summary, loading: summaryLoading, error: summaryError, refetch } = useKPISummary(dateParams);
  const { timeSeries, loading: tsLoading } = useKPITimeSeries({ ...dateParams, interval: range === '7d' ? 'day' : range === '30d' ? 'day' : 'week' });

  const kpiData = summary?.kpi || summary || {};

  const onTimePct = kpiData.onTimePercentage ?? kpiData.onTime?.percentage ?? 0;
  const avgDistance = kpiData.averageDistancePerOrder ?? kpiData.avgDistance?.averageKm ?? 0;
  const capUtil = kpiData.capacityUtilization ?? kpiData.capacity?.utilizationPct ?? 0;
  const totalDelivered = kpiData.onTime?.totalDelivered ?? kpiData.totalDelivered ?? 0;
  const onTimeCount = kpiData.onTime?.onTimeCount ?? 0;
  const lateCount = totalDelivered - onTimeCount;

  const pieData = totalDelivered > 0 ? [
    { name: 'On Time', value: onTimeCount, fill: '#22c55e' },
    { name: 'Late', value: lateCount, fill: '#ef4444' },
  ] : [];

  const tsFormatted = (timeSeries || []).map(item => ({
    ...item,
    label: item.date ? new Date(item.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : item.period,
    onTime: item.onTimePercentage ?? item.onTimePct ?? 0,
    distance: item.averageDistancePerOrder ?? item.avgDistanceKm ?? 0,
    utilization: item.capacityUtilization ?? item.utilizationPct ?? 0,
  }));

  const COLORS = ['#8b5cf6', '#22c55e', '#f59e0b', '#ef4444'];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 text-white px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => navigate('/logistics/home')} className="mb-4 p-2 hover:bg-purple-700 rounded-full transition-colors">
            &#8592; Back
          </button>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold">&#x1F4CA; Performance Dashboard</h1>
              <p className="text-purple-200 mt-1">Key logistics metrics at a glance</p>
            </div>
            <div className="flex gap-2">
              {['7d', '30d', '90d', '1y'].map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    range === r ? 'bg-white text-purple-800' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {summaryLoading && (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {summaryError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-700">{summaryError}</p>
            <button onClick={refetch} className="mt-2 text-sm text-red-600 underline">Retry</button>
          </div>
        )}

        {!summaryLoading && !summaryError && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* On-Time */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg">&#x23F1;&#xFE0F;</div>
                  <p className="text-gray-500 text-sm font-medium">On-Time Delivery</p>
                </div>
                <p className={`text-4xl font-bold ${onTimePct >= 90 ? 'text-green-600' : onTimePct >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {onTimePct.toFixed(1)}%
                </p>
                <p className="text-gray-400 text-xs mt-1">{totalDelivered} total deliveries</p>
              </div>

              {/* Avg Distance */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">&#x1F4CF;</div>
                  <p className="text-gray-500 text-sm font-medium">Avg Distance / Order</p>
                </div>
                <p className="text-4xl font-bold text-blue-600">
                  {avgDistance.toFixed(1)}<span className="text-lg text-gray-400 ml-1">km</span>
                </p>
                <p className="text-gray-400 text-xs mt-1">Per delivered order</p>
              </div>

              {/* Capacity Utilization */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg">&#x1F4E6;</div>
                  <p className="text-gray-500 text-sm font-medium">Capacity Utilization</p>
                </div>
                <p className={`text-4xl font-bold ${capUtil >= 80 ? 'text-green-600' : capUtil >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {capUtil.toFixed(1)}%
                </p>
                <p className="text-gray-400 text-xs mt-1">Vehicle load efficiency</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* On-Time Pie Chart */}
              {pieData.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Delivery Performance</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Time Series Chart */}
              {tsFormatted.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">On-Time % Trend</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={tsFormatted}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="onTime" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="On-Time %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Distance & Utilization Bar Charts */}
            {tsFormatted.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Avg Distance Trend (km)</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={tsFormatted}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="distance" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Avg Distance (km)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Capacity Utilization Trend</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={tsFormatted}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="utilization" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Utilization %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* No data state */}
            {!tsLoading && tsFormatted.length === 0 && totalDelivered === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="text-5xl mb-3 opacity-50">&#x1F4CA;</div>
                <h3 className="text-lg font-semibold text-gray-900">No Data Yet</h3>
                <p className="text-gray-500 mt-1">Complete deliveries to see performance metrics</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

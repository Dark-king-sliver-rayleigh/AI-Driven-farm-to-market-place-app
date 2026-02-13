const LogisticsKPIService = require('../services/LogisticsKPIService');

/**
 * KPI Controller
 *
 * Provides logistics Key Performance Indicator endpoints.
 * All endpoints require LOGISTICS role.
 */

/**
 * @desc    Get KPI summary for a date range
 * @route   GET /api/logistics/kpi/summary
 * @access  Private (LOGISTICS)
 *
 * Query: from (ISO date), to (ISO date), driverId (optional)
 */
const getKPISummary = async (req, res) => {
  try {
    const { from, to, driverId } = req.query;

    const summary = await LogisticsKPIService.getSummary({
      from: from || null,
      to: to || null,
      driverId: driverId || null
    });

    res.status(200).json({
      success: true,
      ...summary
    });
  } catch (error) {
    console.error('getKPISummary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while computing KPIs'
    });
  }
};

/**
 * @desc    Get on-time delivery percentage
 * @route   GET /api/logistics/kpi/on-time
 * @access  Private (LOGISTICS)
 *
 * Query: from, to, driverId
 */
const getOnTimePercentage = async (req, res) => {
  try {
    const { from, to, driverId } = req.query;

    const summary = await LogisticsKPIService.getSummary({
      from: from || null,
      to: to || null,
      driverId: driverId || null
    });

    res.status(200).json({
      success: true,
      period: summary.period,
      onTimePercentage: summary.kpis.onTimePercentage,
      delivered: summary.counts.delivered,
      delayed: summary.counts.delayed
    });
  } catch (error) {
    console.error('getOnTimePercentage error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get average distance per order
 * @route   GET /api/logistics/kpi/avg-distance
 * @access  Private (LOGISTICS)
 *
 * Query: from, to, driverId
 */
const getAvgDistance = async (req, res) => {
  try {
    const { from, to, driverId } = req.query;

    const summary = await LogisticsKPIService.getSummary({
      from: from || null,
      to: to || null,
      driverId: driverId || null
    });

    res.status(200).json({
      success: true,
      period: summary.period,
      averageDistancePerOrderKm: summary.kpis.averageDistancePerOrderKm,
      delivered: summary.counts.delivered
    });
  } catch (error) {
    console.error('getAvgDistance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get capacity utilization percentage
 * @route   GET /api/logistics/kpi/capacity-utilization
 * @access  Private (LOGISTICS)
 *
 * Query: from, to, driverId
 */
const getCapacityUtilization = async (req, res) => {
  try {
    const { from, to, driverId } = req.query;

    const summary = await LogisticsKPIService.getSummary({
      from: from || null,
      to: to || null,
      driverId: driverId || null
    });

    res.status(200).json({
      success: true,
      period: summary.period,
      capacityUtilizationPct: summary.kpis.capacityUtilizationPct
    });
  } catch (error) {
    console.error('getCapacityUtilization error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get KPI time series (daily or weekly buckets)
 * @route   GET /api/logistics/kpi/time-series
 * @access  Private (LOGISTICS)
 *
 * Query: from, to, driverId, granularity (day | week)
 */
const getKPITimeSeries = async (req, res) => {
  try {
    const { from, to, driverId, granularity } = req.query;

    const series = await LogisticsKPIService.getTimeSeries({
      from: from || null,
      to: to || null,
      driverId: driverId || null,
      granularity: granularity || 'day'
    });

    res.status(200).json({
      success: true,
      granularity: granularity || 'day',
      count: series.length,
      series
    });
  } catch (error) {
    console.error('getKPITimeSeries error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getKPISummary,
  getOnTimePercentage,
  getAvgDistance,
  getCapacityUtilization,
  getKPITimeSeries
};

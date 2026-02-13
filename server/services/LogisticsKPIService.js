const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const RoutePlan = require('../models/RoutePlan');
const User = require('../models/User');

/**
 * LogisticsKPIService
 *
 * Computes operational KPIs for the logistics dashboard:
 *
 *  1. On-time Delivery %
 *     Formula: (deliveries completed before expectedDeliveryTime) / (total delivered) * 100
 *
 *  2. Average Distance Per Order (km)
 *     Formula: SUM(distance of delivered orders) / COUNT(delivered orders)
 *
 *  3. Capacity Utilization %
 *     Formula: SUM(usedCapacityKg across route plans) / SUM(vehicleCapacityKg) * 100
 *
 * All metrics support date-range filtering and time-series breakdowns.
 */

class LogisticsKPIService {

  /**
   * Compute all KPIs for a date range.
   *
   * @param {Object} params
   * @param {Date}   params.from  - Start date (inclusive)
   * @param {Date}   params.to    - End date (inclusive)
   * @param {string} [params.driverId] - Optional driver filter
   * @returns {Promise<Object>} KPI summary
   */
  static async getSummary({ from, to, driverId }) {
    const dateFilter = this._buildDateFilter(from, to);

    const [onTime, avgDistance, utilization, counts] = await Promise.all([
      this._calcOnTimePercentage(dateFilter, driverId),
      this._calcAverageDistance(dateFilter, driverId),
      this._calcCapacityUtilization(dateFilter, driverId),
      this._calcCounts(dateFilter, driverId)
    ]);

    return {
      period: { from, to },
      driverId: driverId || null,
      kpis: {
        onTimePercentage: onTime,
        averageDistancePerOrderKm: avgDistance,
        capacityUtilizationPct: utilization
      },
      counts
    };
  }

  /**
   * Time-series breakdown of KPIs per day.
   */
  static async getTimeSeries({ from, to, driverId, granularity = 'day' }) {
    const dateFilter = this._buildDateFilter(from, to);
    const matchFilter = { deliveryStatus: 'DELIVERED', ...dateFilter };
    if (driverId) matchFilter.driverId = driverId;

    // Group format based on granularity
    const groupId = granularity === 'week'
      ? { year: { $isoWeekYear: '$updatedAt' }, week: { $isoWeek: '$updatedAt' } }
      : { year: { $year: '$updatedAt' }, month: { $month: '$updatedAt' }, day: { $dayOfMonth: '$updatedAt' } };

    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: groupId,
          totalDelivered: { $sum: 1 },
          onTimeCount: {
            $sum: {
              $cond: [
                { $lte: ['$updatedAt', '$expectedDeliveryTime'] },
                1,
                0
              ]
            }
          },
          totalDistanceKm: { $sum: { $ifNull: ['$distance', 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
    ];

    const timeData = await Delivery.aggregate(pipeline);

    return timeData.map(bucket => {
      const onTimePct = bucket.totalDelivered > 0
        ? Math.round((bucket.onTimeCount / bucket.totalDelivered) * 100 * 100) / 100
        : 0;
      const avgDist = bucket.totalDelivered > 0
        ? Math.round((bucket.totalDistanceKm / bucket.totalDelivered) * 100) / 100
        : 0;

      return {
        period: bucket._id,
        totalDelivered: bucket.totalDelivered,
        onTimePercentage: onTimePct,
        averageDistancePerOrderKm: avgDist
      };
    });
  }

  // ─── Private helpers ─────────────────────────────────────────

  static _buildDateFilter(from, to) {
    const filter = {};
    if (from || to) {
      filter.updatedAt = {};
      if (from) filter.updatedAt.$gte = new Date(from);
      if (to) filter.updatedAt.$lte = new Date(to);
    }
    return filter;
  }

  /**
   * On-time % = delivered before expectedDeliveryTime / total delivered * 100
   */
  static async _calcOnTimePercentage(dateFilter, driverId) {
    const match = { deliveryStatus: 'DELIVERED', ...dateFilter };
    if (driverId) match.driverId = driverId;

    const result = await Delivery.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          onTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$expectedDeliveryTime', null] },
                    { $lte: ['$updatedAt', '$expectedDeliveryTime'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    if (!result.length || result[0].total === 0) return 0;
    return Math.round((result[0].onTime / result[0].total) * 100 * 100) / 100;
  }

  /**
   * Avg distance = total delivered distance km / delivered order count
   */
  static async _calcAverageDistance(dateFilter, driverId) {
    const match = { deliveryStatus: 'DELIVERED', ...dateFilter };
    if (driverId) match.driverId = driverId;

    const result = await Delivery.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalDistance: { $sum: { $ifNull: ['$distance', 0] } },
          count: { $sum: 1 }
        }
      }
    ]);

    if (!result.length || result[0].count === 0) return 0;
    return Math.round((result[0].totalDistance / result[0].count) * 100) / 100;
  }

  /**
   * Capacity utilization = usedCapacity / availableCapacity across route plans
   */
  static async _calcCapacityUtilization(dateFilter, driverId) {
    // Map dateFilter from updatedAt to date for RoutePlan
    const rpFilter = {};
    if (dateFilter.updatedAt) {
      rpFilter.date = {};
      if (dateFilter.updatedAt.$gte) rpFilter.date.$gte = dateFilter.updatedAt.$gte;
      if (dateFilter.updatedAt.$lte) rpFilter.date.$lte = dateFilter.updatedAt.$lte;
    }
    if (driverId) rpFilter.driverId = driverId;

    const result = await RoutePlan.aggregate([
      { $match: { status: { $in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] }, ...rpFilter } },
      {
        $group: {
          _id: null,
          totalUsed: { $sum: '$usedCapacityKg' },
          totalCapacity: { $sum: '$vehicleCapacityKg' }
        }
      }
    ]);

    if (!result.length || result[0].totalCapacity === 0) return 0;
    return Math.round((result[0].totalUsed / result[0].totalCapacity) * 100 * 100) / 100;
  }

  /**
   * General counts for the period.
   */
  static async _calcCounts(dateFilter, driverId) {
    const baseMatch = { ...dateFilter };
    if (driverId) baseMatch.driverId = driverId;

    const [deliveredCount, failedCount, totalCount, delayedCount] = await Promise.all([
      Delivery.countDocuments({ deliveryStatus: 'DELIVERED', ...baseMatch }),
      Delivery.countDocuments({ deliveryStatus: 'FAILED', ...baseMatch }),
      Delivery.countDocuments(baseMatch),
      Delivery.countDocuments({ isDelayed: true, ...baseMatch })
    ]);

    return {
      totalDeliveries: totalCount,
      delivered: deliveredCount,
      failed: failedCount,
      delayed: delayedCount
    };
  }
}

module.exports = LogisticsKPIService;

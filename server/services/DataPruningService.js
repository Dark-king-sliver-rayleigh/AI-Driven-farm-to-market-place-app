/**
 * DataPruningService
 * 
 * Implements data retention policy for market price records.
 * Retains only the last 30-90 days of data (configurable).
 * Older records are deleted to maintain database efficiency.
 * 
 * ACADEMIC NOTE:
 * - Maintains reasonable database size
 * - Historical data beyond retention period is not needed for price insights
 * - Logs pruning actions for audit trail
 */
const MarketPrice = require('../models/MarketPrice');

class DataPruningService {
  constructor() {
    // Default retention: 90 days, configurable via environment
    this.retentionDays = parseInt(process.env.DATA_RETENTION_DAYS) || 90;
    this.minRetentionDays = 30;
    this.maxRetentionDays = 365;
  }

  /**
   * Prune records older than the retention period
   * @param {number} retentionDays - Days to retain (optional, uses env default)
   * @returns {Promise<Object>} Pruning result
   */
  async pruneOldRecords(retentionDays = null) {
    const days = this._validateRetentionDays(retentionDays || this.retentionDays);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    console.log(`[DataPruningService] Pruning records older than ${days} days (before ${cutoffDate.toISOString().split('T')[0]})`);

    try {
      // Count records to be deleted
      const countToDelete = await MarketPrice.countDocuments({
        date: { $lt: cutoffDate }
      });

      if (countToDelete === 0) {
        console.log('[DataPruningService] No records to prune');
        return {
          success: true,
          recordsDeleted: 0,
          cutoffDate,
          retentionDays: days
        };
      }

      // Delete old records
      const deleteResult = await MarketPrice.deleteMany({
        date: { $lt: cutoffDate }
      });

      console.log(`[DataPruningService] Pruned ${deleteResult.deletedCount} records`);

      return {
        success: true,
        recordsDeleted: deleteResult.deletedCount,
        cutoffDate,
        retentionDays: days,
        prunedAt: new Date()
      };

    } catch (error) {
      console.error('[DataPruningService] Pruning error:', error);
      return {
        success: false,
        error: error.message,
        recordsDeleted: 0,
        cutoffDate,
        retentionDays: days
      };
    }
  }

  /**
   * Get statistics about stored records
   * @returns {Promise<Object>} Record statistics
   */
  async getRecordStats() {
    const totalCount = await MarketPrice.countDocuments();
    
    const oldestRecord = await MarketPrice.findOne()
      .sort({ date: 1 })
      .select('date')
      .lean();
    
    const newestRecord = await MarketPrice.findOne()
      .sort({ date: -1 })
      .select('date')
      .lean();

    // Count records by age buckets
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const last30Days = await MarketPrice.countDocuments({
      date: { $gte: thirtyDaysAgo }
    });

    const days31To60 = await MarketPrice.countDocuments({
      date: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });

    const days61To90 = await MarketPrice.countDocuments({
      date: { $gte: ninetyDaysAgo, $lt: sixtyDaysAgo }
    });

    const olderThan90 = await MarketPrice.countDocuments({
      date: { $lt: ninetyDaysAgo }
    });

    return {
      totalRecords: totalCount,
      oldestDate: oldestRecord?.date || null,
      newestDate: newestRecord?.date || null,
      ageDistribution: {
        last30Days,
        days31To60,
        days61To90,
        olderThan90
      },
      retentionSettings: {
        currentRetentionDays: this.retentionDays,
        minAllowed: this.minRetentionDays,
        maxAllowed: this.maxRetentionDays
      }
    };
  }

  /**
   * Get count of records that would be pruned
   * @param {number} retentionDays - Days to retain
   * @returns {Promise<number>} Count of records to be pruned
   */
  async getRecordsToPruneCount(retentionDays = null) {
    const days = this._validateRetentionDays(retentionDays || this.retentionDays);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await MarketPrice.countDocuments({
      date: { $lt: cutoffDate }
    });
  }

  /**
   * Validate retention days within allowed range
   * @private
   */
  _validateRetentionDays(days) {
    const parsed = parseInt(days);
    if (isNaN(parsed) || parsed < this.minRetentionDays) {
      return this.minRetentionDays;
    }
    if (parsed > this.maxRetentionDays) {
      return this.maxRetentionDays;
    }
    return parsed;
  }

  /**
   * Archive old records before deletion (if needed in future)
   * Currently just logs the records that would be archived
   * @param {number} retentionDays - Days to retain
   * @returns {Promise<Object>} Archive result
   */
  async archiveOldRecords(retentionDays = null) {
    const days = this._validateRetentionDays(retentionDays || this.retentionDays);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recordsToArchive = await MarketPrice.find({
      date: { $lt: cutoffDate }
    })
    .select('commodity mandi date modalPrice')
    .lean();

    // Log archive summary (in production, this could write to a file or archive collection)
    console.log(`[DataPruningService] Archive: ${recordsToArchive.length} records from before ${cutoffDate.toISOString().split('T')[0]}`);

    return {
      recordCount: recordsToArchive.length,
      cutoffDate,
      archived: false, // Set to true when actual archiving is implemented
      message: 'Archive logging only - records will be deleted by pruneOldRecords'
    };
  }
}

module.exports = new DataPruningService();

/**
 * DataFreshnessService
 * 
 * Checks data staleness before computing price insights.
 * If data is older than 24 hours, either triggers a refresh
 * or marks confidence as LOW.
 * 
 * ACADEMIC NOTE:
 * This ensures price insights are based on recent data.
 * Stale data is flagged to maintain transparency.
 */
const MarketPrice = require('../models/MarketPrice');
const MandiPriceService = require('./MandiPriceService');

class DataFreshnessService {
  constructor() {
    this.staleThresholdHours = parseInt(process.env.STALE_THRESHOLD_HOURS) || 24;
    this.refreshInProgress = false;
  }

  /**
   * Check if the most recent market data is stale
   * @param {number} thresholdHours - Hours after which data is considered stale
   * @returns {Promise<boolean>} True if data is stale
   */
  async isDataStale(thresholdHours = null) {
    const threshold = thresholdHours || this.staleThresholdHours;
    const ageHours = await this.getDataAgeHours();
    
    if (ageHours === null) {
      // No data at all - definitely stale
      return true;
    }
    
    return ageHours > threshold;
  }

  /**
   * Get the age of the most recent data in hours
   * @returns {Promise<number|null>} Age in hours, or null if no data
   */
  async getDataAgeHours() {
    const latestRecord = await MarketPrice.findOne()
      .sort({ date: -1 })
      .select('date')
      .lean();

    if (!latestRecord || !latestRecord.date) {
      return null;
    }

    const now = new Date();
    const dataDate = new Date(latestRecord.date);
    const diffMs = now - dataDate;
    const diffHours = diffMs / (1000 * 60 * 60);

    return Math.round(diffHours * 10) / 10; // Round to 1 decimal
  }

  /**
   * Get data freshness status for a specific commodity/mandi
   * @param {string} commodity - Commodity name
   * @param {string} mandi - Mandi name
   * @returns {Promise<Object>} Freshness status
   */
  async getDataFreshness(commodity, mandi) {
    const query = {};
    if (commodity) {
      query.commodity = { $regex: new RegExp(commodity, 'i') };
    }
    if (mandi) {
      query.mandi = { $regex: new RegExp(mandi, 'i') };
    }

    const latestRecord = await MarketPrice.findOne(query)
      .sort({ date: -1 })
      .select('date fetchedAt')
      .lean();

    if (!latestRecord) {
      return {
        hasData: false,
        isStale: true,
        ageHours: null,
        lastDataDate: null,
        lastFetchedAt: null,
        freshnessLevel: 'NONE'
      };
    }

    const now = new Date();
    const dataDate = new Date(latestRecord.date);
    const ageHours = (now - dataDate) / (1000 * 60 * 60);
    
    let freshnessLevel;
    if (ageHours <= 24) {
      freshnessLevel = 'FRESH';
    } else if (ageHours <= 72) {
      freshnessLevel = 'RECENT';
    } else if (ageHours <= 168) { // 7 days
      freshnessLevel = 'AGING';
    } else {
      freshnessLevel = 'STALE';
    }

    return {
      hasData: true,
      isStale: ageHours > this.staleThresholdHours,
      ageHours: Math.round(ageHours * 10) / 10,
      lastDataDate: latestRecord.date,
      lastFetchedAt: latestRecord.fetchedAt || null,
      freshnessLevel
    };
  }

  /**
   * Trigger a data refresh if data is stale
   * Returns immediately if refresh is already in progress
   * 
   * @returns {Promise<Object>} Refresh result
   */
  async triggerRefreshIfNeeded() {
    const isStale = await this.isDataStale();
    
    if (!isStale) {
      return {
        triggered: false,
        reason: 'Data is fresh',
        ageHours: await this.getDataAgeHours()
      };
    }

    if (this.refreshInProgress) {
      return {
        triggered: false,
        reason: 'Refresh already in progress'
      };
    }

    return await this.triggerRefresh();
  }

  /**
   * Force trigger a data refresh
   * @returns {Promise<Object>} Refresh result
   */
  async triggerRefresh() {
    if (this.refreshInProgress) {
      return {
        triggered: false,
        reason: 'Refresh already in progress'
      };
    }

    this.refreshInProgress = true;
    console.log('[DataFreshnessService] Triggering data refresh...');

    try {
      const result = await MandiPriceService.fetchDailyPrices();
      
      return {
        triggered: true,
        success: result.success,
        recordsProcessed: result.recordsProcessed,
        recordsInserted: result.recordsInserted,
        errors: result.errors
      };
    } catch (error) {
      console.error('[DataFreshnessService] Refresh error:', error);
      return {
        triggered: true,
        success: false,
        error: error.message
      };
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Get overall data freshness summary
   * @returns {Promise<Object>} Summary stats
   */
  async getFreshnessSummary() {
    const stats = await MandiPriceService.getStats();
    const ageHours = await this.getDataAgeHours();
    const isStale = await this.isDataStale();

    return {
      totalRecords: stats.totalRecords,
      oldestDate: stats.oldestDate,
      newestDate: stats.newestDate,
      lastFetchedAt: stats.lastFetchedAt,
      dataAgeHours: ageHours,
      isStale,
      staleThresholdHours: this.staleThresholdHours
    };
  }
}

module.exports = new DataFreshnessService();

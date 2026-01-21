/**
 * Price Data Scheduler
 * 
 * Background job scheduler for:
 * 1. Daily price fetch from data.gov.in (6 AM IST)
 * 2. Daily pruning of old records (2 AM IST)
 * 
 * ACADEMIC NOTE:
 * - Uses simple setInterval for scheduling (no external dependencies)
 * - Runs automatically on server startup
 * - Respects API rate limits with built-in delays
 */
const MandiPriceService = require('../services/MandiPriceService');
const DataPruningService = require('../services/DataPruningService');
const DataFreshnessService = require('../services/DataFreshnessService');

class PriceDataScheduler {
  constructor() {
    this.fetchIntervalHours = parseInt(process.env.PRICE_FETCH_INTERVAL_HOURS) || 24;
    this.isRunning = false;
    this.fetchTimer = null;
    this.pruneTimer = null;
    this.lastFetchTime = null;
    this.lastPruneTime = null;
  }

  /**
   * Initialize and start the scheduler
   * Called from server.js on startup
   */
  start() {
    if (this.isRunning) {
      console.log('[PriceDataScheduler] Already running');
      return;
    }

    console.log('[PriceDataScheduler] Initializing price data scheduler...');
    this.isRunning = true;

    // Run initial checks on startup (with delay to allow DB connection)
    setTimeout(() => this._runStartupTasks(), 5000);

    // Schedule recurring tasks
    this._scheduleDailyFetch();
    this._scheduleDailyPrune();

    console.log(`[PriceDataScheduler] Scheduler started. Fetch interval: ${this.fetchIntervalHours} hours`);
  }

  /**
   * Stop the scheduler
   * Called on server shutdown
   */
  stop() {
    console.log('[PriceDataScheduler] Stopping scheduler...');
    this.isRunning = false;

    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
      this.fetchTimer = null;
    }

    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }

    console.log('[PriceDataScheduler] Scheduler stopped');
  }

  /**
   * Run startup tasks
   * @private
   */
  async _runStartupTasks() {
    try {
      console.log('[PriceDataScheduler] Running startup checks...');

      // Check data freshness
      const freshness = await DataFreshnessService.getFreshnessSummary();
      console.log(`[PriceDataScheduler] Data status: ${freshness.totalRecords} records, ` +
                  `${freshness.isStale ? 'STALE' : 'FRESH'} (${freshness.dataAgeHours || 0} hours old)`);

      // If data is stale and API key is configured, trigger fetch
      if (freshness.isStale && process.env.DATA_GOV_API_KEY) {
        console.log('[PriceDataScheduler] Data is stale, triggering fetch...');
        await this._executeFetch();
      } else if (!process.env.DATA_GOV_API_KEY) {
        console.log('[PriceDataScheduler] DATA_GOV_API_KEY not configured - skipping auto-fetch');
      }

    } catch (error) {
      console.error('[PriceDataScheduler] Startup task error:', error.message);
    }
  }

  /**
   * Schedule daily price fetch
   * @private
   */
  _scheduleDailyFetch() {
    const intervalMs = this.fetchIntervalHours * 60 * 60 * 1000;
    
    this.fetchTimer = setInterval(async () => {
      if (!this.isRunning) return;
      await this._executeFetch();
    }, intervalMs);

    console.log(`[PriceDataScheduler] Fetch scheduled every ${this.fetchIntervalHours} hours`);
  }

  /**
   * Schedule daily pruning (every 24 hours)
   * @private
   */
  _scheduleDailyPrune() {
    const intervalMs = 24 * 60 * 60 * 1000; // Every 24 hours
    
    this.pruneTimer = setInterval(async () => {
      if (!this.isRunning) return;
      await this._executePrune();
    }, intervalMs);

    console.log('[PriceDataScheduler] Prune scheduled every 24 hours');
  }

  /**
   * Execute price fetch
   * @private
   */
  async _executeFetch() {
    if (!process.env.DATA_GOV_API_KEY) {
      console.log('[PriceDataScheduler] Skipping fetch - API key not configured');
      return;
    }

    console.log('[PriceDataScheduler] Executing scheduled price fetch...');
    this.lastFetchTime = new Date();

    try {
      const result = await MandiPriceService.fetchDailyPrices();
      
      if (result.success) {
        console.log(`[PriceDataScheduler] Fetch complete: ${result.recordsInserted} new, ${result.recordsUpdated} updated`);
      } else {
        console.error('[PriceDataScheduler] Fetch failed:', result.errors);
      }

    } catch (error) {
      console.error('[PriceDataScheduler] Fetch error:', error.message);
    }
  }

  /**
   * Execute data pruning
   * @private
   */
  async _executePrune() {
    console.log('[PriceDataScheduler] Executing scheduled data pruning...');
    this.lastPruneTime = new Date();

    try {
      const result = await DataPruningService.pruneOldRecords();
      
      if (result.success) {
        console.log(`[PriceDataScheduler] Pruning complete: ${result.recordsDeleted} records removed`);
      } else {
        console.error('[PriceDataScheduler] Pruning failed:', result.error);
      }

    } catch (error) {
      console.error('[PriceDataScheduler] Pruning error:', error.message);
    }
  }

  /**
   * Manually trigger a price fetch
   * @returns {Promise<Object>} Fetch result
   */
  async triggerFetch() {
    console.log('[PriceDataScheduler] Manual fetch triggered');
    return await MandiPriceService.fetchDailyPrices();
  }

  /**
   * Manually trigger data pruning
   * @returns {Promise<Object>} Prune result
   */
  async triggerPrune() {
    console.log('[PriceDataScheduler] Manual prune triggered');
    return await DataPruningService.pruneOldRecords();
  }

  /**
   * Get scheduler status
   * @returns {Object} Current scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      fetchIntervalHours: this.fetchIntervalHours,
      lastFetchTime: this.lastFetchTime,
      lastPruneTime: this.lastPruneTime,
      apiKeyConfigured: !!process.env.DATA_GOV_API_KEY
    };
  }
}

module.exports = new PriceDataScheduler();

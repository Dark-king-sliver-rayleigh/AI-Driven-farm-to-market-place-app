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
const VarietyPriceService = require('../services/VarietyPriceService');
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
   * Execute price fetch from both APIs
   * @private
   */
  async _executeFetch() {
    if (!process.env.DATA_GOV_API_KEY) {
      console.log('[PriceDataScheduler] Skipping fetch - API key not configured');
      return;
    }

    console.log('[PriceDataScheduler] Executing scheduled price fetch...');
    this.lastFetchTime = new Date();

    const results = {
      mandi: null,
      variety: null
    };

    // 1. Fetch from MandiPriceService (Current Daily Price API)
    try {
      console.log('[PriceDataScheduler] Fetching from MandiPriceService...');
      results.mandi = await MandiPriceService.fetchDailyPrices();
      
      if (results.mandi.success) {
        console.log(`[PriceDataScheduler] Mandi fetch complete: ${results.mandi.recordsInserted} new, ${results.mandi.recordsUpdated} updated`);
      } else {
        console.error('[PriceDataScheduler] Mandi fetch failed:', results.mandi.errors);
      }

    } catch (error) {
      console.error('[PriceDataScheduler] Mandi fetch error:', error.message);
      results.mandi = { success: false, errors: [error.message] };
    }

    // 2. Wait 5 minutes between API calls to respect rate limits
    console.log('[PriceDataScheduler] Waiting 5 minutes before variety fetch...');
    await this._delay(5 * 60 * 1000); // 5 minutes

    // 3. Fetch from VarietyPriceService (Variety-wise Daily Price API)
    try {
      console.log('[PriceDataScheduler] Fetching from VarietyPriceService...');
      results.variety = await VarietyPriceService.fetchDailyPrices();
      
      if (results.variety.success) {
        console.log(`[PriceDataScheduler] Variety fetch complete: ${results.variety.recordsInserted} new, ${results.variety.recordsUpdated} updated`);
      } else {
        console.error('[PriceDataScheduler] Variety fetch failed:', results.variety.errors);
      }

    } catch (error) {
      console.error('[PriceDataScheduler] Variety fetch error:', error.message);
      results.variety = { success: false, errors: [error.message] };
    }

    // Summary log
    const totalInserted = (results.mandi?.recordsInserted || 0) + (results.variety?.recordsInserted || 0);
    const totalUpdated = (results.mandi?.recordsUpdated || 0) + (results.variety?.recordsUpdated || 0);
    console.log(`[PriceDataScheduler] Combined fetch: ${totalInserted} total new, ${totalUpdated} total updated`);
  }

  /**
   * Helper: delay execution
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
   * Manually trigger a full price fetch (both APIs)
   * @returns {Promise<Object>} Combined fetch result
   */
  async triggerFetch() {
    console.log('[PriceDataScheduler] Manual full fetch triggered');
    
    const results = {
      mandi: await MandiPriceService.fetchDailyPrices(),
      variety: await VarietyPriceService.fetchDailyPrices()
    };

    return {
      mandi: results.mandi,
      variety: results.variety,
      totalInserted: (results.mandi?.recordsInserted || 0) + (results.variety?.recordsInserted || 0),
      totalUpdated: (results.mandi?.recordsUpdated || 0) + (results.variety?.recordsUpdated || 0)
    };
  }

  /**
   * Manually trigger Mandi price fetch only
   * @returns {Promise<Object>} Fetch result
   */
  async triggerMandiFetch() {
    console.log('[PriceDataScheduler] Manual Mandi fetch triggered');
    return await MandiPriceService.fetchDailyPrices();
  }

  /**
   * Manually trigger Variety price fetch only
   * @returns {Promise<Object>} Fetch result
   */
  async triggerVarietyFetch() {
    console.log('[PriceDataScheduler] Manual Variety fetch triggered');
    return await VarietyPriceService.fetchDailyPrices();
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

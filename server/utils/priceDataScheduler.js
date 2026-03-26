/**
 * Price Data Scheduler
 *
 * Background job scheduler for the full price intelligence pipeline:
 *   1. Daily price fetch from data.gov.in (MandiPriceService + VarietyPriceService)
 *   2. Data cleaning + standardization (CleanedPriceService)
 *   3. Feature engineering — lag/rolling/seasonal features (FeatureEngineeringService)
 *   4. Daily pruning of old raw records (DataPruningService)
 *   5. Demand forecasting (DemandForecastService)
 *
 * ACADEMIC NOTE:
 * - Each stage runs sequentially to avoid race conditions
 * - Cleaning and feature computation trigger only after new data arrives
 * - Model retraining is triggered conditionally (new data > 10% or 7 days elapsed)
 */
const MandiPriceService = require('../services/MandiPriceService');
const VarietyPriceService = require('../services/VarietyPriceService');
const DataPruningService = require('../services/DataPruningService');
const DataFreshnessService = require('../services/DataFreshnessService');
const DemandForecastService = require('../services/DemandForecastService');
const CleanedPriceService = require('../services/CleanedPriceService');
const FeatureEngineeringService = require('../services/FeatureEngineeringService');

class PriceDataScheduler {
  constructor() {
    this.fetchIntervalHours = parseInt(process.env.PRICE_FETCH_INTERVAL_HOURS) || 24;
    this.isRunning = false;
    this.fetchTimer = null;
    this.pruneTimer = null;
    this.forecastTimer = null;
    this.lastFetchTime = null;
    this.lastPruneTime = null;
    this.lastForecastTime = null;
    this.lastCleanTime = null;
    this.lastFeatureTime = null;
    this.lastTrainDataPointCount = 0; // tracks data volume for retrain trigger
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
    this._scheduleDailyForecast();

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

    if (this.forecastTimer) {
      clearInterval(this.forecastTimer);
      this.forecastTimer = null;
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

    // STAGE 2: Clean + standardize new records
    if (totalInserted > 0 || totalUpdated > 0) {
      await this._executeClean();

      // STAGE 3: Compute time-series features
      await this._executeFeatureEngineering();
    } else {
      console.log('[PriceDataScheduler] No new records — skipping cleaning + feature computation');
    }
  }

  /**
   * Execute data cleaning on newly ingested records.
   * @private
   */
  async _executeClean() {
    console.log('[PriceDataScheduler] Starting cleaning stage...');
    this.lastCleanTime = new Date();
    try {
      const result = await CleanedPriceService.processNewRecords();
      console.log(`[PriceDataScheduler] Cleaning done: ${result.cleaned} records, ${result.outliersFlagged} outliers flagged, ${result.gapsFilled} gaps filled`);
    } catch (err) {
      console.error('[PriceDataScheduler] Cleaning error:', err.message);
    }
  }

  /**
   * Execute feature engineering on cleaned records.
   * Triggers model retraining if data volume increased by > 10% or 7 days elapsed.
   * @private
   */
  async _executeFeatureEngineering() {
    console.log('[PriceDataScheduler] Starting feature engineering stage...');
    this.lastFeatureTime = new Date();
    try {
      const result = await FeatureEngineeringService.computeFeatures();
      console.log(`[PriceDataScheduler] Feature engineering done: ${result.featuresComputed} feature rows across ${result.pairs} commodity+mandi pairs`);

      // Check if retraining is needed
      const newCount = result.featuresComputed;
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      const dataGrowthPct = this.lastTrainDataPointCount > 0
        ? ((newCount - this.lastTrainDataPointCount) / this.lastTrainDataPointCount) * 100
        : 100;

      const shouldRetrain = dataGrowthPct >= 10 || !this.lastFeatureTime || this.lastFeatureTime < sevenDaysAgo;

      if (shouldRetrain) {
        console.log(`[PriceDataScheduler] Retrain triggered (data growth: ${dataGrowthPct.toFixed(1)}%). Models will be retrained on next getInsight() call.`);
        this.lastTrainDataPointCount = newCount;
      }
    } catch (err) {
      console.error('[PriceDataScheduler] Feature engineering error:', err.message);
    }
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
   * Uses smart pruning to preserve historical data for commodities without fresh updates
   * @private
   */
  async _executePrune() {
    console.log('[PriceDataScheduler] Executing scheduled smart data pruning...');
    this.lastPruneTime = new Date();

    try {
      // Use smart pruning: only prune old data for commodities that have fresh data
      // Preserves historical data for commodities without recent updates
      const result = await DataPruningService.smartPruneOldRecords();

      if (result.success) {
        console.log(`[PriceDataScheduler] Smart pruning complete: ${result.recordsDeleted} records removed, ${result.combinationsPreserved} commodity+mandi combinations preserved (no fresh data)`);
      } else {
        console.error('[PriceDataScheduler] Smart pruning failed:', result.error);
      }

    } catch (error) {
      console.error('[PriceDataScheduler] Pruning error:', error.message);
    }
  }

  /**
   * Schedule daily demand forecast generation (every 24 hours)
   * @private
   */
  _scheduleDailyForecast() {
    const intervalMs = 24 * 60 * 60 * 1000;

    this.forecastTimer = setInterval(async () => {
      if (!this.isRunning) return;
      await this._executeForecast();
    }, intervalMs);

    console.log('[PriceDataScheduler] Demand forecast scheduled every 24 hours');
  }

  /**
   * Execute demand forecast generation for all active commodities
   * @private
   */
  async _executeForecast() {
    console.log('[PriceDataScheduler] Executing scheduled demand forecast generation...');
    this.lastForecastTime = new Date();

    try {
      const result = await DemandForecastService.generateAllForecasts();
      console.log(`[PriceDataScheduler] Forecast complete: ${result.generated} generated, ${result.failed} failed`);
    } catch (error) {
      console.error('[PriceDataScheduler] Forecast error:', error.message);
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
   * Manually trigger smart data pruning
   * Preserves historical data for commodities without fresh updates
   * @returns {Promise<Object>} Smart prune result
   */
  async triggerPrune() {
    console.log('[PriceDataScheduler] Manual smart prune triggered');
    return await DataPruningService.smartPruneOldRecords();
  }

  /**
   * Manually trigger aggressive prune (removes ALL old data regardless of freshness)
   * Use with caution - this will delete historical data
   * @returns {Promise<Object>} Prune result
   */
  async triggerAggressivePrune() {
    console.log('[PriceDataScheduler] Manual aggressive prune triggered (WARNING: removes all old data)');
    return await DataPruningService.pruneOldRecords();
  }

  /**
   * Manually trigger demand forecast generation
   * @returns {Promise<Object>} Forecast result
   */
  async triggerForecast() {
    console.log('[PriceDataScheduler] Manual forecast generation triggered');
    return await DemandForecastService.generateAllForecasts();
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
      lastForecastTime: this.lastForecastTime,
      lastCleanTime: this.lastCleanTime,
      lastFeatureTime: this.lastFeatureTime,
      apiKeyConfigured: !!process.env.DATA_GOV_API_KEY,
      pipeline: [
        'ingest (MandiPriceService + VarietyPriceService)',
        'clean (CleanedPriceService)',
        'feature_engineering (FeatureEngineeringService)',
        'prune (DataPruningService)',
        'demand_forecast (DemandForecastService)'
      ]
    };
  }
}

module.exports = new PriceDataScheduler();

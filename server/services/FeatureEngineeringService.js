const CleanedPrice = require('../models/CleanedPrice');
const PriceFeature = require('../models/PriceFeature');
const ss = require('simple-statistics');

/**
 * FeatureEngineeringService
 *
 * PIPELINE STAGE 4: Time-Series Feature Engineering
 *
 * Reads from CleanedPrice and computes all features needed for
 * ML model training. Writes one feature row per (commodity, mandi, date)
 * into the PriceFeature collection (the "feature store").
 *
 * ACADEMIC PURPOSE:
 * Raw prices alone cannot capture:
 *   - Weekly/monthly seasonality (dayOfWeek, month features)
 *   - Price momentum (lag features)
 *   - Market volatility (rolling std dev)
 *   - Supply-demand relationship (arrivals)
 *
 * Feature engineering transforms these patterns into numeric signals
 * that ML models (Ridge, XGBoost) can learn from.
 *
 * CRITICAL: All features look BACKWARD only.
 * No future data is ever used. This prevents data leakage.
 *
 * FEATURE LEVELS (determined by available history):
 *   MINIMAL  — < 7 days:  calendar + price spread only
 *   BASIC    — 7-13 days: + lag1-3, rollingMean7, momentum3
 *   STANDARD — 14-29 days: + lag7, rollingMean14, weekOverWeekChange
 *   FULL     — 30+ days:  + lag14, lag30, rollingMean30, monthlySeasonalIndex
 */
class FeatureEngineeringService {

  /**
   * Compute features for all commodity+mandi pairs with new cleaned data.
   * Called by priceDataScheduler after CleanedPriceService runs.
   *
   * @param {Date} since - Compute features for records cleaned after this date
   * @returns {Promise<Object>} Summary
   */
  async computeFeatures(since = null) {
    const cutoff = since || new Date(Date.now() - 25 * 60 * 60 * 1000);

    const result = { pairs: 0, featuresComputed: 0, errors: [] };

    try {
      console.log('[FeatureEngineeringService] Starting feature computation...');

      // Find all pairs with recently cleaned data
      const pairs = await CleanedPrice.aggregate([
        { $match: { cleanedAt: { $gte: cutoff } } },
        { $group: { _id: { commodity: '$commodity', mandi: '$mandi' } } }
      ]);

      result.pairs = pairs.length;

      for (const pair of pairs) {
        try {
          const count = await this._computePairFeatures(pair._id.commodity, pair._id.mandi);
          result.featuresComputed += count;
        } catch (err) {
          result.errors.push(`${pair._id.commodity}@${pair._id.mandi}: ${err.message}`);
        }
      }

      console.log(`[FeatureEngineeringService] Done: ${result.featuresComputed} feature rows across ${result.pairs} pairs`);
    } catch (err) {
      console.error('[FeatureEngineeringService] Fatal error:', err.message);
      result.errors.push(err.message);
    }

    return result;
  }

  /**
   * Compute and upsert features for all rows of a single commodity+mandi.
   * @private
   */
  async _computePairFeatures(commodity, mandi) {
    // Load ALL cleaned records for this pair (ascending by date — critical for lag computation)
    const records = await CleanedPrice.find({
      commodity: { $regex: new RegExp(`^${this._escape(commodity)}$`, 'i') },
      mandi:     { $regex: new RegExp(`^${this._escape(mandi)}$`, 'i') }
    }).sort({ date: 1 }).lean();

    if (records.length === 0) return 0;

    const prices = records.map(r => r.modalPrice);
    const n      = records.length;

    // Determine feature level
    const featureLevel = this._getFeatureLevel(n);

    // Compute monthly seasonal index (ratio vs overall mean) for FULL level
    let monthlyMeans = null;
    if (featureLevel === 'FULL') {
      monthlyMeans = this._computeMonthlyMeans(records);
    }

    const featureRows = [];

    for (let i = 0; i < n; i++) {
      const rec  = records[i];
      const date = new Date(rec.date);

      const row = {
        commodity:      rec.commodity,
        commodityGroup: rec.commodityGroup || 'other',
        mandi:          rec.mandi,
        date:           date,
        modalPrice:     rec.modalPrice,

        // ── Calendar features (always available)
        dayOfWeek:  date.getDay(),
        dayOfMonth: date.getDate(),
        month:      date.getMonth() + 1,
        weekOfYear: this._weekOfYear(date),
        isWeekend:  date.getDay() === 0 || date.getDay() === 6,

        // ── Price spread features
        priceSpread:     rec.priceSpread || 0,
        priceVolatility: rec.modalPrice > 0 ? (rec.priceSpread || 0) / rec.modalPrice : 0,

        // ── Supply signal
        arrivals: rec.arrivals || 0,

        // ── Lag features (null if not enough history)
        lag1:  i >= 1  ? prices[i - 1]  : null,
        lag2:  i >= 2  ? prices[i - 2]  : null,
        lag3:  i >= 3  ? prices[i - 3]  : null,
        lag7:  i >= 7  ? prices[i - 7]  : null,
        lag14: i >= 14 ? prices[i - 14] : null,
        lag30: i >= 30 ? prices[i - 30] : null,

        // ── Rolling features (null if not enough preceding data)
        rollingMean7:  i >= 6  ? ss.mean(prices.slice(i - 6, i + 1))  : null,
        rollingStd7:   i >= 6  ? (prices.slice(i - 6, i + 1).length > 1 ? ss.standardDeviation(prices.slice(i - 6, i + 1)) : 0) : null,
        rollingMean14: i >= 13 ? ss.mean(prices.slice(i - 13, i + 1)) : null,
        rollingMean30: i >= 29 ? ss.mean(prices.slice(i - 29, i + 1)) : null,

        // ── Momentum
        momentum3:          i >= 3 ? prices[i] - prices[i - 3] : null,
        weekOverWeekChange: i >= 7 && prices[i - 7] > 0
          ? ((prices[i] - prices[i - 7]) / prices[i - 7]) * 100
          : null,

        // ── Seasonal index
        monthlySeasonalIndex: monthlyMeans
          ? this._getSeasonalIndex(date.getMonth() + 1, monthlyMeans, ss.mean(prices))
          : null,

        availableFeatureLevel: featureLevel,
        computedAt: new Date()
      };

      featureRows.push(row);
    }

    // Upsert into PriceFeature
    if (featureRows.length > 0) {
      const bulkOps = featureRows.map(row => ({
        updateOne: {
          filter: { commodity: row.commodity, mandi: row.mandi, date: row.date },
          update: { $set: row },
          upsert: true
        }
      }));
      await PriceFeature.bulkWrite(bulkOps, { ordered: false });
    }

    return featureRows.length;
  }

  /**
   * Get feature rows for a commodity+mandi, ready for model training.
   * Returns only rows with sufficient features for the requested level.
   *
   * @param {string} commodity
   * @param {string} mandi
   * @param {number} [limitDays=365] - Max days of history to return
   * @returns {Promise<Array>} Feature rows sorted by date ascending
   */
  async getTrainingData(commodity, mandi, limitDays = 365) {
    const since = new Date(Date.now() - limitDays * 86400000);
    return await PriceFeature.find({
      commodity: { $regex: new RegExp(`^${this._escape(commodity)}$`, 'i') },
      mandi:     { $regex: new RegExp(`^${this._escape(mandi)}$`, 'i') },
      date:      { $gte: since }
    }).sort({ date: 1 }).lean();
  }

  /**
   * Get the most recent feature row for a commodity+mandi (for inference).
   */
  async getLatestFeatureRow(commodity, mandi) {
    return await PriceFeature.findOne({
      commodity: { $regex: new RegExp(`^${this._escape(commodity)}$`, 'i') },
      mandi:     { $regex: new RegExp(`^${this._escape(mandi)}$`, 'i') }
    }).sort({ date: -1 }).lean();
  }

  /**
   * Get feature rows for a commodity group (cross-commodity signals).
   * Used for cold-start: borrow trend signals from sibling commodities.
   */
  async getGroupFeatures(commodityGroup, limitDays = 30) {
    const since = new Date(Date.now() - limitDays * 86400000);
    return await PriceFeature.find({
      commodityGroup,
      date: { $gte: since }
    }).sort({ date: -1 }).lean();
  }

  // ─── Private Helpers ──────────────────────────────────────────

  _getFeatureLevel(dataPoints) {
    if (dataPoints >= 30) return 'FULL';
    if (dataPoints >= 14) return 'STANDARD';
    if (dataPoints >= 7)  return 'BASIC';
    return 'MINIMAL';
  }

  _computeMonthlyMeans(records) {
    const monthSums   = Array(13).fill(0); // index 1-12
    const monthCounts = Array(13).fill(0);
    for (const r of records) {
      const m = new Date(r.date).getMonth() + 1;
      monthSums[m]   += r.modalPrice;
      monthCounts[m] += 1;
    }
    const means = Array(13).fill(null);
    for (let m = 1; m <= 12; m++) {
      if (monthCounts[m] > 0) means[m] = monthSums[m] / monthCounts[m];
    }
    return means;
  }

  _getSeasonalIndex(month, monthlyMeans, overallMean) {
    if (!monthlyMeans[month] || overallMean === 0) return 1;
    return monthlyMeans[month] / overallMean;
  }

  _weekOfYear(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  _escape(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = new FeatureEngineeringService();

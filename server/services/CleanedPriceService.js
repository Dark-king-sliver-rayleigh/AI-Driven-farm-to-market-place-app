const MarketPrice = require('../models/MarketPrice');
const CleanedPrice = require('../models/CleanedPrice');
const ss = require('simple-statistics');

/**
 * CleanedPriceService
 *
 * PIPELINE STAGE 3: Data Cleaning & Standardization
 *
 * Reads raw MarketPrice records (as-received from data.gov.in) and
 * produces cleaned, standardized records in the CleanedPrice collection.
 *
 * ACADEMIC PURPOSE:
 * Raw mandi data frequently contains:
 *   - Spelling variations (Tomato, TOMATO, Big Tomato → tomato)
 *   - Invalid prices (zero, negative, min > max)
 *   - Missing days (markets close on Sundays/holidays)
 *   - Outliers (data entry errors, special auction prices)
 *
 * This stage is MANDATORY before feature engineering.
 *
 * OPERATIONS (in order):
 *   1. Commodity name normalization
 *   2. Price validation
 *   3. Outlier detection via IQR
 *   4. Duplicate resolution (keep highest-arrivals record per day)
 *   5. Gap-filling (forward-fill for 1-2 consecutive missing days)
 *   6. Upsert into CleanedPrice collection
 */
class CleanedPriceService {

  constructor() {
    // Commodity synonym map: normalizes common variations
    this.synonymMap = {
      'big onion': 'onion',
      'small onion': 'onion',
      'dry onion': 'onion',
      'red onion': 'onion',
      'desi tomato': 'tomato',
      'hybrid tomato': 'tomato',
      'local tomato': 'tomato',
      'potato round': 'potato',
      'green chilli': 'chilli',
      'dry chilli': 'chilli',
      'wheat (hd 2781)': 'wheat',
      'wheat (lok 1)': 'wheat',
      'paddy (raw)': 'rice',
      'paddy (dpr)': 'rice',
    };

    // Commodity group classifier
    this.groupMap = {
      vegetables: ['tomato', 'onion', 'potato', 'carrot', 'cabbage', 'spinach', 'brinjal',
                   'cauliflower', 'beans', 'peas', 'okra', 'cucumber', 'capsicum', 'chilli',
                   'ladyfinger', 'pepper', 'radish', 'beetroot', 'garlic', 'ginger'],
      fruits: ['mango', 'banana', 'apple', 'orange', 'grapes', 'papaya', 'guava',
               'watermelon', 'pomegranate', 'pineapple', 'strawberry', 'lemon', 'lime', 'cherry'],
      cereals: ['wheat', 'rice', 'maize', 'corn', 'barley', 'oats', 'millet',
                'bajra', 'jowar', 'ragi', 'sorghum'],
      pulses: ['dal', 'lentil', 'chana', 'chickpea', 'moong', 'masoor',
               'urad', 'toor', 'arhar', 'rajma', 'kidney bean'],
      spices: ['turmeric', 'coriander', 'cumin', 'fenugreek', 'mustard', 'cardamom',
               'pepper', 'clove', 'cinnamon', 'ginger', 'garlic'],
    };
  }

  /**
   * Process new raw records since last clean run.
   * Called by priceDataScheduler after each ingestion.
   *
   * @param {Date} since - Process records fetched after this date (default: last 24h)
   * @returns {Promise<Object>} Processing summary
   */
  async processNewRecords(since = null) {
    const cutoff = since || new Date(Date.now() - 25 * 60 * 60 * 1000); // last 25h

    const result = {
      fetched: 0,
      cleaned: 0,
      skipped: 0,
      outliersFlagged: 0,
      gapsFilled: 0,
      errors: []
    };

    try {
      console.log('[CleanedPriceService] Starting cleaning run...');

      // Get all (commodity, mandi) pairs with new raw records
      const pairs = await MarketPrice.aggregate([
        { $match: { fetchedAt: { $gte: cutoff } } },
        { $group: { _id: { commodity: '$commodity', mandi: '$mandi' } } }
      ]);

      for (const pair of pairs) {
        try {
          await this._processPair(pair._id.commodity, pair._id.mandi, result);
        } catch (err) {
          result.errors.push(`${pair._id.commodity}@${pair._id.mandi}: ${err.message}`);
        }
      }

      console.log(`[CleanedPriceService] Done: ${result.cleaned} cleaned, ${result.outliersFlagged} outliers flagged, ${result.gapsFilled} gaps filled`);
    } catch (err) {
      console.error('[CleanedPriceService] Fatal error:', err.message);
      result.errors.push(err.message);
    }

    return result;
  }

  /**
   * Process all raw records for a specific commodity+mandi.
   * @private
   */
  async _processPair(commodity, mandi, result) {
    // Get last 90 days of raw records (sorted ascending for rolling computations)
    const raw = await MarketPrice.find({
      commodity: { $regex: new RegExp(`^${this._escapeRegex(commodity)}$`, 'i') },
      mandi:     { $regex: new RegExp(`^${this._escapeRegex(mandi)}$`, 'i') }
    }).sort({ date: 1 }).lean();

    result.fetched += raw.length;
    if (raw.length === 0) return;

    // Step 1: Normalize commodity name
    const normalizedCommodity = this._normalizeCommodity(commodity);
    const normalizedMandi     = mandi.toLowerCase().trim();
    const commodityGroup      = this._getGroup(normalizedCommodity);

    // Step 2: Validate and deduplicate per day
    const validByDate = {};
    for (const rec of raw) {
      if (!this._isValidPrice(rec)) { result.skipped++; continue; }

      const dateKey = rec.date.toISOString().split('T')[0];
      if (!validByDate[dateKey] || rec.arrivals > (validByDate[dateKey].arrivals || 0)) {
        validByDate[dateKey] = rec;
      }
    }

    const dayRecords = Object.entries(validByDate)
      .map(([dk, rec]) => ({ dateKey: dk, rec }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    if (dayRecords.length === 0) return;

    // Step 3: Detect outliers using IQR on modal prices
    const prices = dayRecords.map(d => d.rec.modalPrice);
    const q1  = ss.quantile(prices, 0.25);
    const q3  = ss.quantile(prices, 0.75);
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;

    // Step 4: Build clean records + detect gaps
    const cleanRecords = [];

    for (let i = 0; i < dayRecords.length; i++) {
      const { dateKey, rec } = dayRecords[i];
      const date       = new Date(dateKey);
      const isOutlier  = rec.modalPrice < lowerFence || rec.modalPrice > upperFence;

      if (isOutlier) result.outliersFlagged++;

      cleanRecords.push({
        commodity:      normalizedCommodity,
        commodityGroup: commodityGroup,
        state:          rec.state || 'Unknown',
        mandi:          normalizedMandi,
        date:           date,
        minPrice:       rec.minPrice,
        maxPrice:       rec.maxPrice,
        modalPrice:     rec.modalPrice,
        priceSpread:    rec.maxPrice - rec.minPrice,
        arrivals:       rec.arrivals || 0,
        isOutlier:      isOutlier,
        isGapFilled:    false,
        cleanedAt:      new Date(),
        sourceRecordId: rec._id
      });

      // Step 5: Gap-fill — if next record is 2-3 days away, insert forward-fill
      if (i < dayRecords.length - 1) {
        const nextDateKey = dayRecords[i + 1].dateKey;
        const gapDays = this._daysBetween(dateKey, nextDateKey);

        // Only fill gaps of 1-2 days (weekend/holiday closures)
        if (gapDays === 2 || gapDays === 3) {
          for (let g = 1; g < gapDays; g++) {
            const gapDate = new Date(date.getTime() + g * 86400000);
            const gapDateKey = gapDate.toISOString().split('T')[0];

            cleanRecords.push({
              commodity:      normalizedCommodity,
              commodityGroup: commodityGroup,
              state:          rec.state || 'Unknown',
              mandi:          normalizedMandi,
              date:           gapDate,
              minPrice:       rec.minPrice,
              maxPrice:       rec.maxPrice,
              modalPrice:     rec.modalPrice,  // Forward-fill from previous day
              priceSpread:    rec.maxPrice - rec.minPrice,
              arrivals:       0,
              isOutlier:      false,
              isGapFilled:    true,
              cleanedAt:      new Date(),
              sourceRecordId: null
            });
            result.gapsFilled++;
          }
        }
      }
    }

    // Step 6: Upsert into CleanedPrice
    if (cleanRecords.length > 0) {
      const bulkOps = cleanRecords.map(rec => ({
        updateOne: {
          filter: { commodity: rec.commodity, mandi: rec.mandi, date: rec.date },
          update: { $set: rec },
          upsert: true
        }
      }));

      await CleanedPrice.bulkWrite(bulkOps, { ordered: false });
      result.cleaned += cleanRecords.length;
    }
  }

  /**
   * Get cleaned records for a commodity+mandi in date range
   */
  async getCleanedRecords(commodity, mandi, fromDate, toDate) {
    const normalizedCommodity = this._normalizeCommodity(commodity);
    const normalizedMandi     = mandi.toLowerCase().trim();

    return await CleanedPrice.find({
      commodity: { $regex: new RegExp(`^${this._escapeRegex(normalizedCommodity)}$`, 'i') },
      mandi:     { $regex: new RegExp(`^${this._escapeRegex(normalizedMandi)}$`, 'i') },
      date:      { $gte: fromDate, $lte: toDate }
    }).sort({ date: 1 }).lean();
  }

  // ─── Helpers ──────────────────────────────────────────────────

  _normalizeCommodity(name) {
    const lower = name.toLowerCase().trim();
    return this.synonymMap[lower] || lower;
  }

  _getGroup(commodity) {
    for (const [group, members] of Object.entries(this.groupMap)) {
      if (members.some(m => commodity.includes(m))) return group;
    }
    return 'other';
  }

  _isValidPrice(rec) {
    if (!rec.minPrice || !rec.maxPrice || !rec.modalPrice) return false;
    if (rec.minPrice <= 0 || rec.maxPrice <= 0 || rec.modalPrice <= 0) return false;
    if (rec.minPrice > rec.maxPrice) return false;
    // Sanity check: reject extreme outliers (likely unit errors: Rs/Kg vs Rs/Quintal)
    if (rec.modalPrice > 500000) return false;
    return true;
  }

  _daysBetween(dateKeyA, dateKeyB) {
    const a = new Date(dateKeyA);
    const b = new Date(dateKeyB);
    return Math.round((b - a) / 86400000);
  }

  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = new CleanedPriceService();

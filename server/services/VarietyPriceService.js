/**
 * VarietyPriceService
 * 
 * Fetches variety-wise daily market prices from data.gov.in API.
 * This service complements MandiPriceService by providing granular variety data.
 * 
 * ACADEMIC NOTE:
 * - Uses official government API (data.gov.in)
 * - Dataset: "Variety-wise Daily Market Prices Data of Commodity"
 * - Key differentiator: Provides variety-specific pricing
 * - No web scraping - fully legal and documented
 * 
 * Data Source: https://data.gov.in/resource/variety-wise-daily-market-prices-data-commodity
 */
const MarketPrice = require('../models/MarketPrice');

class VarietyPriceService {
  constructor() {
    this.apiKey = process.env.DATA_GOV_API_KEY || '';
    this.apiBaseUrl = process.env.DATA_GOV_API_URL || 'https://api.data.gov.in/resource';
    // Resource ID for variety-wise daily prices dataset
    // Note: This needs to be verified on data.gov.in
    this.resourceId = process.env.VARIETY_PRICE_RESOURCE_ID || '35985678-0d79-46b4-9ed6-6f13308a1d24';
    this.batchSize = 500; // Records per API call
    this.sourceTag = 'data.gov.in-variety'; // Distinct source identifier
  }

  /**
   * Fetch variety-wise daily prices from data.gov.in API
   * Called once per day by the scheduler (after MandiPriceService)
   * 
   * @returns {Object} { success, recordsProcessed, errors }
   */
  async fetchDailyPrices() {
    const result = {
      success: false,
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      errors: [],
      fetchedAt: new Date(),
      source: this.sourceTag
    };

    if (!this.apiKey) {
      result.errors.push('DATA_GOV_API_KEY not configured in environment');
      console.error('[VarietyPriceService] API key not configured');
      return result;
    }

    if (!this.resourceId || this.resourceId === '35985678-0d79-46b4-9ed6-6f13308a1d24') {
      console.warn('[VarietyPriceService] Using default resource ID - please verify on data.gov.in');
    }

    try {
      console.log('[VarietyPriceService] Starting variety-wise price fetch...');
      console.log(`[VarietyPriceService] Resource ID: ${this.resourceId}`);
      
      let offset = 0;
      let hasMoreData = true;
      
      while (hasMoreData) {
        const records = await this._fetchBatch(offset);
        
        if (!records || records.length === 0) {
          hasMoreData = false;
          continue;
        }

        // Normalize and upsert records
        const normalizedRecords = records
          .map(record => this._normalizeRecord(record))
          .filter(record => record !== null);

        const upsertResult = await this._upsertPrices(normalizedRecords);
        
        result.recordsProcessed += records.length;
        result.recordsInserted += upsertResult.inserted;
        result.recordsUpdated += upsertResult.updated;
        
        offset += this.batchSize;
        
        // Safety limit: max 50 batches (25,000 records per run)
        if (offset >= this.batchSize * 50) {
          console.log('[VarietyPriceService] Reached batch limit, stopping fetch');
          hasMoreData = false;
        }
        
        // Small delay between batches to be respectful to API
        await this._delay(500);
      }

      result.success = true;
      console.log(`[VarietyPriceService] Fetch complete: ${result.recordsInserted} inserted, ${result.recordsUpdated} updated`);
      
    } catch (error) {
      result.errors.push(error.message);
      console.error('[VarietyPriceService] Fetch error:', error.message);
    }

    return result;
  }

  /**
   * Fetch a batch of records from the API
   * @private
   */
  async _fetchBatch(offset) {
    const url = new URL(`${this.apiBaseUrl}/${this.resourceId}`);
    url.searchParams.append('api-key', this.apiKey);
    url.searchParams.append('format', 'json');
    url.searchParams.append('offset', offset);
    url.searchParams.append('limit', this.batchSize);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // data.gov.in returns records in 'records' array
      return data.records || [];
      
    } catch (error) {
      console.error(`[VarietyPriceService] Batch fetch error at offset ${offset}:`, error.message);
      return [];
    }
  }

  /**
   * Normalize a raw API record to match MarketPrice schema
   * 
   * Expected API fields (variety-wise dataset):
   * - commodity: "Tomato"
   * - state: "Tamil Nadu"
   * - market: "Chennai" or district
   * - variety: "Hybrid" / "Local" / "Desi" etc. (KEY FIELD)
   * - arrival_date: "19/01/2026" or "2026-01-19"
   * - min_price: "2000"
   * - max_price: "3000"
   * - modal_price: "2500"
   * 
   * @param {Object} rawRecord - Raw record from API
   * @returns {Object|null} Normalized record or null if invalid
   */
  _normalizeRecord(rawRecord) {
    try {
      // Handle various field name formats from API
      const commodity = rawRecord.commodity || rawRecord.Commodity || '';
      const state = rawRecord.state || rawRecord.State || '';
      const district = rawRecord.district || rawRecord.District || '';
      const mandi = rawRecord.market || rawRecord.Market || '';
      
      // VARIETY IS REQUIRED for this dataset - this is the key differentiator
      const variety = rawRecord.variety || rawRecord.Variety || '';
      
      // Skip records without variety (defeats the purpose of this dataset)
      if (!variety || variety.trim() === '') {
        return null;
      }
      
      // Parse date - handle DD/MM/YYYY and YYYY-MM-DD formats
      let date = null;
      const dateStr = rawRecord.arrival_date || rawRecord.Arrival_Date || 
                      rawRecord.price_date || rawRecord.Price_Date ||
                      rawRecord.date || rawRecord.Date || '';
      if (dateStr) {
        if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/');
          date = new Date(year, month - 1, day);
        } else {
          date = new Date(dateStr);
        }
      }

      // Parse prices - convert to numbers
      const minPrice = this._parsePrice(rawRecord.min_price || rawRecord.Min_Price);
      const maxPrice = this._parsePrice(rawRecord.max_price || rawRecord.Max_Price);
      const modalPrice = this._parsePrice(rawRecord.modal_price || rawRecord.Modal_Price);

      // Use market name if available, otherwise fall back to district
      const mandiName = mandi.trim() || district.trim();

      // Validate required fields
      if (!commodity || !mandiName || !date || isNaN(date.getTime())) {
        return null;
      }

      // Validate prices
      if (minPrice === null || maxPrice === null || modalPrice === null) {
        return null;
      }

      return {
        commodity: commodity.trim(),
        state: state.trim() || 'Unknown',
        district: district.trim(),
        mandi: mandiName,
        variety: variety.trim(),
        date: date,
        minPrice: minPrice,
        maxPrice: maxPrice,
        modalPrice: modalPrice,
        unit: 'Rs./Quintal',
        arrivals: this._parseFloat(rawRecord.arrivals || rawRecord.Arrivals) || 0,
        fetchedAt: new Date(),
        source: this.sourceTag
      };

    } catch (error) {
      console.error('[VarietyPriceService] Record normalization error:', error.message);
      return null;
    }
  }

  /**
   * Parse price string to number
   * Handles comma-separated numbers and currency symbols
   */
  _parsePrice(value) {
    if (typeof value === 'number') return value;
    if (!value) return null;
    
    // Remove non-numeric characters except decimal
    const cleaned = String(value).replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Parse float with fallback
   */
  _parseFloat(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Upsert price records with duplicate detection
   * Uses compound key: commodity + mandi + date + variety
   * 
   * NOTE: This uses the same MarketPrice collection as MandiPriceService
   * The unique index on { commodity, mandi, date, variety } prevents duplicates
   * 
   * @param {Array} records - Normalized price records
   * @returns {Object} { inserted, updated }
   */
  async _upsertPrices(records) {
    const result = { inserted: 0, updated: 0 };

    if (!records || records.length === 0) {
      return result;
    }

    const bulkOps = records.map(record => ({
      updateOne: {
        filter: {
          commodity: record.commodity,
          mandi: record.mandi,
          date: record.date,
          variety: record.variety
        },
        update: {
          $set: {
            state: record.state,
            district: record.district,
            minPrice: record.minPrice,
            maxPrice: record.maxPrice,
            modalPrice: record.modalPrice,
            unit: record.unit,
            arrivals: record.arrivals,
            fetchedAt: record.fetchedAt,
            source: record.source
          }
        },
        upsert: true
      }
    }));

    try {
      const bulkResult = await MarketPrice.bulkWrite(bulkOps, { ordered: false });
      result.inserted = bulkResult.upsertedCount || 0;
      result.updated = bulkResult.modifiedCount || 0;
    } catch (error) {
      console.error('[VarietyPriceService] Bulk upsert error:', error.message);
    }

    return result;
  }

  /**
   * Get timestamp of most recently fetched variety data
   * Used for staleness checks
   */
  async getLastFetchTimestamp() {
    const latestRecord = await MarketPrice.findOne({ source: this.sourceTag })
      .sort({ fetchedAt: -1 })
      .select('fetchedAt')
      .lean();

    return latestRecord ? latestRecord.fetchedAt : null;
  }

  /**
   * Get timestamp of most recent variety price data
   * Used for data freshness checks
   */
  async getMostRecentDataDate() {
    const latestRecord = await MarketPrice.findOne({ source: this.sourceTag })
      .sort({ date: -1 })
      .select('date')
      .lean();

    return latestRecord ? latestRecord.date : null;
  }

  /**
   * Get fetch statistics for variety-wise data
   */
  async getStats() {
    const varietyRecords = await MarketPrice.countDocuments({ source: this.sourceTag });
    const oldestRecord = await MarketPrice.findOne({ source: this.sourceTag })
      .sort({ date: 1 }).select('date').lean();
    const newestRecord = await MarketPrice.findOne({ source: this.sourceTag })
      .sort({ date: -1 }).select('date').lean();
    const lastFetch = await this.getLastFetchTimestamp();

    // Get unique varieties count
    const uniqueVarieties = await MarketPrice.distinct('variety', { source: this.sourceTag });

    return {
      varietyRecords,
      uniqueVarietiesCount: uniqueVarieties.length,
      uniqueVarieties: uniqueVarieties.slice(0, 20), // Top 20 for display
      oldestDate: oldestRecord?.date || null,
      newestDate: newestRecord?.date || null,
      lastFetchedAt: lastFetch
    };
  }

  /**
   * Get available varieties for a commodity
   * Useful for variety selection dropdowns
   */
  async getVarietiesForCommodity(commodity) {
    const varieties = await MarketPrice.distinct('variety', { 
      commodity: new RegExp(commodity, 'i'),
      source: this.sourceTag 
    });
    return varieties.filter(v => v && v.trim() !== '');
  }

  /**
   * Helper: delay execution
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new VarietyPriceService();

/**
 * MandiPriceService
 * 
 * Fetches official mandi (agricultural market) prices from data.gov.in Agmarknet API.
 * This service runs as a background job to keep market data fresh.
 * 
 * ACADEMIC NOTE:
 * - Uses official government API (data.gov.in)
 * - No web scraping - fully legal and documented
 * - Stores normalized data in MongoDB for offline analysis
 * 
 * Data Source: https://data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi
 */
const MarketPrice = require('../models/MarketPrice');

class MandiPriceService {
  constructor() {
    this.apiKey = process.env.DATA_GOV_API_KEY || '';
    this.apiBaseUrl = process.env.DATA_GOV_API_URL || 'https://api.data.gov.in/resource';
    // Resource ID for daily mandi prices dataset
    this.resourceId = '9ef84268-d588-465a-a308-a864a43d0070';
    this.batchSize = 500; // Records per API call
  }

  /**
   * Fetch daily mandi prices from data.gov.in API
   * Called once per day by the scheduler
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
      fetchedAt: new Date()
    };

    if (!this.apiKey) {
      result.errors.push('DATA_GOV_API_KEY not configured in environment');
      console.error('[MandiPriceService] API key not configured');
      return result;
    }

    try {
      console.log('[MandiPriceService] Starting daily price fetch...');
      
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
          console.log('[MandiPriceService] Reached batch limit, stopping fetch');
          hasMoreData = false;
        }
        
        // Small delay between batches to be respectful to API
        await this._delay(500);
      }

      result.success = true;
      console.log(`[MandiPriceService] Fetch complete: ${result.recordsInserted} inserted, ${result.recordsUpdated} updated`);
      
    } catch (error) {
      result.errors.push(error.message);
      console.error('[MandiPriceService] Fetch error:', error.message);
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
      console.error(`[MandiPriceService] Batch fetch error at offset ${offset}:`, error.message);
      return [];
    }
  }

  /**
   * Normalize a raw API record to match MarketPrice schema
   * 
   * API fields (typical):
   * - commodity: "Tomato"
   * - state: "Tamil Nadu"
   * - market: "Chennai"
   * - variety: "Local"
   * - arrival_date: "19/01/2026"
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
      const variety = rawRecord.variety || rawRecord.Variety || 'Local';
      
      // Parse date - handle DD/MM/YYYY and YYYY-MM-DD formats
      let date = null;
      const dateStr = rawRecord.arrival_date || rawRecord.Arrival_Date || rawRecord.date || '';
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

      // Capture the actual unit of measurement from the API
      // data.gov.in typically uses 'commodity_uom' or 'Commodity_Uom'
      const rawUnit = rawRecord.commodity_uom || rawRecord.Commodity_Uom || rawRecord.unit || rawRecord.Unit || '';
      const unit = this._normalizeUnit(rawUnit);

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
        unit: unit,
        arrivals: this._parseFloat(rawRecord.arrivals || rawRecord.Arrivals) || 0,
        fetchedAt: new Date(),
        source: 'data.gov.in'
      };

    } catch (error) {
      console.error('[MandiPriceService] Record normalization error:', error.message);
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
   * Normalize the unit of measurement from the API to a display-friendly format.
   * The government API returns various formats like "Quintal", "Each", "Dozen", etc.
   * 
   * @param {string} rawUnit - Raw unit string from API
   * @returns {string} Normalized unit string (e.g., "Rs./Quintal", "Rs./Each", "Rs./Dozen")
   */
  _normalizeUnit(rawUnit) {
    if (!rawUnit || typeof rawUnit !== 'string') return 'Rs./Quintal';

    const unit = rawUnit.trim().toLowerCase();

    // Map known API unit values to display-friendly labels
    const unitMap = {
      'quintal':     'Rs./Quintal',
      'kg':          'Rs./Kg',
      'kilogram':    'Rs./Kg',
      'each':        'Rs./Each',
      'nos':         'Rs./Each',
      'number':      'Rs./Each',
      'piece':       'Rs./Each',
      'dozen':       'Rs./Dozen',
      'litre':       'Rs./Litre',
      'liter':       'Rs./Litre',
      'gram':        'Rs./Gram',
      'ton':         'Rs./Ton',
      'tonne':       'Rs./Tonne',
      '100 nos':     'Rs./100 Nos',
      '100 nos.':    'Rs./100 Nos',
      '100nos':      'Rs./100 Nos',
      '1000 nos':    'Rs./1000 Nos',
      '1000 nos.':   'Rs./1000 Nos',
      'packet':      'Rs./Packet',
      'bundle':      'Rs./Bundle',
      'box':         'Rs./Box',
    };

    // Exact match first
    if (unitMap[unit]) return unitMap[unit];

    // Partial match (e.g., "100 nos" inside "per 100 nos")
    for (const [key, val] of Object.entries(unitMap)) {
      if (unit.includes(key)) return val;
    }

    // If it already has "Rs./" prefix, return as-is (title-cased)
    if (rawUnit.startsWith('Rs.')) return rawUnit;

    // Fallback: prepend Rs./ and capitalize
    const capitalized = rawUnit.charAt(0).toUpperCase() + rawUnit.slice(1);
    return `Rs./${capitalized}`;
  }

  /**
   * Upsert price records with duplicate detection
   * Uses compound key: commodity + mandi + date + variety
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
      console.error('[MandiPriceService] Bulk upsert error:', error.message);
    }

    return result;
  }

  /**
   * Get timestamp of most recently fetched data
   * Used for staleness checks
   */
  async getLastFetchTimestamp() {
    const latestRecord = await MarketPrice.findOne({ source: 'data.gov.in' })
      .sort({ fetchedAt: -1 })
      .select('fetchedAt')
      .lean();

    return latestRecord ? latestRecord.fetchedAt : null;
  }

  /**
   * Get timestamp of most recent price data
   * Used for data freshness checks
   */
  async getMostRecentDataDate() {
    const latestRecord = await MarketPrice.findOne()
      .sort({ date: -1 })
      .select('date')
      .lean();

    return latestRecord ? latestRecord.date : null;
  }

  /**
   * Get fetch statistics
   */
  async getStats() {
    const totalRecords = await MarketPrice.countDocuments();
    const govRecords = await MarketPrice.countDocuments({ source: 'data.gov.in' });
    const oldestRecord = await MarketPrice.findOne().sort({ date: 1 }).select('date').lean();
    const newestRecord = await MarketPrice.findOne().sort({ date: -1 }).select('date').lean();
    const lastFetch = await this.getLastFetchTimestamp();

    return {
      totalRecords,
      govRecords,
      oldestDate: oldestRecord?.date || null,
      newestDate: newestRecord?.date || null,
      lastFetchedAt: lastFetch
    };
  }

  /**
   * Helper: delay execution
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new MandiPriceService();

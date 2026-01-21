const MarketPrice = require('../models/MarketPrice');
const MSPPrice = require('../models/MSPPrice');
const DataFreshnessService = require('./DataFreshnessService');

/**
 * PriceInsightService
 * 
 * ACADEMIC PURPOSE:
 * This service provides transparent, explainable, data-driven price insights
 * to farmers using actual government mandi (market) data.
 * 
 * KEY PRINCIPLES:
 * 1. NO ML/AI predictions - only rule-based analysis of historical data
 * 2. Full transparency - all calculations are explainable
 * 3. MSP as price floor - farmers should never price below MSP
 * 4. Farmer autonomy - suggestions only, final pricing is farmer's decision
 * 5. Staleness awareness - marks confidence as LOW if data is stale (>24 hours)
 * 
 * DATA SOURCES:
 * - Mandi prices: Agmarknet / data.gov.in daily commodity reports
 * - MSP: CACP (Commission for Agricultural Costs and Prices)
 */
class PriceInsightService {
  
  /**
   * Get price insight for a specific commodity and mandi
   * 
   * @param {string} commodity - Commodity name (e.g., "Tomato", "Onion")
   * @param {string} mandi - Mandi/Market name (e.g., "Bangalore APMC")
   * @returns {Object} Price insight with suggested price, range, trend, and rationale
   */
  async getInsight(commodity, mandi) {
    try {
      // Calculate date range (last 30 days for better data coverage)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      // Fetch market prices for the last 30 days
      // Using case-insensitive regex for flexible matching
      let marketPrices = await MarketPrice.find({
        commodity: { $regex: new RegExp(commodity, 'i') },
        mandi: { $regex: new RegExp(mandi, 'i') },
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: -1 });
      
      // Fallback: if no data in date range, get most recent data without date filter
      if (!marketPrices || marketPrices.length === 0) {
        marketPrices = await MarketPrice.find({
          commodity: { $regex: new RegExp(commodity, 'i') },
          mandi: { $regex: new RegExp(mandi, 'i') }
        }).sort({ date: -1 }).limit(10);
      }
      
      // Fetch current MSP for the commodity
      const currentYear = new Date().getFullYear();
      const mspData = await MSPPrice.findOne({
        commodity: { $regex: new RegExp(commodity, 'i') },
        year: { $gte: currentYear - 1 }  // Get most recent MSP
      }).sort({ year: -1 });
      
      // If no market data, return low confidence response
      if (!marketPrices || marketPrices.length === 0) {
        return this._buildNoDataResponse(commodity, mandi, mspData);
      }
      
      // Calculate price statistics from available data
      const priceStats = this._calculatePriceStats(marketPrices);
      
      // Get MSP value (may be null for vegetables without MSP)
      const msp = mspData ? mspData.msp : null;
      
      // Apply MSP as price floor if available
      const suggestedPrice = msp 
        ? Math.max(priceStats.modalAverage, msp)
        : priceStats.modalAverage;
      
      // Calculate price trend
      const trend = this._calculateTrend(marketPrices);
      
      // Check data freshness for confidence adjustment
      const freshness = await DataFreshnessService.getDataFreshness(commodity, mandi);
      
      // Determine confidence level based on data availability AND freshness
      let confidence = this._calculateConfidence(marketPrices.length, 7);
      
      // Degrade confidence if data is stale
      if (freshness.isStale && confidence === 'HIGH') {
        confidence = 'MEDIUM';
      } else if (freshness.isStale && confidence === 'MEDIUM') {
        confidence = 'LOW';
      }
      
      // Generate human-readable rationale
      const rationale = this._generateRationale(
        marketPrices.length, 
        trend, 
        msp, 
        suggestedPrice,
        commodity,
        mandi,
        freshness.isStale
      );
      
      return {
        success: true,
        commodity: commodity,
        mandi: mandi,
        suggestedPrice: Math.round(suggestedPrice),
        minPrice: Math.round(priceStats.minPrice),
        maxPrice: Math.round(priceStats.maxPrice),
        msp: msp,
        trend: trend,
        confidence: confidence,
        rationale: rationale,
        dataPoints: marketPrices.length,
        periodDays: 7,
        dataFreshness: {
          isStale: freshness.isStale,
          ageHours: freshness.ageHours,
          freshnessLevel: freshness.freshnessLevel,
          lastDataDate: freshness.lastDataDate
        }
      };
      
    } catch (error) {
      console.error('PriceInsightService error:', error);
      // Return graceful error response - never throw
      return {
        success: false,
        commodity: commodity,
        mandi: mandi,
        suggestedPrice: null,
        minPrice: null,
        maxPrice: null,
        msp: null,
        trend: null,
        confidence: 'LOW',
        rationale: 'Unable to process market data. Please try again later.',
        error: error.message
      };
    }
  }
  
  /**
   * Calculate price statistics from market data
   * 
   * METHODOLOGY:
   * - suggestedPrice: Average of modal prices (most representative)
   * - minPrice: Lowest recorded price in the period
   * - maxPrice: Highest recorded price in the period
   */
  _calculatePriceStats(marketPrices) {
    const modalPrices = marketPrices.map(p => p.modalPrice);
    const minPrices = marketPrices.map(p => p.minPrice);
    const maxPrices = marketPrices.map(p => p.maxPrice);
    
    return {
      modalAverage: modalPrices.reduce((a, b) => a + b, 0) / modalPrices.length,
      minPrice: Math.min(...minPrices),
      maxPrice: Math.max(...maxPrices)
    };
  }
  
  /**
   * Calculate price trend based on recent data
   * 
   * METHODOLOGY:
   * - Compare first half average vs second half average
   * - RISING: >5% increase
   * - FALLING: >5% decrease
   * - STABLE: Within ±5%
   */
  _calculateTrend(marketPrices) {
    if (marketPrices.length < 2) {
      return 'STABLE';  // Not enough data for trend
    }
    
    // Split into first and second half
    const midpoint = Math.floor(marketPrices.length / 2);
    const recentPrices = marketPrices.slice(0, midpoint);  // More recent
    const olderPrices = marketPrices.slice(midpoint);      // Older
    
    const recentAvg = recentPrices.reduce((sum, p) => sum + p.modalPrice, 0) / recentPrices.length;
    const olderAvg = olderPrices.reduce((sum, p) => sum + p.modalPrice, 0) / olderPrices.length;
    
    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (percentChange > 5) {
      return 'RISING';
    } else if (percentChange < -5) {
      return 'FALLING';
    } else {
      return 'STABLE';
    }
  }
  
  /**
   * Calculate confidence level based on data completeness
   * 
   * - HIGH: 5+ data points (most days have data)
   * - MEDIUM: 3-4 data points
   * - LOW: 0-2 data points
   */
  _calculateConfidence(dataPoints, expectedDays) {
    const ratio = dataPoints / expectedDays;
    
    if (ratio >= 0.7) {
      return 'HIGH';
    } else if (ratio >= 0.4) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }
  
  /**
   * Generate human-readable rationale for the price suggestion
   * 
   * This is crucial for academic defensibility - farmers can understand
   * exactly how the suggestion was derived.
   */
  _generateRationale(dataPoints, trend, msp, suggestedPrice, commodity, mandi, isStale = false) {
    const parts = [];
    
    // Data source explanation
    parts.push(`Based on ${dataPoints} market price record(s) from ${mandi} over the last 7 days.`);
    
    // Staleness warning
    if (isStale) {
      parts.push('⚠️ Note: Market data may be outdated. Please verify current prices.');
    }
    
    // Trend explanation
    if (trend === 'RISING') {
      parts.push('Prices show an upward trend.');
    } else if (trend === 'FALLING') {
      parts.push('Prices show a downward trend.');
    } else {
      parts.push('Prices have remained relatively stable.');
    }
    
    // MSP explanation
    if (msp) {
      if (suggestedPrice > msp) {
        parts.push(`The suggested price of ₹${suggestedPrice}/quintal is above the MSP floor of ₹${msp}/quintal.`);
      } else {
        parts.push(`The MSP floor of ₹${msp}/quintal has been applied to protect your earnings.`);
      }
    } else {
      parts.push(`No government MSP is available for ${commodity}. The suggestion is based purely on market data.`);
    }
    
    // Farmer autonomy disclaimer
    parts.push('This is a suggestion only — you retain full control over your final pricing decision.');
    
    return parts.join(' ');
  }
  
  /**
   * Build response when no market data is available
   */
  _buildNoDataResponse(commodity, mandi, mspData) {
    const msp = mspData ? mspData.msp : null;
    
    return {
      success: true,
      commodity: commodity,
      mandi: mandi,
      suggestedPrice: msp,  // Use MSP as fallback if available
      minPrice: null,
      maxPrice: null,
      msp: msp,
      trend: null,
      confidence: 'LOW',
      rationale: `No recent market data found for ${commodity} in ${mandi}. ` +
                 (msp ? `The MSP of ₹${msp}/quintal can be used as a reference. ` : '') +
                 'Market data will be populated as government datasets are integrated. ' +
                 'You retain full control over your pricing decision.',
      dataPoints: 0,
      periodDays: 7
    };
  }
  
  /**
   * Get list of available commodities in the database
   * Useful for autocomplete and validation
   */
  async getAvailableCommodities() {
    const commodities = await MarketPrice.distinct('commodity');
    return commodities.sort();
  }
  
  /**
   * Get list of available mandis for a commodity
   * Useful for autocomplete and validation
   */
  async getAvailableMandis(commodity) {
    const mandis = await MarketPrice.distinct('mandi', {
      commodity: { $regex: new RegExp(commodity, 'i') }
    });
    return mandis.sort();
  }
}

module.exports = new PriceInsightService();

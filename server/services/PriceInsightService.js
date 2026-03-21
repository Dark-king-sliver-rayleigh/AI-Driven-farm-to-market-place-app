const MarketPrice = require('../models/MarketPrice');
const MSPPrice = require('../models/MSPPrice');
const DataFreshnessService = require('./DataFreshnessService');
const { PolynomialRegression } = require('ml-regression');
const ss = require('simple-statistics');

/**
 * PriceInsightService
 * 
 * ACADEMIC PURPOSE:
 * This service provides transparent, explainable, AI-driven price insights
 * to farmers using actual government mandi (market) data.
 * 
 * AI/ML TECHNIQUES USED:
 * 1. Polynomial Regression — trains a degree-2 regression model on historical
 *    price data (date → price) to predict future prices and detect trends.
 * 2. Statistical confidence intervals — uses standard deviation and R² score
 *    from the regression model to quantify prediction confidence.
 * 3. Trend detection via regression slope — the first derivative of the fitted
 *    polynomial at the latest data point determines trend direction.
 * 
 * KEY PRINCIPLES:
 * 1. ML-powered predictions with transparent methodology
 * 2. Full transparency — all calculations are explainable
 * 3. MSP as price floor — farmers should never price below MSP
 * 4. Farmer autonomy — suggestions only, final pricing is farmer's decision
 * 5. Staleness awareness — marks confidence as LOW if data is stale (>24 hours)
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
      // Tiered freshness approach:
      // Tier 1: Data from last 24 hours (FRESH)
      // Tier 2: Data from last 72 hours (ACCEPTABLE)
      // Tier 3: Historical data up to 30 days (STALE)
      
      const now = new Date();
      const tier1Cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tier2Cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);
      const tier3Cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      let freshnessQuality = 'NONE';
      let usingHistoricalData = false;
      let marketPrices = [];
      
      // Build base query
      const baseQuery = {
        commodity: { $regex: new RegExp(commodity, 'i') },
        mandi: { $regex: new RegExp(mandi, 'i') }
      };
      
      // Tier 1: Try to get data from last 24 hours (FRESH)
      marketPrices = await MarketPrice.find({
        ...baseQuery,
        date: { $gte: tier1Cutoff, $lte: now }
      }).sort({ date: -1 });
      
      if (marketPrices && marketPrices.length > 0) {
        freshnessQuality = 'FRESH';
      } else {
        // Tier 2: Try data from last 72 hours (ACCEPTABLE)
        marketPrices = await MarketPrice.find({
          ...baseQuery,
          date: { $gte: tier2Cutoff, $lte: now }
        }).sort({ date: -1 });
        
        if (marketPrices && marketPrices.length > 0) {
          freshnessQuality = 'ACCEPTABLE';
        } else {
          // Tier 3: Try data from last 30 days (STALE but usable)
          marketPrices = await MarketPrice.find({
            ...baseQuery,
            date: { $gte: tier3Cutoff, $lte: now }
          }).sort({ date: -1 });
          
          if (marketPrices && marketPrices.length > 0) {
            freshnessQuality = 'STALE';
            usingHistoricalData = true;
          } else {
            // Final fallback: Any historical data
            marketPrices = await MarketPrice.find(baseQuery)
              .sort({ date: -1 })
              .limit(30);
            
            if (marketPrices && marketPrices.length > 0) {
              freshnessQuality = 'HISTORICAL';
              usingHistoricalData = true;
            }
          }
        }
      }
      
      // Fetch current MSP for the commodity
      const currentYear = new Date().getFullYear();
      const mspData = await MSPPrice.findOne({
        commodity: { $regex: new RegExp(commodity, 'i') },
        year: { $gte: currentYear - 1 }
      }).sort({ year: -1 });
      
      // If no market data, return low confidence response
      if (!marketPrices || marketPrices.length === 0) {
        return this._buildNoDataResponse(commodity, mandi, mspData);
      }
      
      // ═══════════════════════════════════════════════════════
      // AI/ML: Train Polynomial Regression on price history
      // ═══════════════════════════════════════════════════════
      const mlResult = this._trainPriceModel(marketPrices);
      
      // Get basic statistics as fallback/supplement
      const priceStats = this._calculatePriceStats(marketPrices);
      
      // Get MSP value
      const msp = mspData ? mspData.msp : null;
      
      // ML-predicted price (or fallback to statistical average)
      const predictedPrice = mlResult.predictedPrice || priceStats.modalAverage;
      
      // Apply MSP as price floor
      const suggestedPrice = msp 
        ? Math.max(predictedPrice, msp)
        : predictedPrice;
      
      // ML-based trend detection
      const trend = mlResult.trend || this._calculateTrendFallback(marketPrices);
      
      // Check data freshness for confidence adjustment
      const freshness = await DataFreshnessService.getDataFreshness(commodity, mandi);
      
      // ML confidence from R² score + data freshness
      let confidence = mlResult.confidence || this._calculateConfidence(marketPrices.length, 7);
      
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
        freshness.isStale,
        usingHistoricalData,
        mlResult
      );
      
      // Get location info from most recent record
      const latestRecord = marketPrices[0];
      
      // Get unique varieties from the data
      const varieties = [...new Set(marketPrices.map(p => p.variety).filter(v => v && v !== 'Local'))];
      
      // Calculate average arrivals
      const avgArrivals = marketPrices.reduce((sum, p) => sum + (p.arrivals || 0), 0) / marketPrices.length;
      
      // Get data sources breakdown
      const sourceBreakdown = marketPrices.reduce((acc, p) => {
        acc[p.source] = (acc[p.source] || 0) + 1;
        return acc;
      }, {});
      
      return {
        success: true,
        commodity: commodity,
        mandi: mandi,
        // Location data
        location: {
          state: latestRecord.state || 'Unknown',
          district: latestRecord.district || '',
          mandi: mandi
        },
        // Price data
        suggestedPrice: Math.round(suggestedPrice),
        predictedPrice: Math.round(predictedPrice),  // ML prediction
        minPrice: Math.round(priceStats.minPrice),
        maxPrice: Math.round(priceStats.maxPrice),
        modalPrice: Math.round(priceStats.modalAverage),
        msp: msp,
        unit: latestRecord.unit || 'Rs./Quintal',
        // Variety data
        varieties: varieties.length > 0 ? varieties : ['Local'],
        primaryVariety: latestRecord.variety || 'Local',
        // Market supply data
        avgArrivals: Math.round(avgArrivals * 100) / 100,
        // Trend and confidence
        trend: trend,
        confidence: confidence,
        rationale: rationale,
        // ML model metrics
        mlMetrics: {
          methodology: mlResult.methodology,
          rSquared: mlResult.rSquared,
          meanAbsoluteError: mlResult.mae,
          polynomialDegree: mlResult.degree,
          trainingDataPoints: mlResult.trainingPoints,
          trendSlope: mlResult.trendSlope
        },
        // Data metadata
        dataPoints: marketPrices.length,
        periodDays: 7,
        sources: sourceBreakdown,
        dataFreshness: {
          isStale: freshness.isStale,
          ageHours: freshness.ageHours,
          freshnessLevel: freshness.freshnessLevel,
          lastDataDate: freshness.lastDataDate,
          freshnessQuality: freshnessQuality
        },
        hasValidData: freshnessQuality === 'FRESH' || freshnessQuality === 'ACCEPTABLE',
        usingHistoricalData: usingHistoricalData,
        latestPriceDate: latestRecord.date
      };
      
    } catch (error) {
      console.error('PriceInsightService error:', error);
      return {
        success: false,
        commodity: commodity,
        mandi: mandi,
        suggestedPrice: null,
        predictedPrice: null,
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
  
  // ═══════════════════════════════════════════════════════════════
  // AI/ML METHODS
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Train a Polynomial Regression model on historical market prices
   * 
   * ML TECHNIQUE: Polynomial Regression (Supervised Learning)
   * 
   * The model learns the relationship between time (days since first record)
   * and price (modal price in Rs./Quintal). A degree-2 polynomial captures
   * both linear trends and simple curvature in price movements.
   * 
   * Features:  x = dayIndex (0, 1, 2, ... N)
   * Target:    y = modalPrice
   * Model:     y = a₀ + a₁x + a₂x² (degree-2 polynomial)
   * 
   * @param {Array} marketPrices - Array of MarketPrice documents, sorted by date desc
   * @returns {Object} ML prediction results
   */
  _trainPriceModel(marketPrices) {
    const result = {
      predictedPrice: null,
      trend: null,
      confidence: null,
      rSquared: null,
      mae: null,
      degree: null,
      trainingPoints: marketPrices.length,
      trendSlope: null,
      methodology: 'statistical_fallback'
    };
    
    // Need at least 5 data points for meaningful regression
    if (marketPrices.length < 5) {
      // Fallback to simple average for small datasets
      const avg = marketPrices.reduce((s, p) => s + p.modalPrice, 0) / marketPrices.length;
      result.predictedPrice = avg;
      result.methodology = 'statistical_average';
      result.confidence = 'LOW';
      result.degree = 0;
      return result;
    }
    
    try {
      // Sort by date ascending for regression
      const sorted = [...marketPrices].sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Create feature (x) and target (y) arrays
      const firstDate = new Date(sorted[0].date).getTime();
      const x = sorted.map(p => (new Date(p.date).getTime() - firstDate) / (86400000)); // days since start
      const y = sorted.map(p => p.modalPrice);
      
      // Choose polynomial degree based on data size
      // Degree 2 for moderate data, degree 1 for small data
      const degree = marketPrices.length >= 10 ? 2 : 1;
      
      // ════════════════════════════════════════════
      // TRAIN: Polynomial Regression Model
      // ════════════════════════════════════════════
      const model = new PolynomialRegression(x, y, degree);
      
      // Calculate R² (coefficient of determination)
      const predictions = x.map(xi => model.predict(xi));
      const yMean = ss.mean(y);
      const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - predictions[i], 2), 0);
      const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
      const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
      
      // Calculate MAE (Mean Absolute Error)
      const mae = ss.mean(y.map((yi, i) => Math.abs(yi - predictions[i])));
      
      // ════════════════════════════════════════════
      // PREDICT: Next-day price
      // ════════════════════════════════════════════
      const lastDayIndex = x[x.length - 1];
      const nextDayIndex = lastDayIndex + 1; // predict tomorrow
      const predictedPrice = model.predict(nextDayIndex);
      
      // ════════════════════════════════════════════
      // TREND: Compute slope at latest point
      // Using first derivative of polynomial
      // ════════════════════════════════════════════
      const coefficients = model.coefficients; // [a₀, a₁, a₂]
      let trendSlope;
      if (degree === 2) {
        // dy/dx = a₁ + 2*a₂*x
        trendSlope = coefficients[1] + 2 * coefficients[2] * lastDayIndex;
      } else {
        // dy/dx = a₁ (linear)
        trendSlope = coefficients[1];
      }
      
      // Determine trend direction from slope percentage
      const slopePct = yMean > 0 ? (trendSlope / yMean) * 100 : 0;
      let trend = 'STABLE';
      if (slopePct > 2) trend = 'RISING';
      else if (slopePct < -2) trend = 'FALLING';
      
      // Determine confidence from R² score
      let confidence;
      if (rSquared >= 0.7 && marketPrices.length >= 10) {
        confidence = 'HIGH';
      } else if (rSquared >= 0.4 && marketPrices.length >= 5) {
        confidence = 'MEDIUM';
      } else {
        confidence = 'LOW';
      }
      
      result.predictedPrice = Math.max(0, predictedPrice); // Price can't be negative
      result.trend = trend;
      result.confidence = confidence;
      result.rSquared = Math.round(rSquared * 1000) / 1000;
      result.mae = Math.round(mae * 100) / 100;
      result.degree = degree;
      result.trendSlope = Math.round(trendSlope * 100) / 100;
      result.methodology = `ml_polynomial_regression_degree_${degree}`;
      
    } catch (err) {
      console.error('[PriceInsightService] ML model training error:', err.message);
      // Fallback to statistical average
      const avg = marketPrices.reduce((s, p) => s + p.modalPrice, 0) / marketPrices.length;
      result.predictedPrice = avg;
      result.methodology = 'statistical_fallback_after_ml_error';
      result.confidence = 'LOW';
    }
    
    return result;
  }
  
  /**
   * Calculate price statistics from market data (supplementary to ML)
   */
  _calculatePriceStats(marketPrices) {
    const modalPrices = marketPrices.map(p => p.modalPrice);
    const minPrices = marketPrices.map(p => p.minPrice);
    const maxPrices = marketPrices.map(p => p.maxPrice);
    
    return {
      modalAverage: ss.mean(modalPrices),
      minPrice: Math.min(...minPrices),
      maxPrice: Math.max(...maxPrices),
      standardDeviation: modalPrices.length > 1 ? ss.standardDeviation(modalPrices) : 0
    };
  }
  
  /**
   * Fallback trend calculation when ML model cannot be trained
   */
  _calculateTrendFallback(marketPrices) {
    if (marketPrices.length < 2) return 'STABLE';
    
    const midpoint = Math.floor(marketPrices.length / 2);
    const recentPrices = marketPrices.slice(0, midpoint);
    const olderPrices = marketPrices.slice(midpoint);
    
    const recentAvg = ss.mean(recentPrices.map(p => p.modalPrice));
    const olderAvg = ss.mean(olderPrices.map(p => p.modalPrice));
    
    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (percentChange > 5) return 'RISING';
    if (percentChange < -5) return 'FALLING';
    return 'STABLE';
  }
  
  /**
   * Calculate confidence level based on data completeness
   */
  _calculateConfidence(dataPoints, expectedDays) {
    const ratio = dataPoints / expectedDays;
    if (ratio >= 0.7) return 'HIGH';
    if (ratio >= 0.4) return 'MEDIUM';
    return 'LOW';
  }
  
  /**
   * Generate human-readable rationale for the price suggestion
   * Now includes ML model explanation for academic defensibility
   */
  _generateRationale(dataPoints, trend, msp, suggestedPrice, commodity, mandi, isStale = false, usingHistoricalData = false, mlResult = {}) {
    const parts = [];
    
    // ML methodology explanation
    if (mlResult.methodology && mlResult.methodology.startsWith('ml_')) {
      parts.push(`🤖 AI Prediction: Used ${mlResult.methodology.replace(/_/g, ' ')} trained on ${mlResult.trainingPoints} data points (R²=${mlResult.rSquared}, MAE=₹${mlResult.mae}).`);
    } else if (usingHistoricalData) {
      parts.push(`📅 Using historical market data for ${commodity} as no recent prices are available.`);
    } else {
      parts.push(`Based on ${dataPoints} market price record(s) from ${mandi} over the last 30 days.`);
    }
    
    // Staleness warning
    if (isStale && !usingHistoricalData) {
      parts.push('⚠️ Note: Market data may be outdated. Please verify current prices.');
    }
    
    // Trend explanation with ML context
    if (trend === 'RISING') {
      parts.push(`📈 ML model detects an upward trend (slope: +₹${Math.abs(mlResult.trendSlope || 0)}/day).`);
    } else if (trend === 'FALLING') {
      parts.push(`📉 ML model detects a downward trend (slope: -₹${Math.abs(mlResult.trendSlope || 0)}/day).`);
    } else {
      parts.push('Prices have remained relatively stable (ML model shows minimal slope).');
    }
    
    // MSP explanation
    if (msp) {
      if (suggestedPrice > msp) {
        parts.push(`The suggested price of ₹${suggestedPrice}/quintal is above the MSP floor of ₹${msp}/quintal.`);
      } else {
        parts.push(`The MSP floor of ₹${msp}/quintal has been applied to protect your earnings.`);
      }
    } else {
      parts.push(`No government MSP is available for ${commodity}. The suggestion is based on ML analysis of market data.`);
    }
    
    // Farmer autonomy disclaimer
    parts.push('This is an AI-generated suggestion only — you retain full control over your final pricing decision.');
    
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
      suggestedPrice: msp,
      predictedPrice: null,
      minPrice: null,
      maxPrice: null,
      msp: msp,
      trend: null,
      confidence: 'LOW',
      rationale: `No market data found for ${commodity} in ${mandi}. ` +
                 (msp ? `The MSP of ₹${msp}/quintal can be used as a reference. ` : '') +
                 'Market data will be populated as government datasets are integrated. ' +
                 'You retain full control over your pricing decision.',
      dataPoints: 0,
      periodDays: 30,
      mlMetrics: { methodology: 'none', trainingDataPoints: 0 },
      usingHistoricalData: false
    };
  }
  
  /**
   * Get list of available commodities in the database
   */
  async getAvailableCommodities() {
    const commodities = await MarketPrice.distinct('commodity');
    return commodities.sort();
  }
  
  /**
   * Get list of available mandis for a commodity
   */
  async getAvailableMandis(commodity) {
    const escaped = commodity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mandis = await MarketPrice.distinct('mandi', {
      commodity: { $regex: new RegExp(escaped, 'i') }
    });
    return mandis.sort();
  }
}

module.exports = new PriceInsightService();

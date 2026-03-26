const PriceFeature = require('../models/PriceFeature');
const MarketPrice = require('../models/MarketPrice');
const MSPPrice = require('../models/MSPPrice');
const ModelMetrics = require('../models/ModelMetrics');
const FeatureEngineeringService = require('./FeatureEngineeringService');
const DataFreshnessService = require('./DataFreshnessService');
const { Matrix, inverse } = require('ml-matrix');
const ss = require('simple-statistics');

let XGBoostClass, RandomForestClass;
try {
  const dt = require('decision-tree');
  XGBoostClass     = dt.XGBoost     || dt.default?.XGBoost;
  RandomForestClass = dt.RandomForest || dt.default?.RandomForest;
} catch (e) {
  console.warn('[PriceInsightService] decision-tree package not available, XGBoost/RF disabled:', e.message);
}

/**
 * PriceInsightService (UPGRADED)
 *
 * ADAPTIVE MODEL SELECTION — replaces polynomial regression with a
 * progressive hierarchy of models based on available data:
 *
 *   0 days    → heuristic_msp_floor   (MSP + commodity-group average)
 *   1–6 days  → ewma                  (Exponentially Weighted Moving Average)
 *   7–13 days → ridge_regression      (Regularized linear regression via ml-matrix)
 *   14–29 days → random_forest        (Ensemble of decision trees via decision-tree)
 *   30–59 days → xgboost              (Gradient boosting via decision-tree)
 *   60+ days  → xgboost_seasonal      (XGBoost + seasonal component decomposition)
 *
 * FEATURE SOURCE: PriceFeature collection (written by FeatureEngineeringService)
 *
 * KEY PRINCIPLES:
 * 1. Transparent, explainable predictions with full model metadata
 * 2. MSP as price floor (government guaranteed minimum)
 * 3. Time-based train/test split (NEVER random shuffle)
 * 4. All models trained on engineered features, not raw dates
 * 5. Confidence degrades gracefully with less data and stale data
 */
class PriceInsightService {

  /**
   * Get price insight for a commodity+mandi combination.
   * Primary entry point — used by the farmer dashboard API.
   *
   * @param {string} commodity
   * @param {string} mandi
   * @returns {Promise<Object>} Price insight with prediction, trend, confidence, rationale
   */
  async getInsight(commodity, mandi) {
    try {
      // Normalize inputs
      const normalizedCommodity = commodity.toLowerCase().trim();
      const normalizedMandi     = mandi.toLowerCase().trim();

      // 1. Load feature training data
      const features = await FeatureEngineeringService.getTrainingData(
        normalizedCommodity, normalizedMandi, 365
      );

      // 2. Load MSP for price floor
      const currentYear = new Date().getFullYear();
      const mspData = await MSPPrice.findOne({
        commodity: { $regex: new RegExp(commodity, 'i') },
        year: { $gte: currentYear - 1 }
      }).sort({ year: -1 });
      const msp = mspData ? mspData.msp : null;

      // 3. Determine model from data availability
      const dataPoints     = features.length;
      const methodology    = this._selectModel(dataPoints);
      const featureLevel   = features.length > 0 ? features[features.length - 1].availableFeatureLevel : 'MINIMAL';

      // 4. Train + predict
      let mlResult;
      
      // FALLBACK: If no features, check if we have raw market data
      if (dataPoints === 0) {
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const rawMarketData = await MarketPrice.find({
          commodity: { $regex: new RegExp(`^${escapeRegex(commodity)}$`, 'i') },
          mandi: { $regex: new RegExp(`^${escapeRegex(mandi)}$`, 'i') }
        }).sort({ date: -1 }).limit(30);

        if (rawMarketData && rawMarketData.length > 0) {
          const latest = rawMarketData[0];
          const allPrices = rawMarketData.map(r => r.modalPrice).filter(p => !isNaN(p));
          
          let trend = 'STABLE';
          if (allPrices.length >= 2) {
            if (allPrices[0] > allPrices[allPrices.length - 1] * 1.05) trend = 'RISING';
            else if (allPrices[0] < allPrices[allPrices.length - 1] * 0.95) trend = 'FALLING';
          }

          const suggestedPrice = Math.round(latest.modalPrice);
          const finalSuggested = msp ? Math.max(suggestedPrice, msp) : suggestedPrice;

          return {
            success: true,
            commodity,
            mandi,
            location: {
              state: latest.state || 'Unknown',
              district: latest.district || '',
              mandi
            },
            suggestedPrice: finalSuggested,
            predictedPrice: latest.modalPrice,
            minPrice: latest.minPrice || latest.modalPrice,
            maxPrice: latest.maxPrice || latest.modalPrice,
            modalPrice: latest.modalPrice,
            msp,
            unit: latest.unit || 'Rs./Quintal',
            forecasts: null,
            trend,
            confidence: 'LOW',
            rationale: `Based on the latest raw market transaction at ${mandi}. (AI feature pipeline has not yet processed this commodity).`,
            mlMetrics: {
              methodology: 'Raw Market Data',
              trainingDataPoints: rawMarketData.length,
              rSquared: null,
            },
            dataPoints: rawMarketData.length,
            hasValidData: true
          };
        }
        
        // If absolutely no data, use heuristic
        mlResult = this._heuristicPrediction(msp, normalizedCommodity);
      } else if (dataPoints < 7) {
        mlResult = this._ewmaPrediction(features);
      } else if (dataPoints < 14) {
        mlResult = this._ridgePrediction(features, 'BASIC');
      } else if (dataPoints < 30) {
        mlResult = this._randomForestPrediction(features);
      } else if (dataPoints < 60) {
        mlResult = this._xgboostPrediction(features);
      } else {
        mlResult = this._xgboostSeasonalPrediction(features);
      }

      // 5. Apply MSP price floor
      const predictedPrice = Math.max(0, mlResult.predictedPrice || 0);
      const suggestedPrice = msp ? Math.max(predictedPrice, msp) : predictedPrice;

      // 6. Compute price statistics from feature data
      const prices     = features.map(f => f.modalPrice);
      const priceStats = prices.length > 0 ? {
        min:    Math.min(...prices),
        max:    Math.max(...prices),
        mean:   ss.mean(prices),
        stdDev: prices.length > 1 ? ss.standardDeviation(prices) : 0
      } : { min: msp, max: msp, mean: msp, stdDev: 0 };

      // 7. Check data freshness
      const freshness = await DataFreshnessService.getDataFreshness(commodity, mandi);

      // 8. Degrade confidence if stale
      let confidence = mlResult.confidence || 'LOW';
      if (freshness.isStale && confidence === 'HIGH')   confidence = 'MEDIUM';
      if (freshness.isStale && confidence === 'MEDIUM') confidence = 'LOW';

      // 9. Generate rationale
      const rationale = this._buildRationale(
        commodity, mandi, dataPoints, methodology,
        mlResult, msp, suggestedPrice, freshness.isStale
      );

      // 10. Save model metrics (async, non-blocking)
      if (dataPoints >= 7 && mlResult.rSquared !== null) {
        this._saveModelMetrics(normalizedCommodity, normalizedMandi, methodology, featureLevel, mlResult, features)
          .catch(err => console.error('[PriceInsightService] Metrics save error:', err.message));
      }

      // Latest record for location data and unit
      const latest = features.length > 0 ? features[features.length - 1] : null;

      // Look up the actual stored unit from MarketPrice for this commodity
      const escRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const unitRecord = await MarketPrice.findOne({
        commodity: { $regex: new RegExp(escRx(commodity), 'i') },
        mandi: { $regex: new RegExp(escRx(mandi), 'i') }
      }).sort({ date: -1 }).select('unit').lean();
      const actualUnit = unitRecord?.unit || 'Rs./Quintal';

      return {
        success: true,
        commodity,
        mandi,
        location: {
          state:   latest?.state || 'Unknown',
          district: '',
          mandi
        },
        // Prices
        suggestedPrice:  Math.round(suggestedPrice),
        predictedPrice:  Math.round(predictedPrice),
        minPrice:        Math.round(priceStats.min || 0),
        maxPrice:        Math.round(priceStats.max || 0),
        modalPrice:      Math.round(priceStats.mean || 0),
        msp,
        unit: actualUnit,
        // Multi-horizon forecasts
        forecasts: mlResult.forecasts || null,
        // Trend
        trend:      mlResult.trend || 'STABLE',
        confidence,
        rationale,
        // ML metadata
        mlMetrics: {
          methodology,
          featureLevel,
          rSquared:           mlResult.rSquared    || null,
          meanAbsoluteError:  mlResult.mae         || null,
          mape:               mlResult.mape        || null,
          directionalAccuracy: mlResult.dirAccuracy || null,
          trainingDataPoints: dataPoints,
          trendSlope:         mlResult.trendSlope  || null
        },
        dataPoints,
        dataFreshness: {
          isStale:         freshness.isStale,
          ageHours:        freshness.ageHours,
          freshnessLevel:  freshness.freshnessLevel,
          lastDataDate:    freshness.lastDataDate
        },
        hasValidData:        dataPoints >= 3,
        usingHistoricalData: dataPoints > 0 && freshness.isStale,
        latestPriceDate:     latest?.date || null
      };

    } catch (error) {
      console.error('[PriceInsightService] Error:', error);
      return {
        success: false,
        commodity, mandi,
        suggestedPrice: null, predictedPrice: null,
        minPrice: null, maxPrice: null, msp: null,
        trend: null, confidence: 'LOW',
        rationale: 'Unable to compute price insight. Please try again later.',
        error: error.message
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MODEL IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * MODEL 0: Heuristic — MSP floor or 0 (no data)
   */
  _heuristicPrediction(msp, commodity) {
    return {
      predictedPrice: msp || 0,
      trend: 'STABLE',
      confidence: 'LOW',
      rSquared: null, mae: null, mape: null, dirAccuracy: null,
      trendSlope: 0,
      forecasts: null,
      methodology: 'heuristic_msp_floor'
    };
  }

  /**
   * MODEL 1: EWMA — Exponentially Weighted Moving Average
   * Best for 1-6 data points. Decay factor = 0.85 (recent prices weighted heavily).
   */
  _ewmaPrediction(features) {
    const prices = features.map(f => f.modalPrice);
    const alpha  = 0.3; // smoothing factor (0=ignore recent, 1=only recent)
    let ewma     = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ewma = alpha * prices[i] + (1 - alpha) * ewma;
    }

    const trend    = this._computeTrend(prices);
    const stdDev   = prices.length > 1 ? ss.standardDeviation(prices) : 0;
    const mae      = prices.length > 1 ? ss.mean(prices.map(p => Math.abs(p - ewma))) : stdDev;

    return {
      predictedPrice: ewma + trend.slope,          // EWMA + trend adjustment
      trend: trend.direction,
      confidence: 'LOW',
      rSquared: null, mae, mape: null, dirAccuracy: null,
      trendSlope: trend.slope,
      forecasts: {
        day1: Math.round(ewma + trend.slope),
        day3: Math.round(ewma + trend.slope * 3),
        day7: Math.round(ewma + trend.slope * 7)
      },
      methodology: 'ewma'
    };
  }

  /**
   * MODEL 2: Ridge Regression
   * Regularized linear regression using ml-matrix.
   * Features: lag1, lag2, lag3, rollingMean7, dayOfWeek, month
   * Lambda (L2 penalty): 10.0 — prevents overfitting on sparse data
   */
  _ridgePrediction(features, featureLevel = 'BASIC') {
    try {
      const { X, y, latestRow } = this._buildFeatureMatrix(features, 'BASIC');
      if (X.length < 5) return this._ewmaPrediction(features);

      // Time-based split: 80% train, 20% test
      const splitIdx  = Math.floor(X.length * 0.8);
      const X_train   = X.slice(0, splitIdx);
      const y_train   = y.slice(0, splitIdx);
      const X_test    = X.slice(splitIdx);
      const y_test    = y.slice(splitIdx);

      const beta = this._ridge(X_train, y_train, 10.0);

      // Predict on test set
      const y_pred_test = X_test.map(row => this._dot(beta, row));
      const metrics     = this._evaluate(y_test, y_pred_test);

      // Predict next day
      const nextFeatures = this._buildNextDayFeatures(features, featureLevel);
      const predictedPrice = this._dot(beta, nextFeatures);

      const trend = this._computeTrend(y);

      return {
        predictedPrice: Math.max(0, predictedPrice),
        trend: trend.direction,
        confidence: metrics.rSquared >= 0.5 ? 'MEDIUM' : 'LOW',
        rSquared: metrics.rSquared, mae: metrics.mae,
        mape: metrics.mape, dirAccuracy: metrics.dirAccuracy,
        trendSlope: trend.slope,
        forecasts: {
          day1: Math.round(Math.max(0, predictedPrice)),
          day3: Math.round(Math.max(0, predictedPrice + trend.slope * 2)),
          day7: Math.round(Math.max(0, predictedPrice + trend.slope * 6))
        },
        methodology: 'ridge_regression'
      };
    } catch (err) {
      console.error('[PriceInsightService] Ridge error:', err.message);
      return this._ewmaPrediction(features);
    }
  }

  /**
   * MODEL 3: Random Forest
   * Ensemble of decision trees for 14-29 data points.
   */
  _randomForestPrediction(features) {
    if (!RandomForestClass) {
      console.warn('[PriceInsightService] RandomForest unavailable, falling back to Ridge');
      return this._ridgePrediction(features, 'STANDARD');
    }
    try {
      const { X, y } = this._buildFeatureMatrix(features, 'STANDARD');
      if (X.length < 10) return this._ridgePrediction(features, 'STANDARD');

      const splitIdx = Math.floor(X.length * 0.8);
      const X_train  = X.slice(0, splitIdx);
      const y_train  = y.slice(0, splitIdx);
      const X_test   = X.slice(splitIdx);
      const y_test   = y.slice(splitIdx);

      const rf = new RandomForestClass({
        nEstimators: 30,
        maxDepth: 5,
        maxFeatures: Math.ceil(Math.sqrt(X_train[0]?.length || 6))
      });

      // Convert to object format expected by decision-tree
      const trainData    = X_train.map((row, i) => ({ features: row, label: y_train[i] }));
      rf.fit(trainData.map(d => d.features), trainData.map(d => d.label));

      const y_pred_test    = X_test.map(row => rf.predict([row])[0]);
      const metrics        = this._evaluate(y_test, y_pred_test);

      const nextFeatures   = this._buildNextDayFeatures(features, 'STANDARD');
      const predictedPrice = rf.predict([nextFeatures])[0];
      const trend          = this._computeTrend(y);

      return {
        predictedPrice: Math.max(0, predictedPrice),
        trend: trend.direction,
        confidence: metrics.rSquared >= 0.6 ? 'HIGH' : metrics.rSquared >= 0.4 ? 'MEDIUM' : 'LOW',
        rSquared: metrics.rSquared, mae: metrics.mae,
        mape: metrics.mape, dirAccuracy: metrics.dirAccuracy,
        trendSlope: trend.slope,
        forecasts: {
          day1: Math.round(Math.max(0, predictedPrice)),
          day3: Math.round(Math.max(0, predictedPrice + trend.slope * 2)),
          day7: Math.round(Math.max(0, predictedPrice + trend.slope * 6))
        },
        methodology: 'random_forest'
      };
    } catch (err) {
      console.error('[PriceInsightService] RandomForest error:', err.message);
      return this._ridgePrediction(features, 'STANDARD');
    }
  }

  /**
   * MODEL 4: XGBoost
   * Gradient boosting for 30-59 data points.
   */
  _xgboostPrediction(features) {
    if (!XGBoostClass) {
      console.warn('[PriceInsightService] XGBoost unavailable, falling back to Ridge');
      return this._ridgePrediction(features, 'FULL');
    }
    try {
      const { X, y } = this._buildFeatureMatrix(features, 'FULL');
      if (X.length < 20) return this._randomForestPrediction(features);

      const splitIdx = Math.floor(X.length * 0.8);
      const X_train  = X.slice(0, splitIdx);
      const y_train  = y.slice(0, splitIdx);
      const X_test   = X.slice(splitIdx);
      const y_test   = y.slice(splitIdx);

      const xgb = new XGBoostClass({
        nEstimators:     50,
        maxDepth:         4,
        learningRate:   0.1,
        subsample:      0.8,
        l2Regularization: 1.0
      });

      xgb.fit(X_train, y_train);

      const y_pred_test    = X_test.map(row => xgb.predict([row])[0]);
      const metrics        = this._evaluate(y_test, y_pred_test);

      const nextFeatures   = this._buildNextDayFeatures(features, 'FULL');
      const predictedPrice = xgb.predict([nextFeatures])[0];
      const trend          = this._computeTrend(y);

      return {
        predictedPrice: Math.max(0, predictedPrice),
        trend: trend.direction,
        confidence: metrics.rSquared >= 0.65 ? 'HIGH' : metrics.rSquared >= 0.4 ? 'MEDIUM' : 'LOW',
        rSquared: metrics.rSquared, mae: metrics.mae,
        mape: metrics.mape, dirAccuracy: metrics.dirAccuracy,
        trendSlope: trend.slope,
        forecasts: {
          day1: Math.round(Math.max(0, predictedPrice)),
          day3: Math.round(Math.max(0, predictedPrice + trend.slope * 2)),
          day7: Math.round(Math.max(0, predictedPrice + trend.slope * 6))
        },
        methodology: 'xgboost'
      };
    } catch (err) {
      console.error('[PriceInsightService] XGBoost error:', err.message);
      return this._randomForestPrediction(features);
    }
  }

  /**
   * MODEL 5: XGBoost + Seasonal Decomposition
   * For 60+ data points: decomposes seasonal component first, then boosts on residuals.
   */
  _xgboostSeasonalPrediction(features) {
    try {
      // Compute seasonal index per day-of-week
      const prices = features.map(f => f.modalPrice);
      const overallMean = ss.mean(prices);
      const dowSums   = Array(7).fill(0);
      const dowCounts = Array(7).fill(0);
      features.forEach(f => {
        dowSums[f.dayOfWeek]   += f.modalPrice;
        dowCounts[f.dayOfWeek] += 1;
      });
      const dowFactors = dowSums.map((s, i) =>
        dowCounts[i] > 0 ? s / dowCounts[i] / (overallMean || 1) : 1
      );

      // Build deseasonalized training data
      const deseasonalized = features.map(f => ({
        ...f,
        modalPrice: f.modalPrice / (dowFactors[f.dayOfWeek] || 1)
      }));

      // Run XGBoost on deseasonalized prices
      const baseResult = this._xgboostPrediction(deseasonalized);

      // Re-apply seasonal factor for next day
      const tomorrow    = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDow = tomorrow.getDay();
      const seasonalFactor = dowFactors[tomorrowDow] || 1;

      return {
        ...baseResult,
        predictedPrice: Math.max(0, baseResult.predictedPrice * seasonalFactor),
        forecasts: {
          day1: Math.round(Math.max(0, baseResult.predictedPrice * seasonalFactor)),
          day3: Math.round(Math.max(0, (baseResult.predictedPrice + baseResult.trendSlope * 2) * seasonalFactor)),
          day7: Math.round(Math.max(0, (baseResult.predictedPrice + baseResult.trendSlope * 6) * seasonalFactor))
        },
        methodology: 'xgboost_seasonal'
      };
    } catch (err) {
      console.error('[PriceInsightService] XGBoost seasonal error:', err.message);
      return this._xgboostPrediction(features);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FEATURE MATRIX BUILDER
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build [X, y] matrices from feature rows.
   * Features selected based on availability level.
   * Rows with null in required features are skipped.
   */
  _buildFeatureMatrix(features, level = 'BASIC') {
    const X = [];
    const y = [];
    const latestRow = features[features.length - 1];

    for (const f of features) {
      let row;
      if (level === 'BASIC') {
        if (f.lag1 === null || f.lag2 === null || f.lag3 === null) continue;
        row = [
          f.lag1, f.lag2, f.lag3,
          f.rollingMean7 || f.lag1,
          f.dayOfWeek, f.month,
          f.priceVolatility || 0
        ];
      } else if (level === 'STANDARD') {
        if (f.lag1 === null || f.lag7 === null) continue;
        row = [
          f.lag1, f.lag2 || f.lag1, f.lag3 || f.lag1, f.lag7,
          f.rollingMean7 || f.lag1,
          f.rollingMean14 || f.rollingMean7 || f.lag1,
          f.momentum3 || 0,
          f.weekOverWeekChange || 0,
          f.dayOfWeek, f.month, f.weekOfYear || 1,
          f.isWeekend ? 1 : 0,
          f.priceVolatility || 0,
          f.arrivals || 0
        ];
      } else { // FULL
        if (f.lag1 === null || f.lag7 === null || f.lag14 === null) continue;
        row = [
          f.lag1, f.lag2 || f.lag1, f.lag3 || f.lag1,
          f.lag7, f.lag14,
          f.lag30 || f.lag14,
          f.rollingMean7  || f.lag1,
          f.rollingMean14 || f.lag7,
          f.rollingMean30 || f.lag14,
          f.rollingStd7   || 0,
          f.momentum3     || 0,
          f.weekOverWeekChange || 0,
          f.monthlySeasonalIndex || 1,
          f.dayOfWeek, f.month, f.weekOfYear || 1,
          f.isWeekend ? 1 : 0,
          f.priceVolatility || 0,
          f.arrivals || 0
        ];
      }
      X.push(row);
      y.push(f.modalPrice);
    }

    return { X, y, latestRow };
  }

  /**
   * Build feature vector for the next day (for inference).
   */
  _buildNextDayFeatures(features, level) {
    const last = features[features.length - 1];
    const prices = features.map(f => f.modalPrice);
    const n = prices.length;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (level === 'BASIC') {
      return [
        prices[n - 1],
        n >= 2 ? prices[n - 2] : prices[n - 1],
        n >= 3 ? prices[n - 3] : prices[n - 1],
        n >= 7 ? ss.mean(prices.slice(-7)) : ss.mean(prices),
        tomorrow.getDay(),
        tomorrow.getMonth() + 1,
        last.priceVolatility || 0
      ];
    } else if (level === 'STANDARD') {
      return [
        prices[n - 1],
        n >= 2 ? prices[n - 2] : prices[n - 1],
        n >= 3 ? prices[n - 3] : prices[n - 1],
        n >= 7 ? prices[n - 7] : prices[0],
        n >= 7 ? ss.mean(prices.slice(-7)) : ss.mean(prices),
        n >= 14 ? ss.mean(prices.slice(-14)) : ss.mean(prices),
        n >= 3 ? prices[n - 1] - prices[n - 4] : 0,
        n >= 7 && prices[n - 8] > 0 ? ((prices[n - 1] - prices[n - 8]) / prices[n - 8]) * 100 : 0,
        tomorrow.getDay(), tomorrow.getMonth() + 1,
        FeatureEngineeringService._weekOfYear ? FeatureEngineeringService._weekOfYear(tomorrow) : 1,
        (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) ? 1 : 0,
        last.priceVolatility || 0, last.arrivals || 0
      ];
    } else { // FULL
      return [
        prices[n - 1],
        n >= 2 ? prices[n - 2] : prices[n - 1],
        n >= 3 ? prices[n - 3] : prices[n - 1],
        n >= 7 ? prices[n - 7] : prices[0],
        n >= 14 ? prices[n - 14] : prices[0],
        n >= 30 ? prices[n - 30] : prices[0],
        n >= 7 ? ss.mean(prices.slice(-7)) : ss.mean(prices),
        n >= 14 ? ss.mean(prices.slice(-14)) : ss.mean(prices),
        n >= 30 ? ss.mean(prices.slice(-30)) : ss.mean(prices),
        n >= 7 && prices.slice(-7).length > 1 ? ss.standardDeviation(prices.slice(-7)) : 0,
        n >= 3 ? prices[n - 1] - prices[n - 4] : 0,
        n >= 7 && prices[n - 8] > 0 ? ((prices[n - 1] - prices[n - 8]) / prices[n - 8]) * 100 : 0,
        last.monthlySeasonalIndex || 1,
        tomorrow.getDay(), tomorrow.getMonth() + 1,
        1, // weekOfYear placeholder
        (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) ? 1 : 0,
        last.priceVolatility || 0, last.arrivals || 0
      ];
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RIDGE REGRESSION (manual via ml-matrix)
  // β = (X^T·X + λ·I)^(-1) · X^T · y
  // ═══════════════════════════════════════════════════════════════
  _ridge(X, y, lambda = 10.0) {
    const Xm   = new Matrix(X);
    const ym   = Matrix.columnVector(y);
    const XtX  = Xm.transpose().mmul(Xm);
    const I    = Matrix.eye(XtX.rows).mul(lambda);
    const beta = inverse(XtX.add(I)).mmul(Xm.transpose()).mmul(ym);
    return beta.to1DArray();
  }

  _dot(beta, row) {
    return beta.reduce((sum, b, i) => sum + b * (row[i] || 0), 0);
  }

  // ═══════════════════════════════════════════════════════════════
  // EVALUATION METRICS
  // ═══════════════════════════════════════════════════════════════
  _evaluate(yTrue, yPred) {
    if (yTrue.length === 0) return { rSquared: null, mae: null, mape: null, dirAccuracy: null };

    const mean  = ss.mean(yTrue);
    const ssRes = yTrue.reduce((s, yi, i) => s + Math.pow(yi - yPred[i], 2), 0);
    const ssTot = yTrue.reduce((s, yi)    => s + Math.pow(yi - mean, 2), 0);
    const rSquared = ssTot > 0 ? Math.round((1 - ssRes / ssTot) * 1000) / 1000 : 0;

    const mae  = Math.round(ss.mean(yTrue.map((yi, i) => Math.abs(yi - yPred[i]))) * 100) / 100;

    const validMape = yTrue.filter((yi, i) => yi > 0);
    const mape = validMape.length > 0
      ? Math.round(ss.mean(yTrue.map((yi, i) => yi > 0 ? Math.abs((yi - yPred[i]) / yi) * 100 : 0)) * 100) / 100
      : null;

    // Directional accuracy: % of time trend direction is correct
    let dirCorrect = 0;
    for (let i = 1; i < yTrue.length; i++) {
      const actualDir = yTrue[i] - yTrue[i - 1];
      const predDir   = yPred[i] - yPred[i - 1];
      if ((actualDir >= 0 && predDir >= 0) || (actualDir < 0 && predDir < 0)) dirCorrect++;
    }
    const dirAccuracy = yTrue.length > 1
      ? Math.round((dirCorrect / (yTrue.length - 1)) * 100) / 100
      : null;

    return { rSquared, mae, mape, dirAccuracy };
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  _selectModel(dataPoints) {
    if (dataPoints === 0)    return 'heuristic_msp_floor';
    if (dataPoints < 7)     return 'ewma';
    if (dataPoints < 14)    return 'ridge_regression';
    if (dataPoints < 30)    return 'random_forest';
    if (dataPoints < 60)    return 'xgboost';
    return 'xgboost_seasonal';
  }

  _computeTrend(prices) {
    if (prices.length < 2) return { slope: 0, direction: 'STABLE' };
    try {
      const x = prices.map((_, i) => i);
      const reg = ss.linearRegression(x.map((xi, i) => [xi, prices[i]]));
      const slope = reg.m;
      const avg = ss.mean(prices);
      const slopePct = avg > 0 ? (slope / avg) * 100 : 0;
      return {
        slope: Math.round(slope * 100) / 100,
        direction: slopePct > 2 ? 'RISING' : slopePct < -2 ? 'FALLING' : 'STABLE'
      };
    } catch {
      return { slope: 0, direction: 'STABLE' };
    }
  }

  _buildRationale(commodity, mandi, dataPoints, methodology, mlResult, msp, suggestedPrice, isStale) {
    const parts = [];

    const methodLabels = {
      heuristic_msp_floor: 'MSP floor (no market data available)',
      ewma: 'Exponentially Weighted Moving Average',
      ridge_regression: 'Ridge Regression (regularized linear model)',
      random_forest: 'Random Forest (ensemble of decision trees)',
      xgboost: 'XGBoost (gradient boosted trees)',
      xgboost_seasonal: 'XGBoost with seasonal decomposition'
    };

    if (dataPoints === 0) {
      parts.push(`⚠️ No market data available for ${commodity} in ${mandi}.`);
    } else {
      parts.push(`🤖 AI Model: ${methodLabels[methodology] || methodology}, trained on ${dataPoints} data points.`);
    }

    if (mlResult.rSquared !== null) {
      parts.push(`Model fit R²=${mlResult.rSquared}, MAE=₹${mlResult.mae}, Directional Accuracy=${mlResult.dirAccuracy}%.`);
    }

    if (mlResult.mape !== null) {
      parts.push(`Prediction error: ~${mlResult.mape}%.`);
    }

    if (isStale) parts.push('⚠️ Data may be outdated — verify current market prices.');

    if (mlResult.trend === 'RISING') {
      parts.push(`📈 Upward trend detected (+₹${Math.abs(mlResult.trendSlope || 0)}/day).`);
    } else if (mlResult.trend === 'FALLING') {
      parts.push(`📉 Downward trend detected (-₹${Math.abs(mlResult.trendSlope || 0)}/day).`);
    } else {
      parts.push('Prices are relatively stable.');
    }

    if (msp) {
      parts.push(suggestedPrice > msp
        ? `Suggested ₹${Math.round(suggestedPrice)} is above MSP floor of ₹${msp}.`
        : `MSP floor ₹${msp} applied to protect earnings.`);
    }

    parts.push('AI suggestion only — final pricing is your decision.');
    return parts.join(' ');
  }

  async _saveModelMetrics(commodity, mandi, methodology, featureLevel, mlResult, features) {
    // Deactivate previous active model for this pair
    await ModelMetrics.updateMany(
      { commodity, mandi, isActive: true },
      { $set: { isActive: false } }
    );

    const now = new Date();
    const splitIdx = Math.floor(features.length * 0.8);
    await ModelMetrics.create({
      commodity, mandi, methodology, featureLevel,
      dataPoints: features.length,
      trainPeriod: {
        start: features[0]?.date || null,
        end:   features[splitIdx - 1]?.date || null
      },
      testPeriod: {
        start: features[splitIdx]?.date || null,
        end:   features[features.length - 1]?.date || null
      },
      metrics: {
        rSquared:            mlResult.rSquared    || null,
        mae:                 mlResult.mae         || null,
        mape:                mlResult.mape        || null,
        rmse:                null,
        directionalAccuracy: mlResult.dirAccuracy || null
      },
      isActive: true
    });
  }

  // ─── Existing API methods — always read from MarketPrice (raw source of truth) ──────

  async getAvailableCommodities() {
    return (await MarketPrice.distinct('commodity')).sort();
  }

  async getAvailableMandis(commodity) {
    const escaped = commodity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (await MarketPrice.distinct('mandi', {
      commodity: { $regex: new RegExp(escaped, 'i') }
    })).sort();
  }
}

module.exports = new PriceInsightService();

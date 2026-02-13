const mongoose = require('mongoose');

/**
 * DemandForecast Schema
 *
 * Stores pre-computed demand forecasts per commodity + location.
 * Generated periodically by the DemandForecastService (daily/weekly via scheduler).
 *
 * METHOD (non-ML baseline):
 *  - Moving average with exponential recency weighting
 *  - Simple additive trend component
 *  - Day-of-week seasonality factors
 *
 * Each document covers a forecast horizon (e.g., next 90 days / 12 weeks).
 */

const WeeklyForecastSchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true },        // 1..12
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  forecastQty: { type: Number, required: true, min: 0 },
  lowerBound: { type: Number, min: 0 },
  upperBound: { type: Number, min: 0 }
}, { _id: false });

const DemandForecastSchema = new mongoose.Schema({
  commodity: {
    type: String,
    required: [true, 'Commodity is required'],
    trim: true,
    index: true
  },
  location: {
    type: String,
    trim: true,
    default: 'ALL',
    index: true
  },
  horizonDays: {
    type: Number,
    default: 90,
    min: 7
  },
  totalForecastQty: {
    type: Number,
    default: 0,
    min: 0
  },
  weeklyBreakdown: {
    type: [WeeklyForecastSchema],
    default: []
  },
  confidence: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'LOW'
  },
  assumptions: {
    type: [String],
    default: []
  },
  methodology: {
    type: String,
    default: 'moving_average_trend_seasonality'
  },
  // Inputs summary
  inputSummary: {
    historicalOrderCount: { type: Number, default: 0 },
    historicalDays: { type: Number, default: 0 },
    avgDailyQty: { type: Number, default: 0 },
    trendDirection: { type: String, enum: ['RISING', 'STABLE', 'FALLING'], default: 'STABLE' },
    trendStrength: { type: Number, default: 0 }
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    index: true
  }
}, { timestamps: true });

// Compound index for fast lookups
DemandForecastSchema.index({ commodity: 1, location: 1, generatedAt: -1 });

module.exports = mongoose.model('DemandForecast', DemandForecastSchema);

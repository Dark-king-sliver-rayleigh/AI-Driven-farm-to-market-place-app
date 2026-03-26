const mongoose = require('mongoose');

/**
 * PriceFeature Schema
 *
 * Feature store: one row per (commodity, mandi, date) containing
 * all engineered time-series features used for ML model training
 * and inference.
 *
 * PIPELINE STAGE: Feature Engineering
 * Created by: FeatureEngineeringService
 * Consumed by: PriceInsightService (training + prediction)
 *
 * CRITICAL: This collection should NEVER be pruned — it is the
 * cumulative training dataset that grows over time.
 *
 * Feature levels (based on available history):
 *   MINIMAL  — 0-6 days:  calendar features only
 *   BASIC    — 7-13 days: + lag1-3, rollingMean7
 *   STANDARD — 14-29 days: + lag7, rollingMean14, weekOverWeekChange
 *   FULL     — 30+ days:  + lag14, lag30, rollingMean30, monthlySeasonalIndex
 */
const PriceFeatureSchema = new mongoose.Schema({
  // Identity
  commodity: { type: String, required: true, trim: true, lowercase: true, index: true },
  commodityGroup: { type: String, default: 'other' },
  mandi:     { type: String, required: true, trim: true, lowercase: true, index: true },
  date:      { type: Date, required: true, index: true },

  // ─── Target variable ──────────────────────────────────────────
  modalPrice: { type: Number, required: true },

  // ─── Calendar features (always available) ─────────────────────
  dayOfWeek:   { type: Number, min: 0, max: 6 },   // 0=Sunday
  dayOfMonth:  { type: Number, min: 1, max: 31 },
  month:       { type: Number, min: 1, max: 12 },
  weekOfYear:  { type: Number, min: 1, max: 53 },
  isWeekend:   { type: Boolean, default: false },

  // ─── Price spread features (always available if prices exist) ──
  priceSpread:      { type: Number, default: null },  // maxPrice - minPrice
  priceVolatility:  { type: Number, default: null },  // spread / modalPrice

  // ─── Supply signal ─────────────────────────────────────────────
  arrivals:    { type: Number, default: null },

  // ─── Lag features (available based on history length) ──────────
  lag1:  { type: Number, default: null },   // price 1 day ago
  lag2:  { type: Number, default: null },   // price 2 days ago
  lag3:  { type: Number, default: null },   // price 3 days ago
  lag7:  { type: Number, default: null },   // price 7 days ago
  lag14: { type: Number, default: null },   // price 14 days ago
  lag30: { type: Number, default: null },   // price 30 days ago

  // ─── Rolling window features ───────────────────────────────────
  rollingMean7:  { type: Number, default: null },
  rollingStd7:   { type: Number, default: null },
  rollingMean14: { type: Number, default: null },
  rollingMean30: { type: Number, default: null },

  // ─── Momentum features ─────────────────────────────────────────
  momentum3:          { type: Number, default: null },   // price[t] - price[t-3]
  weekOverWeekChange: { type: Number, default: null },   // % change vs 7 days ago

  // ─── Seasonal features ─────────────────────────────────────────
  monthlySeasonalIndex: { type: Number, default: null }, // ratio vs yearly mean

  // ─── Metadata ──────────────────────────────────────────────────
  // Which features are available (drives model selection)
  availableFeatureLevel: {
    type: String,
    enum: ['MINIMAL', 'BASIC', 'STANDARD', 'FULL'],
    default: 'MINIMAL'
  },
  computedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Unique constraint: one feature row per commodity+mandi+date
PriceFeatureSchema.index({ commodity: 1, mandi: 1, date: 1 }, { unique: true });

// Efficient time-range queries for training set construction
PriceFeatureSchema.index({ commodity: 1, mandi: 1, date: -1 });

// Group-level queries
PriceFeatureSchema.index({ commodityGroup: 1, date: -1 });

module.exports = mongoose.model('PriceFeature', PriceFeatureSchema);

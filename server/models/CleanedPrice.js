const mongoose = require('mongoose');

/**
 * CleanedPrice Schema
 *
 * Stores cleaned and standardized market price records.
 * This is the intermediate layer between raw MarketPrice (as-received)
 * and the PriceFeature (model-ready) collections.
 *
 * PIPELINE STAGE: Cleaning
 * Created by: CleanedPriceService
 * Consumed by: FeatureEngineeringService
 */
const CleanedPriceSchema = new mongoose.Schema({
  // Normalized commodity name (lowercase, trimmed, synonym-resolved)
  commodity: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },

  // Commodity group for cross-commodity signals
  commodityGroup: {
    type: String,
    enum: ['vegetables', 'fruits', 'cereals', 'pulses', 'spices', 'other'],
    default: 'other'
  },

  // State name (normalized)
  state: {
    type: String,
    trim: true,
    default: 'Unknown'
  },

  // Normalized mandi name
  mandi: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },

  // Date of price record
  date: {
    type: Date,
    required: true,
    index: true
  },

  // Prices (validated: min <= modal <= max, all > 0)
  minPrice: { type: Number, required: true, min: 0 },
  maxPrice: { type: Number, required: true, min: 0 },
  modalPrice: { type: Number, required: true, min: 0 },

  // Computed: price spread (supply volatility indicator)
  priceSpread: { type: Number, default: 0 },

  // Market arrivals (supply signal)
  arrivals: { type: Number, default: 0 },

  // Outlier flag: true if price is outside IQR bounds for this commodity+mandi
  // Outliers are flagged but NOT removed — models can learn to discount them
  isOutlier: { type: Boolean, default: false },

  // Gap-fill flag: true if this record was created by forward-filling a missing date
  isGapFilled: { type: Boolean, default: false },

  cleanedAt: { type: Date, default: Date.now },

  // Reference back to raw record (null if gap-filled)
  sourceRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketPrice', default: null }
}, {
  timestamps: true
});

// Compound unique index: one cleaned record per commodity+mandi+date
CleanedPriceSchema.index({ commodity: 1, mandi: 1, date: 1 }, { unique: true });

// Efficient range queries for feature engineering
CleanedPriceSchema.index({ commodity: 1, mandi: 1, date: -1 });

// Group queries for cross-commodity signals
CleanedPriceSchema.index({ commodityGroup: 1, date: -1 });

module.exports = mongoose.model('CleanedPrice', CleanedPriceSchema);

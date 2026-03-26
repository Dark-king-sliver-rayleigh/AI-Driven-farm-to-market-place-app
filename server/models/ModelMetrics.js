const mongoose = require('mongoose');

/**
 * ModelMetrics Schema
 *
 * Model registry: tracks every trained model version for each
 * commodity+mandi combination. Stores training metadata,
 * evaluation metrics, and tracks the currently active model.
 *
 * PIPELINE STAGE: Model Registry
 * Created by: PriceInsightService._trainAndEvaluate()
 * Used for: model versioning, performance monitoring, retraining decisions
 */
const ModelMetricsSchema = new mongoose.Schema({
  // Model identity
  commodity: { type: String, required: true, trim: true, lowercase: true, index: true },
  mandi:     { type: String, required: true, trim: true, lowercase: true, index: true },

  // When this model was trained
  trainedAt: { type: Date, default: Date.now, index: true },

  // Which algorithm was selected (driven by data availability)
  methodology: {
    type: String,
    enum: [
      'heuristic_msp_floor',
      'ewma',
      'ridge_regression',
      'random_forest',
      'xgboost',
      'xgboost_seasonal'
    ],
    required: true
  },

  // Feature level used for training
  featureLevel: {
    type: String,
    enum: ['MINIMAL', 'BASIC', 'STANDARD', 'FULL'],
    required: true
  },

  // Training data summary
  dataPoints:  { type: Number, default: 0 },
  trainPeriod: {
    start: { type: Date, default: null },
    end:   { type: Date, default: null }
  },
  testPeriod: {
    start: { type: Date, default: null },
    end:   { type: Date, default: null }
  },

  // Evaluation metrics (computed on held-out test set)
  metrics: {
    rSquared:            { type: Number, default: null },  // 0..1 (higher = better)
    mae:                 { type: Number, default: null },  // Mean Absolute Error (₹)
    mape:                { type: Number, default: null },  // Mean Absolute % Error
    rmse:                { type: Number, default: null },  // Root Mean Squared Error
    directionalAccuracy: { type: Number, default: null }   // % correct trend direction
  },

  // Only one model per commodity+mandi should be active at a time
  isActive: { type: Boolean, default: true, index: true }
}, {
  timestamps: true
});

// Compound index for model lookup
ModelMetricsSchema.index({ commodity: 1, mandi: 1, isActive: 1 });

// Latest model first
ModelMetricsSchema.index({ commodity: 1, mandi: 1, trainedAt: -1 });

module.exports = mongoose.model('ModelMetrics', ModelMetricsSchema);

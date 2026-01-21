const mongoose = require('mongoose');

/**
 * MarketPrice Schema
 * 
 * Stores daily mandi (market) prices from government Agmarknet datasets.
 * This data is used for providing transparent, explainable price insights
 * to farmers based on actual market transactions.
 * 
 * Data Source: Agmarknet / data.gov.in daily commodity reports
 * 
 * ACADEMIC NOTE: This is raw market data, NOT predictions.
 * All price insights are computed from historical transaction data.
 */
const MarketPriceSchema = new mongoose.Schema({
  // Commodity name (e.g., "Tomato", "Onion", "Potato")
  commodity: {
    type: String,
    required: [true, 'Commodity name is required'],
    trim: true,
    index: true  // Index for fast commodity lookups
  },
  
  // State name (e.g., "Tamil Nadu", "Karnataka")
  state: {
    type: String,
    required: [true, 'State name is required'],
    trim: true
  },
  
  // Mandi/Market name (e.g., "Bangalore APMC", "Chennai Market")
  mandi: {
    type: String,
    required: [true, 'Mandi name is required'],
    trim: true,
    index: true  // Index for fast mandi lookups
  },
  
  // Date of price record
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true  // Index for date range queries
  },
  
  // Minimum price recorded (Rs./Quintal)
  minPrice: {
    type: Number,
    required: [true, 'Minimum price is required'],
    min: [0, 'Price cannot be negative']
  },
  
  // Maximum price recorded (Rs./Quintal)
  maxPrice: {
    type: Number,
    required: [true, 'Maximum price is required'],
    min: [0, 'Price cannot be negative']
  },
  
  // Modal (most common) price (Rs./Quintal)
  // This is typically the most representative market price
  modalPrice: {
    type: Number,
    required: [true, 'Modal price is required'],
    min: [0, 'Price cannot be negative']
  },
  
  // Variety of the commodity (e.g., "Local", "Hybrid")
  variety: {
    type: String,
    trim: true,
    default: 'Local'
  },
  
  // Unit of price (typically Rs./Quintal)
  unit: {
    type: String,
    default: 'Rs./Quintal'
  },
  
  // Arrivals quantity (market supply indicator)
  arrivals: {
    type: Number,
    default: 0
  },
  
  // Timestamp when this record was fetched from external API
  fetchedAt: {
    type: Date,
    default: null,
    index: true  // Index for freshness queries
  },
  
  // Data source identifier (e.g., "data.gov.in", "manual", "seed")
  source: {
    type: String,
    default: 'manual',
    enum: ['data.gov.in', 'manual', 'seed', 'csv']
  }
}, { 
  timestamps: true 
});

// Compound index for efficient queries by commodity + mandi + date
MarketPriceSchema.index({ commodity: 1, mandi: 1, date: -1 });

// Compound index for state + commodity queries
MarketPriceSchema.index({ state: 1, commodity: 1 });

// Unique compound index for duplicate prevention
MarketPriceSchema.index(
  { commodity: 1, mandi: 1, date: 1, variety: 1 },
  { unique: true, background: true }
);

module.exports = mongoose.model('MarketPrice', MarketPriceSchema);

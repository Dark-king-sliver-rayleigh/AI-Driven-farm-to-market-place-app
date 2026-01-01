const mongoose = require('mongoose');

/**
 * MSPPrice Schema
 * 
 * Stores Minimum Support Price (MSP) data from CACP (Commission for 
 * Agricultural Costs and Prices) datasets.
 * 
 * MSP serves as a price floor guarantee by the government.
 * This is used to ensure farmers never price below MSP.
 * 
 * Data Source: CACP / Ministry of Agriculture
 * 
 * ACADEMIC NOTE: MSP is a government policy instrument, not market-derived.
 * It provides a safety net for farmers against price crashes.
 */
const MSPPriceSchema = new mongoose.Schema({
  // Commodity name (must match with MarketPrice commodity names)
  commodity: {
    type: String,
    required: [true, 'Commodity name is required'],
    trim: true,
    index: true  // Index for fast commodity lookups
  },
  
  // MSP value in Rs./Quintal
  msp: {
    type: Number,
    required: [true, 'MSP value is required'],
    min: [0, 'MSP cannot be negative']
  },
  
  // Season/Year (e.g., "KMS 2024-25", "RMS 2025-26")
  // KMS = Kharif Marketing Season
  // RMS = Rabi Marketing Season
  season: {
    type: String,
    required: [true, 'Season/Year is required'],
    trim: true
  },
  
  // Extracted year for easier queries
  year: {
    type: Number,
    index: true
  }
}, { 
  timestamps: true 
});

// Compound index for commodity + year queries
MSPPriceSchema.index({ commodity: 1, year: -1 });

/**
 * Pre-save hook to extract year from season string
 * Example: "KMS 2024-25" -> 2024
 */
MSPPriceSchema.pre('save', function(next) {
  if (this.season && !this.year) {
    // Extract year from season string (e.g., "KMS 2024-25" -> 2024)
    const yearMatch = this.season.match(/(\d{4})/);
    if (yearMatch) {
      this.year = parseInt(yearMatch[1]);
    }
  }
  next();
});

module.exports = mongoose.model('MSPPrice', MSPPriceSchema);

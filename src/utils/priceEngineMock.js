/**
 * Mock price suggestion engine
 * TODO: Replace with real price-intelligence API (ETL from MSP, mandi rates, historical prices)
 * 
 * This is a deterministic mock that returns price suggestions based on product data
 */

/**
 * Generate a mock price suggestion for a product
 * @param {Object} product - Product object
 * @returns {{value: number, currency: string, confidence: number, rationaleId: string}}
 */
export function mockPriceSuggestion(product) {
  if (!product) {
    return {
      value: 0,
      currency: 'INR',
      confidence: 0,
      rationaleId: 'no-product',
    }
  }

  const basePrice = product.pricePerUnit || 0
  const currency = product.currency || 'INR'
  
  // Deterministic mock: adjust price based on product name hash and quantity
  const nameHash = product.name
    ? product.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    : 0
  
  // Price adjustment: ±5% based on hash
  const adjustment = (nameHash % 10 - 5) / 100
  const suggestedValue = basePrice * (1 + adjustment)
  
  // Confidence based on quantity and source
  let confidence = 0.7 // base confidence
  if (product.quantity > 100) confidence += 0.1
  if (product.quantity > 500) confidence += 0.1
  if (product.source === 'WEB') confidence += 0.05
  
  confidence = Math.min(0.95, Math.max(0.3, confidence))
  
  // Rationale ID based on factors
  let rationaleId = 'r1'
  if (product.quantity > 500) rationaleId = 'r2' // bulk pricing
  
  return {
    value: Math.round(suggestedValue * 100) / 100,
    currency,
    confidence,
    rationaleId,
  }
}

/**
 * Get rationale text for a rationale ID
 * @param {string} rationaleId
 * @returns {string}
 */
export function getRationaleText(rationaleId) {
  const rationales = {
    r1: 'Calculated from MSP, mandi average & trends',
    r2: 'Bulk pricing analysis based on market rates',
    r3: 'Limited data available, using historical averages',
  }
  return rationales[rationaleId] || 'Price suggestion based on market data'
}

/**
 * Predict farmer acceptance likelihood for a price offer
 * @param {Object} product - Product object
 * @param {number} offerPrice - Consumer's price offer
 * @returns {number} - Likelihood between 0 and 1
 */
export function predictFarmerAcceptance(product, offerPrice) {
  if (!product || !product.priceSuggestion) return 0.5
  
  const currentPrice = product.pricePerUnit
  const suggestedPrice = product.priceSuggestion.value
  const confidence = product.priceSuggestion.confidence
  
  // If offer is close to suggested price, higher likelihood
  const priceDiff = Math.abs(offerPrice - suggestedPrice) / suggestedPrice
  let likelihood = 1 - priceDiff * 2 // decreases as difference increases
  
  // Adjust based on confidence
  likelihood = likelihood * confidence + (1 - confidence) * 0.5
  
  // If offer is higher than current, increase likelihood
  if (offerPrice > currentPrice) {
    likelihood = Math.min(1, likelihood + 0.2)
  }
  
  return Math.max(0.1, Math.min(0.95, likelihood))
}


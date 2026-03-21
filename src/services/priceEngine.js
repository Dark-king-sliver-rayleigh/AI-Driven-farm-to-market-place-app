/**
 * Live Price Engine Service
 * 
 * Replaces priceEngineMock with real API calls to the Price Insight backend.
 * Falls back to local mock calculation ONLY when the API is unreachable
 * (offline, unauthenticated, or server down).
 * 
 * Backend endpoint: GET /api/farmer/price-insight?commodity=X&mandi=Y
 * Returns: { success, commodity, mandi, suggestedPrice, minPrice, maxPrice,
 *            msp, trend, confidence, rationale }
 */
import { priceInsightAPI } from './api';

// ── Confidence mapping: backend string → numeric 0-1 ──
const CONFIDENCE_MAP = {
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.4,
};

// ── Trend → rationaleId mapping for UI compatibility ──
const TREND_RATIONALE_MAP = {
  RISING: 'r_rising',
  FALLING: 'r_falling',
  STABLE: 'r_stable',
};

/**
 * Fetch a live price suggestion from the backend Price Insight API.
 *
 * @param {Object} product - Product data ({ name, pricePerUnit, currency, quantity, source })
 * @param {string} [mandi] - Optional mandi/market name. Defaults to 'Chennai'.
 * @returns {Promise<{value: number, currency: string, confidence: number, rationaleId: string, rationale: string, trend: string|null, minPrice: number|null, maxPrice: number|null, msp: number|null, source: string}>}
 */
export async function fetchPriceSuggestion(product, mandi) {
  if (!product || !product.name) {
    return _localFallback(product);
  }

  try {
    const targetMandi = mandi || 'Chennai';
    const response = await priceInsightAPI.getInsight(product.name, targetMandi);

    if (response && response.success && response.suggestedPrice != null) {
      const confidence = typeof response.confidence === 'string'
        ? (CONFIDENCE_MAP[response.confidence] || 0.5)
        : (response.confidence || 0.5);

      const trend = response.trend || null;
      const rationaleId = TREND_RATIONALE_MAP[trend] || 'r_market';

      return {
        value: response.suggestedPrice,
        currency: product.currency || 'INR',
        confidence,
        rationaleId,
        rationale: response.rationale || getRationaleText(rationaleId),
        trend,
        minPrice: response.minPrice || null,
        maxPrice: response.maxPrice || null,
        msp: response.msp || null,
        source: 'API', // indicates live data
      };
    }

    // API returned but no meaningful data → fall back
    return _localFallback(product);
  } catch (err) {
    // Network error, auth failure, server down → fall back gracefully
    console.warn('[PriceEngine] API unavailable, using local fallback:', err.message);
    return _localFallback(product);
  }
}

/**
 * Local deterministic fallback (same logic as the former priceEngineMock).
 * Used when the API is unreachable so the UX never breaks.
 */
function _localFallback(product) {
  if (!product) {
    return {
      value: 0,
      currency: 'INR',
      confidence: 0,
      rationaleId: 'no-product',
      rationale: 'No product data available',
      trend: null,
      minPrice: null,
      maxPrice: null,
      msp: null,
      source: 'FALLBACK',
    };
  }

  const basePrice = product.pricePerUnit || 0;
  const currency = product.currency || 'INR';

  const nameHash = product.name
    ? product.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    : 0;

  const adjustment = (nameHash % 10 - 5) / 100;
  const suggestedValue = basePrice * (1 + adjustment);

  let confidence = 0.7;
  if (product.quantity > 100) confidence += 0.1;
  if (product.quantity > 500) confidence += 0.1;
  if (product.source === 'WEB') confidence += 0.05;
  confidence = Math.min(0.95, Math.max(0.3, confidence));

  let rationaleId = 'r1';
  if (product.quantity > 500) rationaleId = 'r2';

  return {
    value: Math.round(suggestedValue * 100) / 100,
    currency,
    confidence,
    rationaleId,
    rationale: getRationaleText(rationaleId),
    trend: null,
    minPrice: null,
    maxPrice: null,
    msp: null,
    source: 'FALLBACK',
  };
}

/**
 * Get human-readable rationale text for a rationale ID.
 * Supports both legacy mock IDs (r1, r2, r3) and live API IDs.
 *
 * @param {string} rationaleId
 * @returns {string}
 */
export function getRationaleText(rationaleId) {
  const rationales = {
    // Legacy mock rationales
    r1: 'Calculated from MSP, mandi average & trends',
    r2: 'Bulk pricing analysis based on market rates',
    r3: 'Limited data available, using historical averages',
    // Live API rationales
    r_rising: 'Market trend is rising — strong demand detected',
    r_falling: 'Market trend is falling — consider competitive pricing',
    r_stable: 'Market is stable — price aligned with current rates',
    r_market: 'Based on real-time mandi market data',
    'no-product': 'No product data available',
  };
  return rationales[rationaleId] || 'Price suggestion based on market data';
}

/**
 * Predict farmer acceptance likelihood for a price offer.
 * Uses live suggestion data when available, otherwise falls back to local calc.
 *
 * @param {Object} product - Product with priceSuggestion attached
 * @param {number} offerPrice - Consumer's price offer
 * @returns {number} Likelihood between 0 and 1
 */
export function predictFarmerAcceptance(product, offerPrice) {
  if (!product || !product.priceSuggestion) return 0.5;

  const currentPrice = product.pricePerUnit;
  const suggestedPrice = product.priceSuggestion.value;
  const confidence = product.priceSuggestion.confidence;

  const priceDiff = Math.abs(offerPrice - suggestedPrice) / suggestedPrice;
  let likelihood = 1 - priceDiff * 2;

  likelihood = likelihood * confidence + (1 - confidence) * 0.5;

  if (offerPrice > currentPrice) {
    likelihood = Math.min(1, likelihood + 0.2);
  }

  // If we have min/max price bounds from the API, use them for smarter prediction
  const minPrice = product.priceSuggestion.minPrice;
  const maxPrice = product.priceSuggestion.maxPrice;
  if (minPrice != null && maxPrice != null && maxPrice > minPrice) {
    // Offer within market range → boost likelihood
    if (offerPrice >= minPrice && offerPrice <= maxPrice) {
      likelihood = Math.min(1, likelihood + 0.1);
    }
    // Offer above max → very likely to accept
    if (offerPrice > maxPrice) {
      likelihood = Math.min(0.98, likelihood + 0.25);
    }
  }

  // MSP floor: if offer is below MSP, farmers likely reject
  const msp = product.priceSuggestion.msp;
  if (msp != null && offerPrice < msp) {
    likelihood = Math.max(0.05, likelihood - 0.4);
  }

  return Math.max(0.1, Math.min(0.95, likelihood));
}

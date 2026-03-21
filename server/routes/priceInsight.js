const express = require('express');
const router = express.Router();
const {
  getPriceInsight,
  getAvailableCommodities,
  getAvailableMandis,
  getCategories,
  getCommoditiesByCategory
} = require('../controllers/priceInsightController');
const {
  getPlatformPrices,
  comparePrices,
  getTradedCommodities
} = require('../controllers/platformPriceController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

/**
 * Price Insight Routes
 * 
 * All routes require:
 * 1. Authentication (valid JWT token)
 * 2. FARMER role authorization
 * 
 * These endpoints provide market-based price insights
 * to help farmers make informed pricing decisions.
 */

// All routes require authentication
router.use(authenticateUser);

// All routes are FARMER-only
router.use(authorizeRoles('FARMER'));

/**
 * GET /api/farmer/price-insight
 * Main endpoint - get price insight for commodity + mandi
 * 
 * Query params: commodity (required), mandi (required)
 */
router.get('/price-insight', getPriceInsight);

/**
 * GET /api/farmer/price-insight/commodities
 * Helper endpoint - get list of available commodities
 */
router.get('/price-insight/commodities', getAvailableCommodities);

/**
 * GET /api/farmer/price-insight/mandis
 * Helper endpoint - get list of mandis for a commodity
 * 
 * Query params: commodity (required)
 */
router.get('/price-insight/mandis', getAvailableMandis);

/**
 * GET /api/farmer/price-insight/categories
 * Get all categories with commodity counts
 */
router.get('/price-insight/categories', getCategories);

/**
 * GET /api/farmer/price-insight/categories/:categoryId
 * Get commodities and insights for a specific category
 */
router.get('/price-insight/categories/:categoryId', getCommoditiesByCategory);

/**
 * GET /api/farmer/platform-prices/commodities
 * Get list of product names that have delivered orders (for dropdown)
 */
router.get('/platform-prices/commodities', getTradedCommodities);

/**
 * GET /api/farmer/platform-prices
 * Platform price aggregator — realized prices from marketplace orders
 *
 * Query params: commodity (required), from (optional), to (optional)
 */
router.get('/platform-prices', getPlatformPrices);

/**
 * GET /api/farmer/price-insight/compare
 * Compare platform price vs mandi (government market) price
 *
 * Query params: commodity (required), mandi (required), from (optional), to (optional)
 */
router.get('/price-insight/compare', comparePrices);

module.exports = router;


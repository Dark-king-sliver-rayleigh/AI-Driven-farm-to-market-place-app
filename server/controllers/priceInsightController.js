const PriceInsightService = require('../services/PriceInsightService');
const { getAllCategories, getCategoryById, categorizeCommodities } = require('../utils/commodityCategories');

/**
 * Price Insight Controller
 * 
 * Handles API requests for price insights.
 * FARMER role only - provides market-based pricing suggestions.
 * 
 * ACADEMIC NOTE:
 * This endpoint returns data-driven insights, NOT predictions.
 * All values are derived from actual government mandi data.
 */

/**
 * @desc    Get price insight for a commodity at a specific mandi
 * @route   GET /api/farmer/price-insight
 * @access  Private (FARMER only)
 * 
 * Query Parameters:
 * - commodity (required): Commodity name (e.g., "Tomato", "Onion")
 * - mandi (required): Market name (e.g., "Chennai", "Bangalore")
 * 
 * Response:
 * {
 *   "success": true,
 *   "commodity": "Tomato",
 *   "mandi": "Chennai",
 *   "suggestedPrice": 4500,
 *   "minPrice": 4000,
 *   "maxPrice": 5000,
 *   "msp": null,
 *   "trend": "RISING",
 *   "confidence": "MEDIUM",
 *   "rationale": "Based on 5 market price records..."
 * }
 */
const getPriceInsight = async (req, res) => {
  try {
    const { commodity, mandi } = req.query;
    
    // Validate required parameters
    if (!commodity) {
      return res.status(400).json({
        success: false,
        message: 'Commodity parameter is required. Example: ?commodity=Tomato'
      });
    }
    
    if (!mandi) {
      return res.status(400).json({
        success: false,
        message: 'Mandi parameter is required. Example: ?mandi=Chennai'
      });
    }
    
    // Get price insight from service
    const insight = await PriceInsightService.getInsight(commodity, mandi);
    
    // Return insight (service handles all error cases gracefully)
    res.status(200).json(insight);
    
  } catch (error) {
    console.error('getPriceInsight error:', error);
    
    // Return graceful error - never crash for missing data
    res.status(500).json({
      success: false,
      commodity: req.query.commodity || null,
      mandi: req.query.mandi || null,
      suggestedPrice: null,
      minPrice: null,
      maxPrice: null,
      msp: null,
      trend: null,
      confidence: 'LOW',
      rationale: 'An error occurred while processing your request. Please try again.',
      message: 'Server error while fetching price insight'
    });
  }
};

/**
 * @desc    Get list of available commodities for autocomplete
 * @route   GET /api/farmer/price-insight/commodities
 * @access  Private (FARMER only)
 */
const getAvailableCommodities = async (req, res) => {
  try {
    const commodities = await PriceInsightService.getAvailableCommodities();
    
    res.status(200).json({
      success: true,
      count: commodities.length,
      commodities
    });
  } catch (error) {
    console.error('getAvailableCommodities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching commodities',
      commodities: []
    });
  }
};

/**
 * @desc    Get list of available mandis for a commodity
 * @route   GET /api/farmer/price-insight/mandis
 * @access  Private (FARMER only)
 */
const getAvailableMandis = async (req, res) => {
  try {
    const { commodity } = req.query;
    
    if (!commodity) {
      return res.status(400).json({
        success: false,
        message: 'Commodity parameter is required'
      });
    }
    
    const mandis = await PriceInsightService.getAvailableMandis(commodity);
    
    res.status(200).json({
      success: true,
      commodity,
      count: mandis.length,
      mandis
    });
  } catch (error) {
    console.error('getAvailableMandis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching mandis',
      mandis: []
    });
  }
};

/**
 * @desc    Get all market insight categories
 * @route   GET /api/farmer/price-insight/categories
 * @access  Private (FARMER only)
 */
const getCategories = async (req, res) => {
  try {
    // Get all commodities from database
    const allCommodities = await PriceInsightService.getAvailableCommodities();
    
    // Categorize them
    const categorized = categorizeCommodities(allCommodities);
    
    // Get category definitions with counts
    const categories = getAllCategories().map(cat => ({
      ...cat,
      commodityCount: categorized[cat.id]?.length || 0
    }));
    
    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('getCategories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching categories',
      categories: []
    });
  }
};

/**
 * @desc    Get commodities and insights for a specific category
 * @route   GET /api/farmer/price-insight/categories/:categoryId
 * @access  Private (FARMER only)
 */
const getCommoditiesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    // Validate category
    const category = getCategoryById(categoryId);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: `Invalid category: ${categoryId}. Valid categories: vegetables, fruits, cereals, pulses, spices, others`
      });
    }
    
    // Get all commodities and categorize
    const allCommodities = await PriceInsightService.getAvailableCommodities();
    const categorized = categorizeCommodities(allCommodities);
    const commoditiesInCategory = categorized[categoryId] || [];
    
    // Get insights for each commodity (limit API calls for performance)
    const insightPromises = commoditiesInCategory.slice(0, 50).map(async (commodity) => {
      try {
        // Get first available mandi for this commodity
        const mandis = await PriceInsightService.getAvailableMandis(commodity);
        if (mandis.length === 0) {
          return { commodity, hasData: false };
        }
        
        const mandi = mandis[0];
        const insight = await PriceInsightService.getInsight(commodity, mandi);
        
        // Show all commodities that have any price data, regardless of freshness tier.
        // Freshness/confidence metadata is already included so the UI can
        // communicate data quality to the user without hiding commodities entirely.
        return {
          commodity,
          mandi,
          hasData: insight.suggestedPrice !== null && insight.suggestedPrice > 0,
          ...insight
        };
      } catch {
        return { commodity, hasData: false };
      }
    });
    
    const commodityInsights = await Promise.all(insightPromises);
    
    // Sort: commodities with data first, then alphabetically
    commodityInsights.sort((a, b) => {
      if (a.hasData && !b.hasData) return -1;
      if (!a.hasData && b.hasData) return 1;
      return a.commodity.localeCompare(b.commodity);
    });
    
    res.status(200).json({
      success: true,
      category,
      totalCommodities: commoditiesInCategory.length,
      commodities: commodityInsights
    });
  } catch (error) {
    console.error('getCommoditiesByCategory error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching category commodities',
      commodities: []
    });
  }
};

module.exports = {
  getPriceInsight,
  getAvailableCommodities,
  getAvailableMandis,
  getCategories,
  getCommoditiesByCategory
};


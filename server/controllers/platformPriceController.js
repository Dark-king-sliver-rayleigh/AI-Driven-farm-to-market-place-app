const PlatformPriceService = require('../services/PlatformPriceService');

/**
 * Platform Price Controller
 *
 * Provides endpoints for the platform price aggregator — computed from
 * the marketplace's own delivered order data, NOT from government mandi data.
 *
 * Available to FARMER role.
 */

/**
 * @desc    Get platform realized prices for a commodity
 * @route   GET /api/farmer/platform-prices
 * @access  Private (FARMER)
 *
 * Query: commodity (required), from (ISO date), to (ISO date)
 */
const getPlatformPrices = async (req, res) => {
  try {
    const { commodity, from, to } = req.query;

    if (!commodity) {
      return res.status(400).json({
        success: false,
        message: 'commodity query parameter is required. Example: ?commodity=Tomato'
      });
    }

    const result = await PlatformPriceService.getPlatformPrices({
      commodity,
      from: from || null,
      to: to || null
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('getPlatformPrices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching platform prices'
    });
  }
};

/**
 * @desc    Compare platform price vs mandi price
 * @route   GET /api/farmer/price-insight/compare
 * @access  Private (FARMER)
 *
 * Query: commodity (required), mandi (required), from, to
 */
const comparePrices = async (req, res) => {
  try {
    const { commodity, mandi, from, to } = req.query;

    if (!commodity) {
      return res.status(400).json({
        success: false,
        message: 'commodity query parameter is required'
      });
    }

    if (!mandi) {
      return res.status(400).json({
        success: false,
        message: 'mandi query parameter is required'
      });
    }

    const result = await PlatformPriceService.comparePrices({
      commodity,
      mandi,
      from: from || null,
      to: to || null
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('comparePrices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while comparing prices'
    });
  }
};

/**
 * @desc    Get list of product names that have at least one delivered order
 * @route   GET /api/farmer/platform-prices/commodities
 * @access  Private (FARMER)
 */
const getTradedCommodities = async (req, res) => {
  try {
    const commodities = await PlatformPriceService.getTradedCommodities();
    res.status(200).json({
      success: true,
      count: commodities.length,
      commodities
    });
  } catch (error) {
    console.error('getTradedCommodities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching traded commodities',
      commodities: []
    });
  }
};

module.exports = {
  getPlatformPrices,
  comparePrices,
  getTradedCommodities
};

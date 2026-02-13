const DemandForecastService = require('../services/DemandForecastService');

/**
 * Demand Forecast Controller
 *
 * Provides endpoints for commodity demand forecasting.
 * Available to FARMER role.
 */

/**
 * @desc    Get demand forecast for a commodity + location
 * @route   GET /api/farmer/demand-forecast
 * @access  Private (FARMER)
 *
 * Query: commodity (required), location (optional, default ALL),
 *        horizon (optional, e.g. "90d" or "12w", default 90d)
 */
const getDemandForecast = async (req, res) => {
  try {
    const { commodity, location, horizon } = req.query;

    if (!commodity) {
      return res.status(400).json({
        success: false,
        message: 'commodity query parameter is required. Example: ?commodity=Tomato'
      });
    }

    // Parse horizon
    let horizonDays = 90;
    if (horizon) {
      if (horizon.endsWith('d')) {
        horizonDays = parseInt(horizon);
      } else if (horizon.endsWith('w')) {
        horizonDays = parseInt(horizon) * 7;
      }
      if (isNaN(horizonDays) || horizonDays < 7) horizonDays = 90;
    }

    const forecast = await DemandForecastService.getLatestForecast(
      commodity,
      location || 'ALL',
      horizonDays
    );

    res.status(200).json({
      success: true,
      forecast
    });
  } catch (error) {
    console.error('getDemandForecast error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching demand forecast'
    });
  }
};

/**
 * @desc    Trigger forecast regeneration (admin/manual)
 * @route   POST /api/farmer/demand-forecast/generate
 * @access  Private (FARMER)
 *
 * Body: { commodity, location }
 */
const triggerForecastGeneration = async (req, res) => {
  try {
    const { commodity, location } = req.body;

    if (!commodity) {
      return res.status(400).json({
        success: false,
        message: 'commodity is required in request body'
      });
    }

    const forecast = await DemandForecastService.generateForecast(
      commodity,
      location || 'ALL'
    );

    res.status(201).json({
      success: true,
      message: 'Forecast generated',
      forecast
    });
  } catch (error) {
    console.error('triggerForecastGeneration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating forecast'
    });
  }
};

module.exports = {
  getDemandForecast,
  triggerForecastGeneration
};

const CropRecommendationService = require('../services/CropRecommendationService');

/**
 * CropRecommendationController
 * Handles AI-powered crop recommendation requests
 */

// GET /api/crop-recommendation
exports.getRecommendations = async (req, res) => {
  try {
    const { location, season, soilType, farmAreaAcres } = req.query;
    
    if (!location) {
      return res.status(400).json({
        success: false,
        error: 'Location is required. Pass ?location=StateName'
      });
    }
    
    const result = await CropRecommendationService.getRecommendations({
      location,
      season: season || undefined,
      soilType: soilType || undefined,
      farmAreaAcres: farmAreaAcres ? parseFloat(farmAreaAcres) : undefined
    });
    
    res.json(result);
  } catch (error) {
    console.error('[CropRecommendationController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate crop recommendations',
      message: error.message
    });
  }
};

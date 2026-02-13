const { GoogleGenerativeAI } = require('@google/generative-ai');
const MarketPrice = require('../models/MarketPrice');
const DemandForecastService = require('./DemandForecastService');

/**
 * CropRecommendationService
 * 
 * AI/ML TECHNIQUES USED:
 * 1. Large Language Model (LLM) — Google Gemini for intelligent crop reasoning
 *    based on location, season, and market conditions.
 * 2. Data-Driven Scoring — combines market price data and demand forecasts
 *    to compute profit potential and demand scores.
 * 3. Context Injection (RAG-like) — injects live platform data into the LLM
 *    prompt so recommendations are grounded in real market conditions.
 * 
 * FALLBACK: If Gemini API is unavailable, uses a rule-based seasonal
 * recommendation engine based on Indian agricultural patterns.
 */

// Indian seasonal crop mapping
const SEASONAL_CROPS = {
  kharif: ['Rice', 'Maize', 'Cotton', 'Soybean', 'Groundnut', 'Sugarcane', 'Jowar', 'Bajra', 'Tur', 'Moong'],
  rabi: ['Wheat', 'Mustard', 'Gram', 'Barley', 'Lentil', 'Peas', 'Potato', 'Onion', 'Garlic', 'Linseed'],
  zaid: ['Watermelon', 'Muskmelon', 'Cucumber', 'Pumpkin', 'Bitter Gourd', 'Bottle Gourd', 'Okra', 'Sunflower'],
  yearround: ['Tomato', 'Brinjal', 'Chilli', 'Capsicum', 'Cauliflower', 'Cabbage', 'Carrot', 'Spinach', 'Coriander', 'Banana']
};

// Which season based on month
function getCurrentSeason(month) {
  if (month >= 6 && month <= 10) return 'kharif';   // Jun-Oct
  if (month >= 11 || month <= 2) return 'rabi';      // Nov-Feb
  return 'zaid';                                      // Mar-May
}

class CropRecommendationService {
  
  constructor() {
    this.geminiModel = null;
    this._initGemini();
  }

  _initGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('[CropRecommendationService] Gemini AI initialized successfully');
      } catch (err) {
        console.warn('[CropRecommendationService] Failed to initialize Gemini:', err.message);
      }
    } else {
      console.warn('[CropRecommendationService] No GEMINI_API_KEY set, using rule-based fallback');
    }
  }

  /**
   * Get AI-powered crop recommendations for a farmer.
   * 
   * @param {Object} params
   * @param {string} params.location - Farmer's location/state
   * @param {string} [params.season] - Season override (kharif/rabi/zaid)
   * @param {string} [params.soilType] - Optional soil type
   * @param {number} [params.farmAreaAcres] - Optional farm area
   * @returns {Promise<Object>} Ranked recommendations
   */
  async getRecommendations({ location, season, soilType, farmAreaAcres }) {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const effectiveSeason = season || getCurrentSeason(currentMonth);
    
    // Step 1: Gather market intelligence from our database
    const marketContext = await this._gatherMarketContext(effectiveSeason);
    
    // Step 2: Try Gemini AI first, fallback to rule-based
    let recommendations;
    if (this.geminiModel) {
      try {
        recommendations = await this._geminiRecommend(location, effectiveSeason, soilType, farmAreaAcres, marketContext);
      } catch (err) {
        console.warn('[CropRecommendationService] Gemini failed, using fallback:', err.message);
        recommendations = await this._ruleBasedRecommend(location, effectiveSeason, marketContext);
      }
    } else {
      recommendations = await this._ruleBasedRecommend(location, effectiveSeason, marketContext);
    }
    
    return {
      success: true,
      season: effectiveSeason,
      location: location,
      generatedAt: new Date(),
      methodology: this.geminiModel ? 'gemini_ai_with_market_data' : 'rule_based_seasonal_scoring',
      recommendations
    };
  }

  /**
   * Gemini-powered recommendation with market data context injection
   */
  async _geminiRecommend(location, season, soilType, farmAreaAcres, marketContext) {
    const prompt = `You are an expert Indian agricultural advisor AI. Based on the following data, recommend the top 6 crops for a farmer to grow.

FARMER CONTEXT:
- Location: ${location}
- Season: ${season} (${season === 'kharif' ? 'June-October, monsoon' : season === 'rabi' ? 'November-February, winter' : 'March-May, summer'})
${soilType ? `- Soil Type: ${soilType}` : ''}
${farmAreaAcres ? `- Farm Area: ${farmAreaAcres} acres` : ''}

LIVE MARKET DATA FROM OUR PLATFORM:
${marketContext.summary}

TOP PRICED COMMODITIES CURRENTLY:
${marketContext.topPriced.map(c => `- ${c.commodity}: ₹${c.avgPrice}/quintal (trend: ${c.trend})`).join('\n')}

DEMAND FORECAST HIGHLIGHTS:
${marketContext.demandHighlights.join('\n')}

INSTRUCTIONS:
Respond ONLY with a valid JSON array of exactly 6 crop recommendations. Each object must have:
- "cropName": string (crop name)
- "profitPotential": "HIGH" | "MEDIUM" | "LOW"  
- "demandTrend": "RISING" | "STABLE" | "FALLING"
- "suitabilityScore": number between 0 and 100
- "reason": string (2-3 sentences explaining why, referencing market data)
- "estimatedYieldPerAcre": string (e.g., "15-20 quintals")
- "waterRequirement": "HIGH" | "MEDIUM" | "LOW"

Sort by suitabilityScore descending. Return ONLY the JSON array, no other text.`;

    const result = await this.geminiModel.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not parse Gemini response as JSON');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate and enrich with market data
    return parsed.map((crop, index) => ({
      rank: index + 1,
      cropName: crop.cropName,
      profitPotential: crop.profitPotential || 'MEDIUM',
      demandTrend: crop.demandTrend || 'STABLE',
      suitabilityScore: Math.min(100, Math.max(0, crop.suitabilityScore || 50)),
      reason: crop.reason || 'Recommended based on seasonal suitability.',
      estimatedYieldPerAcre: crop.estimatedYieldPerAcre || 'N/A',
      waterRequirement: crop.waterRequirement || 'MEDIUM',
      marketPrice: marketContext.priceMap[crop.cropName?.toLowerCase()] || null,
      aiGenerated: true
    }));
  }

  /**
   * Rule-based fallback using seasonal data + market scoring
   */
  async _ruleBasedRecommend(location, season, marketContext) {
    const seasonalCrops = [...(SEASONAL_CROPS[season] || []), ...SEASONAL_CROPS.yearround];
    
    // Score each crop based on market data
    const scored = seasonalCrops.map(crop => {
      const marketData = marketContext.priceMap[crop.toLowerCase()];
      let score = 50; // base score
      
      // Boost score if we have market data showing good prices
      if (marketData) {
        score += 15; // data availability bonus
        if (marketData.avgPrice > marketData.overallAvg) score += 10; // above average price
        if (marketData.trend === 'RISING') score += 10;
        else if (marketData.trend === 'FALLING') score -= 5;
      }
      
      // Seasonal bonus
      if (SEASONAL_CROPS[season]?.includes(crop)) score += 10;
      
      // Clamp
      score = Math.min(95, Math.max(20, score));
      
      return {
        rank: 0,
        cropName: crop,
        profitPotential: score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW',
        demandTrend: marketData?.trend || 'STABLE',
        suitabilityScore: score,
        reason: marketData 
          ? `Current market price is ₹${marketData.avgPrice}/quintal. ${marketData.trend === 'RISING' ? 'Prices are trending upward.' : 'Market is stable.'} Suitable for ${season} season.`
          : `Traditionally grown in ${season} season in India. Market data will improve recommendations as more data is collected.`,
        estimatedYieldPerAcre: 'Varies by region',
        waterRequirement: 'MEDIUM',
        marketPrice: marketData || null,
        aiGenerated: false
      };
    });
    
    // Sort by score and take top 6
    scored.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    return scored.slice(0, 6).map((crop, i) => ({ ...crop, rank: i + 1 }));
  }

  /**
   * Gather market context from platform data for LLM prompt
   */
  async _gatherMarketContext(season) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    
    // Get recent market prices aggregated by commodity
    const priceAgg = await MarketPrice.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: '$commodity',
          avgPrice: { $avg: '$modalPrice' },
          minPrice: { $min: '$minPrice' },
          maxPrice: { $max: '$maxPrice' },
          dataPoints: { $sum: 1 },
          latestDate: { $max: '$date' }
        }
      },
      { $sort: { avgPrice: -1 } }
    ]);
    
    // Build price map
    const priceMap = {};
    const overallAvg = priceAgg.length > 0 
      ? priceAgg.reduce((s, c) => s + c.avgPrice, 0) / priceAgg.length 
      : 0;
    
    for (const commodity of priceAgg) {
      priceMap[commodity._id.toLowerCase()] = {
        avgPrice: Math.round(commodity.avgPrice),
        minPrice: Math.round(commodity.minPrice),
        maxPrice: Math.round(commodity.maxPrice),
        trend: commodity.avgPrice > overallAvg * 1.1 ? 'RISING' : 
               commodity.avgPrice < overallAvg * 0.9 ? 'FALLING' : 'STABLE',
        overallAvg: Math.round(overallAvg)
      };
    }
    
    // Top priced commodities
    const topPriced = priceAgg.slice(0, 5).map(c => ({
      commodity: c._id,
      avgPrice: Math.round(c.avgPrice),
      trend: priceMap[c._id.toLowerCase()]?.trend || 'STABLE'
    }));
    
    // Demand highlights
    const demandHighlights = [];
    try {
      const seasonCrops = SEASONAL_CROPS[season] || [];
      for (const crop of seasonCrops.slice(0, 3)) {
        try {
          const forecast = await DemandForecastService.getLatestForecast(crop, 'ALL');
          if (forecast && forecast.totalForecastQty > 0) {
            demandHighlights.push(`- ${crop}: Forecasted demand of ${forecast.totalForecastQty} units over next 90 days (${forecast.confidence} confidence)`);
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    
    if (demandHighlights.length === 0) {
      demandHighlights.push('- No demand forecast data available yet');
    }
    
    const summary = priceAgg.length > 0
      ? `We have market price data for ${priceAgg.length} commodities. Average price across all commodities: ₹${Math.round(overallAvg)}/quintal.`
      : 'Limited market data available on the platform currently.';
    
    return { priceMap, topPriced, demandHighlights, summary };
  }
}

module.exports = new CropRecommendationService();

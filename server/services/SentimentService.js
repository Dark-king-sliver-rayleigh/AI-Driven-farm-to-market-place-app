const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * SentimentService
 * 
 * AI/ML TECHNIQUE: Natural Language Processing — Sentiment Analysis
 * 
 * Uses Google Gemini LLM to analyze the sentiment of customer feedback text.
 * Extracts:
 *   1. Sentiment polarity (POSITIVE, NEUTRAL, NEGATIVE)
 *   2. Sentiment score (0.0 to 1.0)
 *   3. Key themes (e.g., "freshness", "delivery speed", "packaging")
 *   4. Summary (brief AI-generated summary of the feedback)
 * 
 * FALLBACK: When Gemini is unavailable, uses keyword-based sentiment analysis
 * with predefined positive/negative word lists.
 */

// Keyword lists for fallback sentiment analysis
const POSITIVE_WORDS = [
  'good', 'great', 'excellent', 'fresh', 'fast', 'quick', 'tasty', 'best',
  'wonderful', 'perfect', 'amazing', 'love', 'happy', 'satisfied', 'quality',
  'clean', 'nice', 'delicious', 'beautiful', 'recommend', 'awesome', 'fantastic',
  'superb', 'outstanding', 'brilliant', 'impressed', 'thank', 'thanks'
];

const NEGATIVE_WORDS = [
  'bad', 'poor', 'terrible', 'rotten', 'late', 'slow', 'stale', 'worst',
  'awful', 'horrible', 'hate', 'unhappy', 'disappointed', 'damaged', 'broken',
  'dirty', 'expensive', 'overpriced', 'cold', 'wrong', 'missing', 'complaint',
  'spoiled', 'delay', 'delayed', 'refund', 'never', 'waste', 'disgusting'
];

const THEME_KEYWORDS = {
  freshness: ['fresh', 'stale', 'rotten', 'spoiled', 'quality', 'organic'],
  delivery_speed: ['fast', 'slow', 'late', 'quick', 'early', 'delay', 'delayed', 'time', 'wait'],
  packaging: ['packed', 'package', 'packaging', 'damaged', 'broken', 'intact', 'wrapped'],
  pricing: ['price', 'expensive', 'cheap', 'cost', 'value', 'worth', 'overpriced', 'affordable'],
  customer_service: ['polite', 'rude', 'helpful', 'responsive', 'support', 'complaint'],
  taste: ['tasty', 'delicious', 'flavour', 'flavor', 'taste', 'yummy']
};

class SentimentService {
  
  constructor() {
    this.geminiModel = null;
    this._initGemini();
  }

  _initGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        console.log('[SentimentService] Gemini AI initialized (gemini-2.5-flash-lite, free tier)');
      } catch (err) {
        console.warn('[SentimentService] Failed to initialize Gemini:', err.message);
      }
    } else {
      console.warn('[SentimentService] No GEMINI_API_KEY set, using keyword-based fallback');
    }
  }

  /**
   * Analyze sentiment of a feedback comment.
   * 
   * @param {string} text - The feedback text to analyze
   * @returns {Promise<Object>} { sentiment, score, themes, summary, methodology }
   */
  async analyze(text) {
    if (!text || !text.trim()) {
      return {
        sentiment: 'NEUTRAL',
        score: 0.5,
        themes: [],
        summary: 'No feedback text provided.',
        methodology: 'none'
      };
    }
    
    // Try Gemini first
    if (this.geminiModel) {
      try {
        return await this._geminiAnalyze(text);
      } catch (err) {
        console.warn('[SentimentService] Gemini error, using fallback:', err.message);
      }
    }
    
    // Fallback to keyword-based
    return this._keywordAnalyze(text);
  }

  /**
   * Batch analyze multiple feedback texts.
   * Returns aggregate sentiment statistics.
   * 
   * @param {Array<{id: string, text: string}>} feedbacks
   * @returns {Promise<Object>} Aggregate results
   */
  async batchAnalyze(feedbacks) {
    const results = [];
    
    for (const fb of feedbacks) {
      const result = await this.analyze(fb.text);
      results.push({ id: fb.id, ...result });
    }
    
    // Compute aggregate
    const scores = results.map(r => r.score);
    const avgScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0.5;
    
    const sentimentCounts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
    results.forEach(r => { sentimentCounts[r.sentiment] = (sentimentCounts[r.sentiment] || 0) + 1; });
    
    // Collect all themes and count
    const themeMap = {};
    results.forEach(r => {
      (r.themes || []).forEach(theme => {
        themeMap[theme] = (themeMap[theme] || 0) + 1;
      });
    });
    
    const topThemes = Object.entries(themeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme, count]) => ({ theme, count }));
    
    return {
      total: results.length,
      averageScore: Math.round(avgScore * 100) / 100,
      overallSentiment: avgScore >= 0.6 ? 'POSITIVE' : avgScore <= 0.4 ? 'NEGATIVE' : 'NEUTRAL',
      distribution: sentimentCounts,
      topThemes,
      individual: results
    };
  }

  /**
   * Gemini-powered sentiment analysis
   */
  async _geminiAnalyze(text) {
    const prompt = `Analyze the sentiment of this customer feedback for an Indian agriculture marketplace (farm-to-consumer delivery). The feedback was left after a produce delivery.

FEEDBACK: "${text}"

Respond ONLY with a valid JSON object (no markdown, no code fences) containing:
{
  "sentiment": "POSITIVE" or "NEUTRAL" or "NEGATIVE",
  "score": number between 0.0 (most negative) and 1.0 (most positive),
  "themes": array of 1-3 relevant themes from: ["freshness", "delivery_speed", "packaging", "pricing", "customer_service", "taste", "quantity", "cleanliness"],
  "summary": "One sentence summary of the feedback sentiment"
}`;

    const result = await this.geminiModel.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse Gemini response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      sentiment: parsed.sentiment || 'NEUTRAL',
      score: Math.min(1, Math.max(0, parsed.score || 0.5)),
      themes: parsed.themes || [],
      summary: parsed.summary || '',
      methodology: 'gemini_llm_sentiment_analysis'
    };
  }

  /**
   * Keyword-based fallback sentiment analysis
   * 
   * Counts positive and negative word occurrences and derives
   * a sentiment score from their ratio.
   */
  _keywordAnalyze(text) {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of words) {
      const clean = word.replace(/[^a-z]/g, '');
      if (POSITIVE_WORDS.includes(clean)) positiveCount++;
      if (NEGATIVE_WORDS.includes(clean)) negativeCount++;
    }
    
    const total = positiveCount + negativeCount;
    let score = 0.5; // neutral baseline
    
    if (total > 0) {
      score = positiveCount / total;
    }
    
    // Detect themes
    const themes = [];
    for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
      if (keywords.some(kw => lower.includes(kw))) {
        themes.push(theme);
      }
    }
    
    // Determine sentiment label
    let sentiment = 'NEUTRAL';
    if (score >= 0.6) sentiment = 'POSITIVE';
    else if (score <= 0.4) sentiment = 'NEGATIVE';
    
    // Generate summary
    const summary = sentiment === 'POSITIVE'
      ? `Positive feedback mentioning ${themes.length > 0 ? themes.join(', ') : 'general satisfaction'}.`
      : sentiment === 'NEGATIVE'
      ? `Negative feedback about ${themes.length > 0 ? themes.join(', ') : 'general dissatisfaction'}.`
      : `Neutral feedback${themes.length > 0 ? ' touching on ' + themes.join(', ') : ''}.`;
    
    return {
      sentiment,
      score: Math.round(score * 100) / 100,
      themes: themes.slice(0, 3),
      summary,
      methodology: 'keyword_based_analysis'
    };
  }
}

module.exports = new SentimentService();

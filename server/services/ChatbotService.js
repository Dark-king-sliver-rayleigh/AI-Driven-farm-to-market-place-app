const { GoogleGenerativeAI } = require('@google/generative-ai');
const MarketPrice = require('../models/MarketPrice');
const Product = require('../models/Product');

/**
 * ChatbotService
 * 
 * AI/ML TECHNIQUES USED:
 * 1. Large Language Model (LLM) — Google Gemini for natural language understanding
 *    and generation. The model processes farmer queries and generates contextual responses.
 * 2. Context Injection (RAG-like) — Before each query, we inject live platform data
 *    (market prices, available products, demand trends) into the system prompt,
 *    so the LLM's responses are grounded in real data rather than being generic.
 * 3. Conversational Memory — maintains per-session chat history (up to 10 turns)
 *    so the model can reference earlier parts of the conversation.
 * 4. Role-based Personalization — system prompt adapts based on user role
 *    (FARMER, CONSUMER, LOGISTICS) for more relevant responses.
 * 
 * FALLBACK: Returns pre-defined responses when Gemini API is unavailable.
 */

// In-memory session store (production would use Redis)
const sessionStore = new Map();
const MAX_HISTORY = 10; // Max conversation turns to keep
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

class ChatbotService {
  
  constructor() {
    this.geminiModel = null;
    this._initGemini();
    
    // Clean up expired sessions every 5 minutes
    setInterval(() => this._cleanupSessions(), 5 * 60 * 1000);
  }

  _initGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('[ChatbotService] Gemini AI initialized successfully');
      } catch (err) {
        console.warn('[ChatbotService] Failed to initialize Gemini:', err.message);
      }
    } else {
      console.warn('[ChatbotService] No GEMINI_API_KEY set, using fallback responses');
    }
  }

  /**
   * Process a user message and return an AI-generated response.
   * 
   * @param {Object} params
   * @param {string} params.message - User's message
   * @param {string} params.sessionId - Session identifier
   * @param {string} params.userRole - User's role (FARMER/CONSUMER/LOGISTICS)
   * @param {string} [params.userName] - User's name for personalization
   * @returns {Promise<Object>} AI response
   */
  async chat({ message, sessionId, userRole, userName }) {
    if (!message || !message.trim()) {
      return { reply: 'Please type a message to get started!', sessionId };
    }
    
    // Get or create session
    const session = this._getSession(sessionId);
    session.lastActive = Date.now();
    
    // Add user message to history
    session.history.push({ role: 'user', content: message });
    
    let reply;
    
    if (this.geminiModel) {
      try {
        reply = await this._geminiChat(message, session, userRole, userName);
      } catch (err) {
        console.warn('[ChatbotService] Gemini error:', err.message);
        reply = this._fallbackResponse(message, userRole);
      }
    } else {
      reply = this._fallbackResponse(message, userRole);
    }
    
    // Add assistant response to history
    session.history.push({ role: 'assistant', content: reply });
    
    // Trim history if too long
    if (session.history.length > MAX_HISTORY * 2) {
      session.history = session.history.slice(-MAX_HISTORY * 2);
    }
    
    // Save session
    sessionStore.set(session.id, session);
    
    return {
      reply,
      sessionId: session.id,
      methodology: this.geminiModel ? 'gemini_llm_with_context' : 'rule_based_fallback'
    };
  }

  /**
   * Gemini-powered chat with context injection
   */
  async _geminiChat(message, session, userRole, userName) {
    // Gather live platform context
    const platformContext = await this._gatherPlatformContext();
    
    const systemPrompt = `You are "AgroDirect AI", an intelligent farming assistant built into the AgroDirect Farm-to-Consumer marketplace platform. You help Indian farmers, consumers, and logistics partners.

CURRENT USER:
- Name: ${userName || 'User'}
- Role: ${userRole || 'FARMER'}

LIVE PLATFORM DATA:
${platformContext}

YOUR CAPABILITIES:
- Answer questions about crop pricing, market trends, and farming practices
- Explain platform features (ordering, delivery tracking, payments)
- Provide agricultural advice (seasonal crops, pest management, soil health)
- Help interpret market price data and demand forecasts
- Suggest optimal pricing strategies for farmers
- Guide consumers on seasonal produce availability

RULES:
1. Always be helpful, concise, and friendly
2. When discussing prices, reference the live platform data above
3. If unsure, say so honestly rather than fabricating data
4. Keep responses under 200 words unless the user asks for detail
5. Use ₹ for currency (Indian Rupees)
6. Be culturally appropriate for Indian farming context
7. If the question is completely unrelated to farming/agriculture/the platform, politely redirect`;

    // Build conversation history for Gemini
    const contents = [];
    
    // Add conversation history
    for (const msg of session.history) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }

    const chat = this.geminiModel.startChat({
      history: contents.slice(0, -1), // All except the last user message
      systemInstruction: systemPrompt,
    });

    const result = await chat.sendMessage(message);
    return result.response.text();
  }

  /**
   * Gather live platform data for context injection
   */
  async _gatherPlatformContext() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      
      // Recent market prices
      const recentPrices = await MarketPrice.aggregate([
        { $match: { date: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: '$commodity',
            avgPrice: { $avg: '$modalPrice' },
            minPrice: { $min: '$minPrice' },
            maxPrice: { $max: '$maxPrice' },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      
      // Available products count
      const productCount = await Product.countDocuments({ 
        isDeleted: false, 
        status: 'AVAILABLE' 
      });
      
      let context = `Available products on platform: ${productCount}\n`;
      
      if (recentPrices.length > 0) {
        context += 'Recent market prices (last 7 days):\n';
        for (const p of recentPrices) {
          context += `- ${p._id}: Avg ₹${Math.round(p.avgPrice)}/quintal (range: ₹${Math.round(p.minPrice)}-₹${Math.round(p.maxPrice)})\n`;
        }
      } else {
        context += 'Market price data is being collected from government sources.\n';
      }
      
      return context;
    } catch (err) {
      return 'Platform data temporarily unavailable.\n';
    }
  }

  /**
   * Fallback responses when Gemini is not available
   */
  _fallbackResponse(message, userRole) {
    const lower = message.toLowerCase();
    
    // Simple keyword matching
    if (lower.includes('price') || lower.includes('cost') || lower.includes('rate')) {
      return '📊 For current market prices, please check the **Price Insights** section in your dashboard. Our system pulls data from government mandi records daily. You can view trends, MSP floors, and AI-predicted prices for your crops. Note: AI price predictions use polynomial regression trained on historical data.';
    }
    
    if (lower.includes('demand') || lower.includes('forecast')) {
      return '📈 Demand forecasts are available in the **Demand Forecast** page. Our ML model uses feature-engineered regression on historical order data to predict future demand. Look for the confidence indicator (HIGH/MEDIUM/LOW) to gauge reliability.';
    }
    
    if (lower.includes('crop') || lower.includes('grow') || lower.includes('plant') || lower.includes('recommend')) {
      return '🌾 Check out the **Crop Recommendations** page for AI-powered suggestions! Our system analyzes current market prices, seasonal patterns, and demand trends to suggest the most profitable crops for your region.';
    }
    
    if (lower.includes('delivery') || lower.includes('track') || lower.includes('order')) {
      return '🚚 You can track your orders in real-time from the **Orders** page. Our system provides live GPS tracking, estimated arrival times, and route optimization for deliveries.';
    }
    
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('namaste')) {
      const greeting = userRole === 'FARMER' ? 'farmer' : userRole === 'CONSUMER' ? '' : 'partner';
      return `🙏 Namaste${greeting ? ', ' + greeting : ''}! I'm AgroDirect AI, your farming assistant. I can help you with market prices, crop recommendations, demand forecasts, and platform features. What would you like to know?`;
    }
    
    if (lower.includes('help') || lower.includes('what can you do')) {
      return `🤖 I'm AgroDirect AI! Here's what I can help with:\n\n• **Market Prices** — Current mandi rates and ML-predicted trends\n• **Crop Recommendations** — AI-powered suggestions based on your location and season\n• **Demand Forecasts** — ML-predicted demand for your products\n• **Farming Tips** — Seasonal advice and best practices\n• **Platform Help** — How to use orders, payments, and deliveries\n\nJust ask me anything!`;
    }
    
    return '🤖 I\'m AgroDirect AI, your farming assistant. I can help with market prices, crop recommendations, demand forecasts, and platform features. Could you please rephrase your question? For the best AI experience, please set up your Gemini API key in the server configuration.';
  }

  // Session management helpers
  _getSession(sessionId) {
    if (sessionId && sessionStore.has(sessionId)) {
      return sessionStore.get(sessionId);
    }
    
    const newId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = { id: newId, history: [], lastActive: Date.now() };
    sessionStore.set(newId, session);
    return session;
  }

  _cleanupSessions() {
    const now = Date.now();
    for (const [id, session] of sessionStore.entries()) {
      if (now - session.lastActive > SESSION_TTL_MS) {
        sessionStore.delete(id);
      }
    }
  }
}

module.exports = new ChatbotService();

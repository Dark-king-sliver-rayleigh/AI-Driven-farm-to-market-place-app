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
        this.geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        console.log('[ChatbotService] Gemini AI initialized (gemini-2.5-flash-lite, free tier)');
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
        reply = await this._geminiChatWithRetry(message, session, userRole, userName);
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
   * Retry wrapper for Gemini chat — retries on 429 rate-limit errors and network failures
   */
  async _geminiChatWithRetry(message, session, userRole, userName, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this._geminiChat(message, session, userRole, userName);
      } catch (err) {
        const is429 = err.message?.includes('429') || err.message?.includes('Too Many Requests') || err.message?.includes('quota');
        const isNetworkError = err.message?.includes('fetch fail') || err.message?.includes('network') || err.message?.includes('timeout') || err.message?.includes('ECONNRESET');
        
        if ((is429 || isNetworkError) && attempt < retries) {
          const delay = (attempt + 1) * 2000; // 2s, 4s, 6s
          console.log(`[ChatbotService] API error (${is429 ? 'Rate limited' : 'Network error'}), retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Gemini-powered chat with context injection
   */
  async _geminiChat(message, session, userRole, userName) {
    // Gather live platform context (pass user message for targeted commodity lookup)
    const platformContext = await this._gatherPlatformContext(message);
    
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
2. When discussing prices, ALWAYS use the "MARKET PRICE DATA" section below. NEVER say a commodity is not listed if it appears in the data.
3. When the user asks about a specific commodity, respond with EXACTLY this format:
   📊 **[Commodity Name]**
   • Price: ₹[price]/quintal
   • APMC/Mandi: [mandi name], [state]
   • Date: [date]
   Keep it to ONE price entry per commodity-mandi unless the user asks for more.
4. If unsure, say so honestly rather than fabricating data
5. Keep responses short and to the point — no extra commentary unless asked
6. Use ₹ for currency (Indian Rupees)
7. Be culturally appropriate for Indian farming context
8. If the question is completely unrelated to farming/agriculture/the platform, politely redirect`;

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
      systemInstruction: { parts: [{ text: systemPrompt }] },
    });

    const result = await chat.sendMessage(message);
    return result.response.text();
  }

  /**
   * Extract potential commodity names from a user message
   */
  _extractCommodityKeywords(message) {
    if (!message) return [];
    // Remove common filler words and return meaningful tokens (2+ chars)
    const stopWords = new Set(['what', 'is', 'the', 'price', 'of', 'for', 'how', 'much', 'does', 'cost',
      'tell', 'me', 'about', 'show', 'give', 'can', 'you', 'find', 'get', 'current',
      'rate', 'rates', 'prices', 'market', 'mandi', 'today', 'latest', 'average', 'in', 'at', 'a', 'an']);
    return message
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));
  }

  /**
   * Gather live platform data for context injection.
   * When a user message is provided, also does a targeted commodity lookup
   * so the LLM has precise data for the user's specific question.
   */
  async _gatherPlatformContext(userMessage) {
    try {
      // ------- 1. Dynamic date window with fallback -------
      // Try last 7 days first; if empty, use the most recent data available
      let dateFilter = new Date(Date.now() - 7 * 86400000);
      const recentCount = await MarketPrice.countDocuments({ date: { $gte: dateFilter } });
      if (recentCount === 0) {
        // Fall back to the most recent record date in the DB
        const latest = await MarketPrice.findOne().sort({ date: -1 }).select('date').lean();
        if (latest && latest.date) {
          // Use a 30-day window around the latest record
          dateFilter = new Date(latest.date.getTime() - 30 * 86400000);
        }
      }

      // ------- 2. Targeted commodity lookup from user message -------
      let targetedContext = '';
      const keywords = this._extractCommodityKeywords(userMessage);
      if (keywords.length > 0) {
        // Build a case-insensitive regex to match any keyword in commodity name
        const regex = new RegExp(keywords.join('|'), 'i');

        // Aggregate to get the LATEST single record per commodity+mandi (deduplicated)
        let matchedPrices = await MarketPrice.aggregate([
          { $match: { commodity: { $regex: regex }, date: { $gte: dateFilter } } },
          { $sort: { date: -1 } },
          {
            $group: {
              _id: { commodity: '$commodity', mandi: '$mandi' },
              commodity: { $first: '$commodity' },
              mandi: { $first: '$mandi' },
              state: { $first: '$state' },
              modalPrice: { $first: '$modalPrice' },
              minPrice: { $first: '$minPrice' },
              maxPrice: { $first: '$maxPrice' },
              date: { $first: '$date' }
            }
          },
          { $limit: 5 }
        ]);

        // Broader fallback without date filter
        if (matchedPrices.length === 0) {
          matchedPrices = await MarketPrice.aggregate([
            { $match: { commodity: { $regex: regex } } },
            { $sort: { date: -1 } },
            {
              $group: {
                _id: { commodity: '$commodity', mandi: '$mandi' },
                commodity: { $first: '$commodity' },
                mandi: { $first: '$mandi' },
                state: { $first: '$state' },
                modalPrice: { $first: '$modalPrice' },
                minPrice: { $first: '$minPrice' },
                maxPrice: { $first: '$maxPrice' },
                date: { $first: '$date' }
              }
            },
            { $limit: 5 }
          ]);
        }

        if (matchedPrices.length > 0) {
          targetedContext += '\n=== MARKET PRICE DATA ===\n';
          for (const p of matchedPrices) {
            targetedContext += `- ${p.commodity} | APMC/Mandi: ${p.mandi}, ${p.state} | Price: ₹${p.modalPrice}/quintal | Date: ${p.date?.toISOString?.() ? p.date.toISOString().slice(0, 10) : new Date(p.date).toISOString().slice(0, 10)}\n`;
          }
        }
      }

      // ------- 3. General top commodities summary (only when no targeted query) -------
      let generalContext = '';
      if (!targetedContext) {
        const recentPrices = await MarketPrice.aggregate([
          { $match: { date: { $gte: dateFilter } } },
          { $sort: { date: -1 } },
          {
            $group: {
              _id: '$commodity',
              mandi: { $first: '$mandi' },
              state: { $first: '$state' },
              modalPrice: { $first: '$modalPrice' },
              date: { $first: '$date' },
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]);

        if (recentPrices.length > 0) {
          generalContext += 'Top commodities on platform:\n';
          for (const p of recentPrices) {
            generalContext += `- ${p._id} | APMC/Mandi: ${p.mandi}, ${p.state} | ₹${Math.round(p.modalPrice)}/quintal | Date: ${p.date?.toISOString?.() ? p.date.toISOString().slice(0, 10) : new Date(p.date).toISOString().slice(0, 10)}\n`;
          }
        }
      }

      // Available products count
      const productCount = await Product.countDocuments({
        isDeleted: false,
        status: 'AVAILABLE'
      });

      let context = `Available products on platform: ${productCount}\n`;

      // Targeted results take priority; fall back to general summary
      if (targetedContext) {
        context += targetedContext;
      } else {
        context += generalContext || 'No market price records found in the database.\n';
      }

      return context;
    } catch (err) {
      console.error('[ChatbotService] _gatherPlatformContext error:', err.message);
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
      return '📊 For current market prices, please check the **Price Insights** section in your dashboard. Our system pulls data from government APMC/mandi records. You can view the latest modal price with the APMC/mandi location for any commodity.';
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

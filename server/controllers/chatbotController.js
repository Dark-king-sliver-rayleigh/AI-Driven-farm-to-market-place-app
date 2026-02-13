const ChatbotService = require('../services/ChatbotService');

/**
 * ChatbotController
 * Handles AI chatbot message requests
 */

// POST /api/chatbot/message
exports.sendMessage = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    const result = await ChatbotService.chat({
      message: message.trim(),
      sessionId: sessionId || undefined,
      userRole: req.user?.role || 'FARMER',
      userName: req.user?.name || 'User'
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[ChatbotController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      reply: 'Sorry, I encountered an error. Please try again.'
    });
  }
};

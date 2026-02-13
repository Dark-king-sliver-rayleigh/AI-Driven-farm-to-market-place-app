const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const chatbotController = require('../controllers/chatbotController');

// POST /api/chatbot/message
// Protected: All authenticated users can use the chatbot
router.post('/message', authenticateUser, chatbotController.sendMessage);

module.exports = router;

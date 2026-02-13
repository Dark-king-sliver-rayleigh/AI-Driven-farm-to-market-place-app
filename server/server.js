const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
const { requestLogger, errorLogger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/errorHandler');

// Request logging (before routes)
app.use(requestLogger);

// CORS & JSON parsing
// Allow multiple Vite dev server ports (5173-5179)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:5179'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Auth middleware
const { authenticateUser, authorizeRoles } = require('./middleware/auth');

// System routes (stats & health)
app.use('/system', require('./routes/stats'));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/farmer/products', require('./routes/products'));
app.use('/api/farmer', require('./routes/priceInsight'));  // Price Intelligence Module
app.use('/api', require('./routes/orders'));
app.use('/api/logistics', require('./routes/logistics'));
app.use('/api/logistics/tracking', require('./routes/tracking'));  // Real-time Tracking
app.use('/api/logistics/routes', require('./routes/routePlan'));   // Route Planning
app.use('/api/logistics/kpi', require('./routes/kpi'));            // Logistics KPIs
app.use('/api/payments', require('./routes/payments'));  // Mock UPI Payments
app.use('/api/notifications', require('./routes/notifications'));  // Notifications
app.use('/api/feedback', require('./routes/feedback'));  // Feedback & Ratings
app.use('/api/farmer', require('./routes/demandForecast'));  // Demand Forecasting
app.use('/api/location', require('./routes/location'));  // Location Management

// === AI Feature Routes ===
app.use('/api/crop-recommendation', require('./routes/cropRecommendation'));  // AI Crop Recommendations
app.use('/api/chatbot', require('./routes/chatbot'));  // AI Chatbot

// Dashboard routes (simple info endpoints)
app.get('/api/farmer/dashboard', 
  authenticateUser, 
  authorizeRoles('FARMER'), 
  (req, res) => {
    res.json({
      success: true,
      message: 'Welcome to Farmer Dashboard',
      user: req.user.name
    });
  }
);

app.get('/api/consumer/home', 
  authenticateUser, 
  authorizeRoles('CONSUMER'), 
  (req, res) => {
    res.json({
      success: true,
      message: 'Welcome to Consumer Home',
      user: req.user.name
    });
  }
);

app.get('/api/logistics/dashboard', 
  authenticateUser, 
  authorizeRoles('LOGISTICS'), 
  (req, res) => {
    res.json({
      success: true,
      message: 'Welcome to Logistics Dashboard',
      user: req.user.name
    });
  }
);

// Legacy health check (redirects to /system/health)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    }
  });
});

// Error logging (before error handler)
app.use(errorLogger);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Import price data scheduler
const priceDataScheduler = require('./utils/priceDataScheduler');

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`📊 Stats available at http://localhost:${PORT}/system/stats`);
  console.log(`💚 Health check at http://localhost:${PORT}/system/health\n`);
  
  // Start price data scheduler
  priceDataScheduler.start();
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  priceDataScheduler.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  priceDataScheduler.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});


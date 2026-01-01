/**
 * Request logging middleware
 * Logs method, route, status code, and response time
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString();
    const status = res.statusCode;
    const statusColor = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';
    
    console.log(
      `[${timestamp}] ${req.method.padEnd(6)} ${req.originalUrl.padEnd(40)} ${statusColor}${status}${reset} ${duration}ms`
    );
  });

  next();
};

/**
 * Error logging middleware (use after routes, before error handler)
 */
const errorLogger = (err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR in ${req.method} ${req.originalUrl}`);
  console.error(`  User: ${req.user ? req.user._id : 'anonymous'}`);
  console.error(`  Error: ${err.message}`);
  next(err);
};

module.exports = { requestLogger, errorLogger };

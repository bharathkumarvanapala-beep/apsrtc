/**
 * APSRTC SmartTrack Error Handling Middleware
 * Converts application exceptions into user-friendly, human-readable error responses.
 */

const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(`API Error: ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  const statusCode = err.statusCode || (err.message.includes('not found') ? 404 : 400);

  // Return clean, human-readable error messages without internal stack leak
  res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected error occurred. Please try again.',
    timestamp: new Date().toISOString()
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};

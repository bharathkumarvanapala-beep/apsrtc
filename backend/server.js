/**
 * APSRTC SmartTrack Server
 * Main application entrypoint: Express REST API, WebSockets, and Static Frontend host.
 * Andhra Pradesh State Road Transport Corporation
 */

const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config/config');
const logger = require('./utils/logger');
const { getDb, closeDb } = require('./config/db');
const registerSockets = require('./sockets/socketHandler');

// Route Imports
const busRoutes = require('./routes/busRoutes');
const journeyRoutes = require('./routes/journeyRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const tripRoutes = require('./routes/tripRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const operationsRoutes = require('./routes/operationsRoutes');

// Middleware Imports
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// 1. WebSocket Setup with Socket.IO
const io = new Server(server, {
  cors: {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PATCH']
  }
});
registerSockets(io);

// 2. Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.google.com", "https://*.googleapis.com", "https://*.gstatic.com", "https://*.basemaps.cartocdn.com", "https://*.tile.openstreetmap.org", "https://unpkg.com"],
      connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: config.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  credentials: true
}));

// Rate limiting for public APIs
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
app.use('/api/', apiLimiter);

// 3. Body Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Request Logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.originalUrl}`);
  next();
});

// 5. Health Endpoint
app.get('/health', (req, res) => {
  try {
    const db = getDb();
    const dbCheck = db.prepare('SELECT 1 as healthy').get();

    res.json({
      status: 'UP',
      service: 'APSRTC SmartTrack Fleet Management Service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbCheck && dbCheck.healthy === 1 ? 'CONNECTED (SQLite WAL)' : 'DEGRADED',
      environment: config.NODE_ENV,
      memoryUsage: process.memoryUsage()
    });
  } catch (err) {
    res.status(503).json({
      status: 'DOWN',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 6. REST API Endpoints (v1)
app.use('/api/v1/buses', busRoutes);
app.use('/api/v1/journey', journeyRoutes);
app.use('/api/v1/tracking', trackingRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/complaints', complaintRoutes);
app.use('/api/v1/operations', operationsRoutes);

// 7. Serve Static Frontend Files
const frontendPath = path.resolve(__dirname, '../frontend');
app.use(express.static(frontendPath));

// For root request, serve frontend/index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 8. 404 & Error Handling
app.use('/api/*', notFoundHandler);
app.use(errorHandler);

// 9. Server Listen & Graceful Shutdown
const PORT = config.PORT;

// Ensure database is initialized before listening
getDb();

if (require.main === module) {
  server.listen(PORT, () => {
    logger.info(`========================================================`);
    logger.info(`  APSRTC SmartTrack Server listening on port ${PORT}`);
    logger.info(`  Mode: ${config.NODE_ENV.toUpperCase()} | Demo Mode: ${config.DEMO_MODE}`);
    logger.info(`  Web App: http://localhost:${PORT}`);
    logger.info(`  Health:  http://localhost:${PORT}/health`);
    logger.info(`========================================================`);
  });
}

function handleShutdown(signal) {
  logger.info(`Received ${signal}. Gracefully shutting down APSRTC SmartTrack...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    closeDb();
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

module.exports = { app, server };

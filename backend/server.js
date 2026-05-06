require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------
// Global Middleware
// ---------------------
app.use(helmet());
app.use(cors());

// HTTP request logging via morgan → winston
app.use(morgan('short', {
  stream: { write: (msg) => logger.info(msg.trim(), { type: 'http' }) }
}));

app.use(express.json({ limit: '1mb' }));

// ---------------------
// Rate Limiting
// ---------------------

// Global: 200 requests per 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});
app.use(globalLimiter);

// Auth-specific: stricter limit to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' }
});
app.use('/auth', authLimiter);

// ---------------------
// Request ID Middleware
// ---------------------
let requestCounter = 0;
app.use((req, res, next) => {
  req.requestId = `req-${Date.now()}-${++requestCounter}`;
  next();
});

// ---------------------
// Health Check
// ---------------------
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Health check failed', { error: err.message });
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: err.message,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }
});

// ---------------------
// Mount Routes
// ---------------------
app.use('/auth', require('./routes/auth'));
app.use('/hospitals', require('./routes/hospitals'));
app.use('/rides', require('./routes/rides'));
app.use('/alerts', require('./routes/alerts'));
app.use('/officers', require('./routes/officers'));
app.use('/profile', require('./routes/profile'));
app.use('/admin', require('./routes/admin'));

// ---------------------
// 404 Handler
// ---------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---------------------
// Global Error Handler
// ---------------------
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl
  });
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------
// Graceful Shutdown
// ---------------------
const server = app.listen(PORT, () => {
  logger.info(`EMS Backend running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      await pool.end();
      logger.info('Database pool closed');
    } catch (err) {
      logger.error('Error closing database pool', { error: err.message });
    }
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;

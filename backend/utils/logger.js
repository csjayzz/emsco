const winston = require('winston');

/**
 * Structured logger for the EMS backend.
 *
 * - Development: colorized, human-readable output
 * - Production:  JSON-formatted for log aggregators (Datadog, CloudWatch, etc.)
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Ride started', { rideId, userId });
 *   logger.error('Database query failed', { error: err.message, stack: err.stack });
 */

const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'ems-backend' },
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    isProduction
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level}] ${message}${metaStr}`;
          })
        )
  ),
  transports: [
    new winston.transports.Console()
  ]
});

module.exports = logger;

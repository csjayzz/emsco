const pool = require('../db');
const logger = require('../utils/logger');

/**
 * GET /officers/active
 * Returns all active police users (for ambulance drivers to see).
 */
exports.getActive = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, badge_number, station
       FROM users
       WHERE role = 'police' AND is_active = true
       ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Get officers error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to fetch officers' });
  }
};

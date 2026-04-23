const pool = require('../db');
const logger = require('../utils/logger');

/**
 * GET /hospitals
 * Returns all active hospitals ordered by name.
 */
exports.getAll = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, lat, lng, address, phone, specializations,
              bed_count, trauma_level
       FROM hospitals
       WHERE is_active = true
       ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Get hospitals error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
};

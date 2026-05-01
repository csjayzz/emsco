const pool = require('../db');
const { firestore } = require('../services/firebaseAdmin');
const logger = require('../utils/logger');

/**
 * PATCH /alerts/:id/acknowledge
 * Police officer acknowledges an alert.
 */
exports.acknowledge = async (req, res) => {
  try {
    const { id } = req.params;

    // Find alert, validate officer ownership
    const alertResult = await pool.query('SELECT * FROM alerts WHERE id = $1', [id]);
    if (alertResult.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const alert = alertResult.rows[0];
    if (alert.officer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your alert' });
    }

    // Update PostgreSQL
    await pool.query(
      'UPDATE alerts SET acknowledged = true, acknowledged_at = NOW() WHERE id = $1',
      [id]
    );

    // Update Firestore alert document
    try {
      await firestore.collection('alerts').doc(id).update({
        acknowledged: true,
        acknowledgedAt: new Date()
      });
    } catch (fsErr) {
      // Firestore doc may not exist if it was created differently
      logger.error('Firestore alert update error', { error: fsErr.message, alertId: id });
    }

    res.json({ message: 'Alert acknowledged' });
  } catch (err) {
    logger.error('Acknowledge error', { error: err.message, stack: err.stack, alertId: req.params.id });
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
};

/**
 * GET /alerts/history
 * Paginated alert history for the police officer.
 */
exports.history = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT a.id, a.trigger_type, a.eta_at_trigger, a.tclear_seconds,
              a.alpha_value, a.speed_value, a.weather_value, a.drift_value,
              a.time_of_day_factor, a.distance_at_trigger,
              a.acknowledged, a.acknowledged_at, a.created_at,
              r.severity, r.case_type,
              h.name AS hospital_name,
              u.name AS ambulance_name
       FROM alerts a
       JOIN rides r ON r.id = a.ride_id
       JOIN hospitals h ON h.id = r.hospital_id
       JOIN users u ON u.id = r.ambulance_id
       WHERE a.officer_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM alerts WHERE officer_id = $1',
      [req.user.id]
    );

    res.json({
      alerts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    });
  } catch (err) {
    logger.error('Alert history error', { error: err.message, stack: err.stack, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch alert history' });
  }
};

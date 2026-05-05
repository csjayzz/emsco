const pool = require('../db');
const logger = require('../utils/logger');

/**
 * GET /profile
 * Returns user profile + role-specific aggregate stats.
 */
exports.get = async (req, res) => {
  try {
    // Fetch user (exclude password_hash)
    const userResult = await pool.query(
      `SELECT id, name, email, role, phone, bio, years_experience,
              profile_photo_url, vehicle_id, vehicle_type, license_plate,
              badge_number, station, jurisdiction, is_active, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    let stats = {};

    if (user.role === 'ambulance') {
      const statsResult = await pool.query(
        `SELECT
           COUNT(*) AS total_rides,
           COUNT(*) FILTER (WHERE status = 'completed') AS completed_rides,
           AVG(duration_minutes) AS avg_duration_minutes,
           COUNT(*) FILTER (WHERE severity = 'critical') AS critical_rides
         FROM rides WHERE ambulance_id = $1`,
        [req.user.id]
      );
      stats = statsResult.rows[0];
      // Convert string counts to numbers
      stats.total_rides = parseInt(stats.total_rides) || 0;
      stats.completed_rides = parseInt(stats.completed_rides) || 0;
      stats.avg_duration_minutes = stats.avg_duration_minutes ? parseFloat(stats.avg_duration_minutes).toFixed(1) : '0.0';
      stats.critical_rides = parseInt(stats.critical_rides) || 0;
    } else if (user.role === 'police') {
      const statsResult = await pool.query(
        `SELECT
           COUNT(*) AS total_alerts,
           COUNT(*) FILTER (WHERE acknowledged = true) AS acknowledged_alerts,
           AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60)
             FILTER (WHERE acknowledged = true) AS avg_response_minutes
         FROM alerts WHERE officer_id = $1`,
        [req.user.id]
      );
      stats = statsResult.rows[0];
      stats.total_alerts = parseInt(stats.total_alerts) || 0;
      stats.acknowledged_alerts = parseInt(stats.acknowledged_alerts) || 0;
      stats.avg_response_minutes = stats.avg_response_minutes ? parseFloat(stats.avg_response_minutes).toFixed(1) : '0.0';
      stats.acknowledgment_rate = stats.total_alerts > 0
        ? ((stats.acknowledged_alerts / stats.total_alerts) * 100).toFixed(1)
        : '0.0';
    }

    res.json({ user, stats });
  } catch (err) {
    logger.error('Get profile error', { error: err.message, stack: err.stack, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

/**
 * PATCH /profile
 * Update allowed profile fields dynamically.
 */
exports.update = async (req, res) => {
  try {
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRole = userResult.rows[0].role;

    // Allowed fields per role
    const sharedFields = ['name', 'phone', 'bio', 'years_experience'];
    const ambulanceFields = ['vehicle_id', 'vehicle_type', 'license_plate'];
    const policeFields = ['badge_number', 'station', 'jurisdiction'];

    let allowedFields = [...sharedFields];
    if (userRole === 'ambulance') allowedFields.push(...ambulanceFields);
    if (userRole === 'police') allowedFields.push(...policeFields);

    const updates = [];
    const values = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx}`);
        values.push(req.body[field]);
        idx++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);

    values.push(req.user.id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, name, email, role, phone, bio, years_experience,
                 profile_photo_url, vehicle_id, vehicle_type, license_plate,
                 badge_number, station, jurisdiction, created_at, updated_at`,
      values
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    logger.error('Update profile error', { error: err.message, stack: err.stack, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

/**
 * GET /profile/trips
 * Paginated ride history for ambulance users.
 */
exports.trips = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || 'completed';
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT r.id, r.severity, r.case_type, r.status, r.start_time, r.end_time,
              r.duration_minutes,
              h.name AS hospital_name,
              (SELECT COUNT(*) FROM alerts a WHERE a.ride_id = r.id) AS alert_count,
              EXISTS(SELECT 1 FROM pre_arrivals pa WHERE pa.ride_id = r.id) AS pre_arrival_sent
       FROM rides r
       JOIN hospitals h ON h.id = r.hospital_id
       WHERE r.ambulance_id = $1 AND r.status = $2
       ORDER BY r.start_time DESC
       LIMIT $3 OFFSET $4`,
      [req.user.id, status, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM rides WHERE ambulance_id = $1 AND status = $2',
      [req.user.id, status]
    );

    res.json({
      trips: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    });
  } catch (err) {
    logger.error('Profile trips error', { error: err.message, stack: err.stack, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
};

/**
 * GET /profile/alerts
 * Paginated alert history for police officers.
 */
exports.alerts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT a.id, a.trigger_type, a.eta_at_trigger, a.tclear_seconds,
              a.acknowledged, a.acknowledged_at, a.created_at,
              a.distance_at_trigger,
              r.severity, r.case_type,
              h.name AS hospital_name,
              u.name AS ambulance_name,
              CASE WHEN a.acknowledged_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (a.acknowledged_at - a.created_at)) / 60
                ELSE NULL
              END AS response_time_minutes
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
    logger.error('Profile alerts error', { error: err.message, stack: err.stack, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

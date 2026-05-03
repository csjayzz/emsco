const pool = require('../db');
const { firestore } = require('../services/firebaseAdmin');
const logger = require('../utils/logger');

/**
 * POST /rides/:id/pre-arrival
 * Transmit (or update) pre-arrival alert for a ride.
 */
exports.create = async (req, res) => {
  try {
    const rideId = req.params.id;
    const { emergency_type, severity, heart_rate, blood_pressure, spo2, treatments, notes } = req.body;

    // Validate ride belongs to user
    const rideResult = await pool.query(
      'SELECT id, ambulance_id FROM rides WHERE id = $1',
      [rideId]
    );
    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    if (rideResult.rows[0].ambulance_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your ride' });
    }

    // Validate heart_rate and spo2 ranges
    if (heart_rate !== undefined && (heart_rate < 20 || heart_rate > 300)) {
      return res.status(400).json({ error: 'heart_rate must be between 20 and 300' });
    }
    if (spo2 !== undefined && (spo2 < 50 || spo2 > 100)) {
      return res.status(400).json({ error: 'spo2 must be between 50 and 100' });
    }

    // Upsert into pre_arrivals (ON CONFLICT allows re-transmission)
    const result = await pool.query(
      `INSERT INTO pre_arrivals (ride_id, emergency_type, severity, heart_rate, blood_pressure, spo2, treatments, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (ride_id) DO UPDATE SET
         emergency_type = EXCLUDED.emergency_type,
         severity = EXCLUDED.severity,
         heart_rate = EXCLUDED.heart_rate,
         blood_pressure = EXCLUDED.blood_pressure,
         spo2 = EXCLUDED.spo2,
         treatments = EXCLUDED.treatments,
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING transmitted_at`,
      [rideId, emergency_type, severity, heart_rate || null, blood_pressure || null, spo2 || null, treatments || null, notes || null]
    );

    // Write to Firestore so hospital dashboards can listen
    await firestore.collection('preArrivals').doc(rideId).set({
      rideId,
      emergencyType: emergency_type,
      severity,
      heartRate: heart_rate,
      bloodPressure: blood_pressure,
      spo2,
      treatments: treatments || [],
      notes: notes || '',
      transmittedAt: new Date()
    });

    // Analytics event
    await pool.query(
      `INSERT INTO analytics_events (ride_id, user_id, event_type, meta)
       VALUES ($1, $2, 'pre_arrival_transmitted', $3)`,
      [rideId, req.user.id, JSON.stringify({ emergency_type, severity })]
    );

    res.json({
      message: 'Pre-arrival alert transmitted',
      transmittedAt: result.rows[0].transmitted_at
    });
  } catch (err) {
    logger.error('Pre-arrival create error', { error: err.message, stack: err.stack, rideId: req.params.id });
    res.status(500).json({ error: 'Failed to transmit pre-arrival alert' });
  }
};

/**
 * GET /rides/:id/pre-arrival
 * Returns the pre-arrival record for a ride.
 */
exports.get = async (req, res) => {
  try {
    const rideId = req.params.id;

    const result = await pool.query(
      'SELECT * FROM pre_arrivals WHERE ride_id = $1',
      [rideId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pre-arrival record found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Pre-arrival get error', { error: err.message, stack: err.stack, rideId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch pre-arrival record' });
  }
};

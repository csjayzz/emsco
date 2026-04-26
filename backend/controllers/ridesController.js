const pool = require('../db');
const { firestore } = require('../services/firebaseAdmin');
const geofenceService = require('../services/geofence');
const logger = require('../utils/logger');

/**
 * POST /rides — Start a new ride
 */
exports.create = async (req, res) => {
  try {
    const { hospital_id, severity, case_type } = req.body;

    // Validate hospital exists and is active
    const hospitalResult = await pool.query(
      'SELECT id, name, lat, lng FROM hospitals WHERE id = $1 AND is_active = true',
      [hospital_id]
    );
    if (hospitalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found or inactive' });
    }
    const hospital = hospitalResult.rows[0];

    // Validate severity
    if (!['critical', 'serious', 'stable'].includes(severity)) {
      return res.status(400).json({ error: 'severity must be critical, serious, or stable' });
    }

    // Validate case_type
    if (!['cardiac', 'trauma', 'stroke', 'respiratory', 'other'].includes(case_type)) {
      return res.status(400).json({ error: 'case_type must be cardiac, trauma, stroke, respiratory, or other' });
    }

    // Insert ride into PostgreSQL
    const rideResult = await pool.query(
      `INSERT INTO rides (ambulance_id, hospital_id, severity, case_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [req.user.id, hospital_id, severity, case_type]
    );
    const rideId = rideResult.rows[0].id;

    // Write to Firestore activeRides collection
    await firestore.collection('activeRides').doc(rideId).set({
      ambulanceId: req.user.id,
      ambulanceName: req.user.name,
      hospitalName: hospital.name,
      hospitalLat: parseFloat(hospital.lat),
      hospitalLng: parseFloat(hospital.lng),
      severity,
      caseType: case_type,
      status: 'active',
      startTime: new Date(),
      currentLat: null,
      currentLng: null,
      speed: 0
    });

    // Analytics event
    await pool.query(
      `INSERT INTO analytics_events (ride_id, user_id, event_type, meta)
       VALUES ($1, $2, 'ride_started', $3)`,
      [rideId, req.user.id, JSON.stringify({ hospital: hospital.name, severity, case_type })]
    );

    res.status(201).json({
      rideId,
      hospitalName: hospital.name,
      hospitalLat: parseFloat(hospital.lat),
      hospitalLng: parseFloat(hospital.lng),
      severity,
      caseType: case_type
    });
  } catch (err) {
    logger.error('Create ride error', { error: err.message, stack: err.stack, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to start ride' });
  }
};

/**
 * PATCH /rides/:id/location — Update ride location (hot path, every 5s)
 */
exports.updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng, speed, eta_minutes, congestion_alpha, weather } = req.body;

    // Input sanitization: validate lat/lng bounds
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid coordinates: lat must be [-90,90], lng must be [-180,180]' });
    }

    // Validate ride exists, belongs to user, and is active
    const rideResult = await pool.query(
      'SELECT id, ambulance_id, status FROM rides WHERE id = $1',
      [id]
    );
    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    const ride = rideResult.rows[0];
    if (ride.ambulance_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your ride' });
    }
    if (ride.status !== 'active') {
      return res.status(400).json({ error: 'Ride is not active' });
    }

    // Insert location record
    await pool.query(
      `INSERT INTO ride_locations (ride_id, lat, lng, speed, eta_minutes, alpha)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, lat, lng, speed || 0, eta_minutes || null, congestion_alpha || null]
    );

    // Update Firestore activeRides document
    await firestore.collection('activeRides').doc(id).update({
      currentLat: lat,
      currentLng: lng,
      speed: speed || 0,
      lastUpdated: new Date()
    });

    // Run geofence checks (non-blocking — we don't await to keep the hot path fast)
    geofenceService.checkAlerts(id, {
      etaMinutes: eta_minutes,
      lat,
      lng,
      speed: speed || 0,
      congestionAlpha: congestion_alpha,
      weather,
      ambulanceId: req.user.id,
      ambulanceName: req.user.name
    }).catch(err => logger.error('Geofence check error', {
      error: err.message,
      stack: err.stack,
      rideId: id,
      lat,
      lng
    }));

    res.json({ received: true });
  } catch (err) {
    logger.error('Update location error', { error: err.message, stack: err.stack, rideId: req.params.id });
    res.status(500).json({ error: 'Failed to update location' });
  }
};

/**
 * PATCH /rides/:id/end — End an active ride
 */
exports.endRide = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ride belongs to user
    const rideResult = await pool.query(
      'SELECT id, ambulance_id FROM rides WHERE id = $1',
      [id]
    );
    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    if (rideResult.rows[0].ambulance_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your ride' });
    }

    // Update ride in PostgreSQL
    await pool.query(
      `UPDATE rides SET status = 'completed', end_time = NOW() WHERE id = $1`,
      [id]
    );

    // Update Firestore
    await firestore.collection('activeRides').doc(id).update({
      status: 'completed',
      endTime: new Date()
    });

    // Close active alerts for this ride
    await pool.query(
      `UPDATE alerts SET acknowledged = true WHERE ride_id = $1 AND acknowledged = false`,
      [id]
    );

    // Resolve matching Firestore alert documents so police clients stop
    // showing them immediately when the ride ends.
    try {
      const alertsSnapshot = await firestore
        .collection('alerts')
        .where('rideId', '==', id)
        .get();

      if (!alertsSnapshot.empty) {
        const batch = firestore.batch();
        alertsSnapshot.forEach((alertDoc) => {
          batch.update(alertDoc.ref, {
            acknowledged: true,
            acknowledgedAt: new Date(),
            resolved: true,
            resolvedAt: new Date(),
          });
        });
        await batch.commit();
      }
    } catch (firestoreErr) {
      logger.error('Firestore alert resolution error', { error: firestoreErr.message, rideId: id });
    }

    // Analytics event
    await pool.query(
      `INSERT INTO analytics_events (ride_id, user_id, event_type)
       VALUES ($1, $2, 'ride_completed')`,
      [id, req.user.id]
    );

    // Clear in-memory geofence state for this ride
    geofenceService.clearRideState(id);

    res.json({ message: 'Ride ended' });
  } catch (err) {
    logger.error('End ride error', { error: err.message, stack: err.stack, rideId: req.params.id });
    res.status(500).json({ error: 'Failed to end ride' });
  }
};

/**
 * GET /rides/history — Paginated completed rides for the ambulance user
 */
exports.history = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT r.id, r.severity, r.case_type, r.status, r.start_time, r.end_time,
              r.duration_minutes,
              h.name AS hospital_name,
              (SELECT COUNT(*) FROM alerts a WHERE a.ride_id = r.id) AS alert_count,
              EXISTS(SELECT 1 FROM pre_arrivals pa WHERE pa.ride_id = r.id) AS pre_arrival_sent
       FROM rides r
       JOIN hospitals h ON h.id = r.hospital_id
       WHERE r.ambulance_id = $1 AND r.status = 'completed'
       ORDER BY r.start_time DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM rides WHERE ambulance_id = $1 AND status = 'completed'`,
      [req.user.id]
    );

    res.json({
      rides: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    });
  } catch (err) {
    logger.error('Ride history error', { error: err.message, stack: err.stack, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch ride history' });
  }
};

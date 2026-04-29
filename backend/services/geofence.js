const pool = require('../db');
const { firestore, messaging } = require('./firebaseAdmin');
const logger = require('../utils/logger');

// =====================================================================
// In-memory state (per-ride, cleared when ride ends)
// =====================================================================
const speedHistory      = new Map(); // rideId → number[]
const previousEta       = new Map(); // rideId+officerId → number (seconds)
const distressSent      = new Map(); // rideId → boolean
const hospitalAlertSent = new Map(); // rideId → boolean

// =====================================================================
// Haversine distance — returns metres
// =====================================================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// =====================================================================
// Algorithm 1 helpers
// =====================================================================

/**
 * Preparation-time lookup table (returns seconds).
 * Critical + case-specific, Serious + any, Stable + any.
 */
function getPreparationTime(severity, caseType) {
  if (severity === 'critical') {
    switch (caseType) {
      case 'cardiac':      return 600;  // 10 min
      case 'trauma':       return 480;  //  8 min
      case 'stroke':       return 540;  //  9 min
      case 'respiratory':  return 420;  //  7 min
      default:             return 480;  //  8 min fallback for 'other'
    }
  }
  if (severity === 'serious') return 360; // 6 min
  return 240; // stable — 4 min
}

// =====================================================================
// Algorithm 2 helpers
// =====================================================================

/** Day/night factor: 1.0 during daytime (06:00–21:59), 0.0 at night */
function dayNightFactor(hour) {
  return hour >= 6 && hour < 22 ? 1.0 : 0.0;
}

/**
 * Adaptive dynamic clearance time T_clear.
 * Combines five normalised inputs into a weighted sum, capped at 360 s.
 */
function adaptiveTclear(alpha, speed, weather, drift, hour) {
  const fa = Math.min(1, (alpha - 1) / 1.5);
  const gv = Math.max(0, 1 - speed / 40);
  const hd = Math.min(1, Math.max(0, drift / 120));
  const n  = dayNightFactor(hour);
  return Math.min(150 + 60 * fa + 45 * gv + 40 * weather + 30 * hd + 20 * n, 360);
}

// =====================================================================
// Main geofence check — called on every location update
// =====================================================================
async function checkAlerts(rideId, params) {
  const { etaMinutes, lat, lng, speed, congestionAlpha, weather, ambulanceId, ambulanceName } = params;

  // 1. Fetch ride + hospital from PostgreSQL
  const rideResult = await pool.query(
    `SELECT r.*, h.name AS hospital_name, h.lat AS hospital_lat, h.lng AS hospital_lng
     FROM rides r
     JOIN hospitals h ON h.id = r.hospital_id
     WHERE r.id = $1`,
    [rideId]
  );
  if (rideResult.rows.length === 0) return;
  const ride = rideResult.rows[0];

  // 2. Fetch active police officers from Firestore policeLocations
  const policeSnapshot = await firestore
    .collection('policeLocations')
    .where('status', '==', 'active')
    .get();

  const activeOfficers = [];
  policeSnapshot.forEach((doc) => {
    const data = doc.data();
    activeOfficers.push({
      id: doc.id,
      ...data,
      lat: Number(data.lat),
      lng: Number(data.lng)
    });
  });

  logger.info('Geofence check', { rideId, officerCount: activeOfficers.length, etaMinutes, lat, lng });

  if (activeOfficers.length === 0) {
    logger.info('No active officers found', { rideId });
  }

  const hour = new Date().getHours();
  const etaSeconds = (etaMinutes || 0) * 60;

  // ------------------------------------------------------------------
  // ALGORITHM 1 — Hospital Pre-Alert
  // ------------------------------------------------------------------
  const tPrepare = getPreparationTime(ride.severity, ride.case_type);

  if (!hospitalAlertSent.get(rideId) && etaSeconds > 0 && etaSeconds <= tPrepare + 60) {
    // Write analytics event for the hospital alert
    await pool.query(
      `INSERT INTO analytics_events (ride_id, user_id, event_type, meta)
       VALUES ($1, $2, 'hospital_alert', $3)`,
      [
        rideId,
        ambulanceId,
        JSON.stringify({
          severity: ride.severity,
          caseType: ride.case_type,
          etaMinutes,
          tPrepareMinutes: tPrepare / 60
        })
      ]
    );

    // Write to Firestore hospitalAlerts collection
    await firestore.collection('hospitalAlerts').doc(rideId).set({
      rideId,
      severity: ride.severity,
      caseType: ride.case_type,
      etaMinutes,
      tPrepareMinutes: tPrepare / 60,
      triggeredAt: new Date()
    });

    hospitalAlertSent.set(rideId, true);
    logger.info('Hospital pre-alert sent', { rideId, severity: ride.severity, caseType: ride.case_type, etaMinutes });
  }

  // ------------------------------------------------------------------
  // ALGORITHM 2 — Adaptive Police Alerts
  // ------------------------------------------------------------------
  for (const officer of activeOfficers) {
    // a. Check if alert already sent for this ride+officer
    const existingAlert = await pool.query(
      'SELECT id FROM alerts WHERE ride_id = $1 AND officer_id = $2 LIMIT 1',
      [rideId, officer.id]
    );
    if (existingAlert.rows.length > 0) continue;

    // b. Compute drift (change in ETA)
    const etaKey = rideId + officer.id;
    const prev = previousEta.get(etaKey) || etaSeconds;
    const drift = etaSeconds - prev;
    previousEta.set(etaKey, etaSeconds);

    // c. Derive alpha (congestion ratio)
    const alpha = congestionAlpha || (etaMinutes < 2 ? 2.0 : etaMinutes < 5 ? 1.5 : 1.2);

    // d. Weather — default 0.2
    const weatherVal = weather || 0.2;
    const dist = calculateDistance(lat, lng, officer.lat, officer.lng);
    const isNearbyOfficer = dist <= 1000;

    if (Number.isFinite(dist) && dist <= 2000) {
      logger.debug('Officer proximity check', { rideId, officerId: officer.id, distance: Math.round(dist), nearby: isNearbyOfficer, etaSeconds: Math.round(etaSeconds) });
    }

    if (etaSeconds > 0) {
      // ETA-based adaptive alert
      const tClear = adaptiveTclear(alpha, speed, weatherVal, drift, hour);

      if (etaSeconds <= tClear + 60 || isNearbyOfficer) {
        logger.info('Triggering officer alert', {
          rideId,
          officerId: officer.id,
          reason: isNearbyOfficer && etaSeconds > tClear + 60 ? 'fallback_distance' : 'adaptive_eta',
          tClear: Math.round(tClear),
          etaSeconds: Math.round(etaSeconds)
        });
        const n = dayNightFactor(hour);
        await triggerPoliceAlert(
          rideId, officer, ride, params,
          tClear, alpha, speed, weatherVal, drift, n,
          isNearbyOfficer && etaSeconds > tClear + 60 ? 'fallback_distance' : 'adaptive_eta',
          etaSeconds
        );
      }
    } else {
      // Fallback: no ETA — use distance
      if (isNearbyOfficer) {
        const n = dayNightFactor(hour);
        await triggerPoliceAlert(
          rideId, officer, ride, params,
          0, 0, speed, 0, 0, n,
          'fallback_distance', 0
        );
      }
    }
  }

  // ------------------------------------------------------------------
  // ALGORITHM 3 — Distress Detection
  // ------------------------------------------------------------------
  const buf = speedHistory.get(rideId) || [];
  buf.push(speed);
  if (buf.length > 18) buf.shift();
  speedHistory.set(rideId, buf);

  if (
    buf.length >= 18 &&
    mean(buf) < 5 &&
    ride.severity === 'critical' &&
    !distressSent.get(rideId)
  ) {
    // Write CRITICAL_PRIORITY alert to Firestore
    await firestore.collection('alerts').add({
      rideId,
      type: 'CRITICAL_PRIORITY',
      ambulanceId,
      ambulanceName,
      severity: ride.severity,
      caseType: ride.case_type,
      message: 'Ambulance possibly in distress — sustained low speed on critical ride',
      acknowledged: false,
      createdAt: new Date()
    });

    // Analytics event
    await pool.query(
      `INSERT INTO analytics_events (ride_id, user_id, event_type, meta)
       VALUES ($1, $2, 'distress_detected', $3)`,
      [
        rideId,
        ambulanceId,
        JSON.stringify({ meanSpeed: mean(buf), bufferLength: buf.length })
      ]
    );

    distressSent.set(rideId, true);
    logger.warn('Distress detected', { rideId, meanSpeed: mean(buf).toFixed(1), bufferLength: buf.length });
  }
}

// =====================================================================
// Trigger a police alert (shared by adaptive + fallback)
// =====================================================================
async function triggerPoliceAlert(rideId, officer, ride, params, tClear, alpha, speed, weather, drift, n, triggerType, etaSeconds) {
  const dist = calculateDistance(params.lat, params.lng, officer.lat, officer.lng);

  // 1. Insert into PostgreSQL alerts
  const alertResult = await pool.query(
    `INSERT INTO alerts
       (ride_id, officer_id, alert_target, trigger_type, eta_at_trigger, tclear_seconds,
        alpha_value, speed_value, weather_value, drift_value, time_of_day_factor, distance_at_trigger)
     VALUES ($1, $2, 'officer', $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      rideId, officer.id, triggerType,
      etaSeconds > 0 ? etaSeconds / 60 : null,
      tClear, alpha, speed, weather, drift, n,
      Math.round(dist)
    ]
  );
  const alertId = alertResult.rows[0].id;

  // 2. Write to Firestore alerts collection
  await firestore.collection('alerts').doc(alertId).set({
    id: alertId,
    rideId,
    officerId: officer.id,
    ambulanceId: params.ambulanceId,
    ambulanceName: params.ambulanceName,
    severity: ride.severity,
    caseType: ride.case_type,
    distance: Math.round(dist),
    etaMinutes: params.etaMinutes,
    triggerType,
    acknowledged: false,
    createdAt: new Date()
  });

  // 3. Send FCM notification if the officer has an fcmToken
  if (officer.fcmToken) {
    try {
      await messaging.send({
        token: officer.fcmToken,
        notification: {
          title: 'Ambulance Alert',
          body: `${ride.severity.toUpperCase()} ${ride.case_type} — ${Math.round(params.etaMinutes || 0)} min ETA`
        },
        data: { alertId, rideId }
      });
    } catch (fcmErr) {
      // FCM errors (invalid token, etc.) should not break the alert flow
      logger.error('FCM send error', { error: fcmErr.message, officerId: officer.id, rideId });
    }
  }

  // 4. Analytics event
  await pool.query(
    `INSERT INTO analytics_events (ride_id, user_id, event_type, meta)
     VALUES ($1, $2, 'police_alert_triggered', $3)`,
    [
      rideId,
      params.ambulanceId,
      JSON.stringify({ officerId: officer.id, triggerType, tClear, distance: Math.round(dist) })
    ]
  );

  logger.info('Police alert sent', { officerId: officer.id, officerName: officer.officerName, rideId, triggerType });
}

// =====================================================================
// Utility: arithmetic mean
// =====================================================================
function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

// =====================================================================
// Cleanup — called when a ride ends
// =====================================================================
function clearRideState(rideId) {
  speedHistory.delete(rideId);
  distressSent.delete(rideId);
  hospitalAlertSent.delete(rideId);

  // Clear all previousEta entries that start with this rideId
  for (const key of previousEta.keys()) {
    if (key.startsWith(rideId)) {
      previousEta.delete(key);
    }
  }
}

module.exports = {
  checkAlerts,
  clearRideState,
  // Exported for testing
  calculateDistance,
  getPreparationTime,
  adaptiveTclear,
  dayNightFactor
};

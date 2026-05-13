/**
 * Unit tests for the geofencing algorithms.
 *
 * The pure math functions (calculateDistance, getPreparationTime,
 * adaptiveTclear, dayNightFactor) are exported from the main geofence
 * module. However, that module also imports firebaseAdmin which
 * requires valid credentials at import time.
 *
 * To keep these tests dependency-free, we mock the Firebase and DB
 * imports before requiring the module under test.
 */

// Mock external dependencies so the geofence module loads without
// Firebase credentials or a database connection.
jest.mock('../services/firebaseAdmin', () => ({
  firestore: { collection: jest.fn() },
  messaging: { send: jest.fn() }
}));

jest.mock('../db', () => ({
  query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const {
  calculateDistance,
  getPreparationTime,
  adaptiveTclear,
  dayNightFactor
} = require('../services/geofence');

// =====================================================================
// Algorithm helpers — calculateDistance (Haversine)
// =====================================================================
describe('calculateDistance (Haversine)', () => {
  test('returns 0 for identical points', () => {
    const d = calculateDistance(21.1458, 79.0882, 21.1458, 79.0882);
    expect(d).toBeCloseTo(0, 0);
  });

  test('calculates ~500m for nearby Nagpur points', () => {
    // GMCH Nagpur to a point ~500m north
    const d = calculateDistance(21.1458, 79.0882, 21.1503, 79.0882);
    expect(d).toBeGreaterThan(400);
    expect(d).toBeLessThan(600);
  });

  test('calculates ~6km between two Nagpur hospitals', () => {
    // GMCH Nagpur → Lata Mangeshkar Hospital
    const d = calculateDistance(21.1458, 79.0882, 21.0924, 79.0622);
    expect(d).toBeGreaterThan(5000);
    expect(d).toBeLessThan(7000);
  });

  test('handles antipodal points (~20,000 km)', () => {
    const d = calculateDistance(0, 0, 0, 180);
    expect(d).toBeGreaterThan(20000000);
    expect(d).toBeLessThan(20100000);
  });

  test('handles negative coordinates', () => {
    const d = calculateDistance(-33.8688, 151.2093, -34.0522, 151.2437);
    // Sydney harbour to a point ~21km south
    expect(d).toBeGreaterThan(15000);
    expect(d).toBeLessThan(25000);
  });
});

// =====================================================================
// Algorithm 1 — getPreparationTime
// =====================================================================
describe('getPreparationTime', () => {
  test('critical cardiac → 600s (10 min)', () => {
    expect(getPreparationTime('critical', 'cardiac')).toBe(600);
  });

  test('critical trauma → 480s (8 min)', () => {
    expect(getPreparationTime('critical', 'trauma')).toBe(480);
  });

  test('critical stroke → 540s (9 min)', () => {
    expect(getPreparationTime('critical', 'stroke')).toBe(540);
  });

  test('critical respiratory → 420s (7 min)', () => {
    expect(getPreparationTime('critical', 'respiratory')).toBe(420);
  });

  test('critical other → 480s (8 min fallback)', () => {
    expect(getPreparationTime('critical', 'other')).toBe(480);
  });

  test('serious (any case) → 360s (6 min)', () => {
    expect(getPreparationTime('serious', 'cardiac')).toBe(360);
    expect(getPreparationTime('serious', 'trauma')).toBe(360);
    expect(getPreparationTime('serious', 'stroke')).toBe(360);
  });

  test('stable (any case) → 240s (4 min)', () => {
    expect(getPreparationTime('stable', 'cardiac')).toBe(240);
    expect(getPreparationTime('stable', 'respiratory')).toBe(240);
  });
});

// =====================================================================
// Algorithm 2 — dayNightFactor
// =====================================================================
describe('dayNightFactor', () => {
  test('daytime hours (6-21) return 1.0', () => {
    expect(dayNightFactor(6)).toBe(1.0);
    expect(dayNightFactor(12)).toBe(1.0);
    expect(dayNightFactor(18)).toBe(1.0);
    expect(dayNightFactor(21)).toBe(1.0);
  });

  test('nighttime hours (22-5) return 0.0', () => {
    expect(dayNightFactor(22)).toBe(0.0);
    expect(dayNightFactor(0)).toBe(0.0);
    expect(dayNightFactor(3)).toBe(0.0);
    expect(dayNightFactor(5)).toBe(0.0);
  });

  test('boundary: hour 6 is day, hour 5 is night', () => {
    expect(dayNightFactor(5)).toBe(0.0);
    expect(dayNightFactor(6)).toBe(1.0);
  });
});

// =====================================================================
// Algorithm 2 — adaptiveTclear
// =====================================================================
describe('adaptiveTclear', () => {
  test('minimum baseline is 150s', () => {
    // All factors at zero: alpha=1 (fa=0), speed=40+ (gv=0), weather=0, drift=0, night
    const t = adaptiveTclear(1, 50, 0, 0, 23);
    expect(t).toBe(150);
  });

  test('caps at 360s maximum', () => {
    // All factors maxed out
    const t = adaptiveTclear(3.0, 0, 1.0, 200, 12);
    expect(t).toBeLessThanOrEqual(360);
  });

  test('higher congestion alpha → longer clearance time', () => {
    const t1 = adaptiveTclear(1.0, 20, 0.2, 0, 12);
    const t2 = adaptiveTclear(2.5, 20, 0.2, 0, 12);
    expect(t2).toBeGreaterThan(t1);
  });

  test('lower speed → longer clearance time', () => {
    const t1 = adaptiveTclear(1.5, 30, 0.2, 0, 12);
    const t2 = adaptiveTclear(1.5, 5, 0.2, 0, 12);
    expect(t2).toBeGreaterThan(t1);
  });

  test('bad weather → longer clearance time', () => {
    const t1 = adaptiveTclear(1.5, 20, 0.0, 0, 12);
    const t2 = adaptiveTclear(1.5, 20, 1.0, 0, 12);
    expect(t2).toBeGreaterThan(t1);
  });

  test('ETA drift → longer clearance time', () => {
    const t1 = adaptiveTclear(1.5, 20, 0.2, 0, 12);
    const t2 = adaptiveTclear(1.5, 20, 0.2, 120, 12);
    expect(t2).toBeGreaterThan(t1);
  });

  test('daytime includes time factor bonus', () => {
    const tDay = adaptiveTclear(1.5, 20, 0.2, 0, 12);
    const tNight = adaptiveTclear(1.5, 20, 0.2, 0, 23);
    expect(tDay).toBeGreaterThan(tNight);
  });

  test('returns a number for typical values', () => {
    const t = adaptiveTclear(1.5, 25, 0.3, 30, 14);
    expect(typeof t).toBe('number');
    expect(t).toBeGreaterThanOrEqual(150);
    expect(t).toBeLessThanOrEqual(360);
  });
});

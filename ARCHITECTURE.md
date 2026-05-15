# Architecture Deep Dive

## Hybrid Database Design

### Why Two Databases?

EMS coordination has two fundamentally different data access patterns:

1. **Real-time streaming** — Police officers need to see ambulance positions update every second. Ambulance drivers need to see police officers on their map. Alerts must arrive instantly.

2. **Persistent analytics** — Trip history, response time metrics, alert acknowledgment rates, and audit trails need SQL-level querying with transactional guarantees.

Using a single database for both would force a compromise. Firestore excels at real-time fan-out (all connected clients see changes within ~200ms) but is weak at complex queries. PostgreSQL excels at relational queries and transactional integrity but can't push real-time updates to web clients natively.

### Data Flow

```
Ambulance starts ride
       │
       ▼
   POST /rides ──── PostgreSQL: INSERT ride record
       │
       └────────── Firestore: CREATE activeRides/{rideId}
                     (all connected police clients see it instantly)

Ambulance sends location update
       │
       ▼
   PATCH /rides/:id/location
       │
       ├── PostgreSQL: INSERT ride_locations (append-only log)
       │
       ├── Firestore: UPDATE activeRides/{rideId}.currentLat/Lng
       │    (police map updates in <200ms)
       │
       └── geofence.checkAlerts() ─── async, non-blocking
              │
              ├── Calculate distance to each active police officer
              ├── Compute adaptive T_clear
              ├── If ETA < T_clear: trigger alert
              │      │
              │      ├── PostgreSQL: INSERT police_alerts
              │      ├── Firestore: CREATE alerts/{alertId}
              │      └── FCM: push notification to officer's device
              │
              └── Check distress (speed buffer analysis)
```

### Consistency Model

The system uses **eventual consistency** between PostgreSQL and Firestore:
- PostgreSQL is the **source of truth** for all business data
- Firestore is a **derived view** optimized for real-time delivery
- If Firestore write fails, the PostgreSQL record still exists (graceful degradation)
- Firestore documents are cleaned up when rides end

---

## Geofencing Algorithms

### Algorithm 1: Adaptive Traffic Clearance Time (T_clear)

The core innovation. Instead of using a fixed "alert when X meters away" approach, T_clear dynamically adjusts based on five real-time factors:

```
T_clear = T_base + w_α·f_α + w_v·g_v + w_w·w + w_d·d_drift + w_n·n
```

**Baseline**: `T_base = 150 seconds` (minimum time for an officer to clear an intersection)

**Factor 1: Congestion (f_α)**
- Source: Google Maps traffic layer alpha value (1.0 = free flow, 3.0+ = heavy congestion)
- Transform: `f_α = clamp(alpha - 1, 0, 2)`
- Weight: `w_α = 40`
- Effect: Heavy congestion adds up to 80 seconds of lead time

**Factor 2: Speed Gradient (g_v)**
- Source: Current ambulance speed (km/h)
- Transform: `g_v = clamp((40 - speed) / 40, 0, 1)`
- Weight: `w_v = 30`
- Effect: Very slow ambulance (<5 km/h) gets full 30s bonus; fast ambulance (>40 km/h) gets none

**Factor 3: Weather (w)**
- Source: Client-reported weather severity (0.0 = clear, 1.0 = severe)
- Weight: `w_w = 25`
- Effect: Bad weather adds up to 25 seconds

**Factor 4: ETA Drift (d_drift)**
- Source: Difference between current ETA and previous ETA
- Transform: `d_drift = clamp(abs(etaDrift) / 120, 0, 1)`
- Weight: `w_d = 15`
- Effect: Unstable ETA (fluctuating by >2 minutes) adds up to 15 seconds

**Factor 5: Day/Night Factor (n)**
- Source: Current hour
- Transform: `n = 1.0 if 6:00-21:59, else 0.0`
- Weight: `w_n = 20`
- Effect: Daytime adds 20 seconds (more traffic to clear during the day)

**Clamping**: Final T_clear is clamped to `[150s, 360s]` (2.5 to 6 minutes)

### Algorithm 2: Hospital Preparation Time

A static lookup table that maps `(severity, case_type)` to the preparation time a hospital needs before the ambulance arrives. This determines when to send the hospital pre-alert:

```javascript
const PREP_TABLE = {
  critical: { cardiac: 600, trauma: 480, stroke: 540, respiratory: 420, default: 480 },
  serious:  { default: 360 },
  stable:   { default: 240 }
};
```

**Rationale**: Cardiac arrest requires catheterization lab activation (10 min). Trauma requires surgical team assembly (8 min). Stroke requires CT scanner preparation (9 min).

### Algorithm 3: Distress Detection

Monitors a rolling buffer of the last N speed readings:

1. Each location update appends the speed to a per-ride buffer
2. When the buffer has ≥ 10 readings, calculate the mean
3. If mean speed < 5 km/h, the ambulance may be stuck or in distress
4. Trigger distress alert to all nearby officers
5. Only fires once per ride (flag-based deduplication)

---

## Authentication & Authorization

### Flow

```
Register/Login → bcrypt hash → PostgreSQL users → JWT signed → Client stores in localStorage
                                                                        │
                                                                        ▼
Each API request → Authorization header → auth middleware → jwt.verify → req.user
                                                                            │
                                                                            ▼
                                                          role middleware → check req.user.role
```

### Role System

| Role | Capabilities |
|------|-------------|
| `ambulance` | Start/end rides, update location, send pre-arrival alerts, view own trips |
| `police` | Receive alerts, acknowledge, track ambulances, view own alert history |
| `admin` | Manage hospitals (CRUD), cannot be created via API |

### Security Decisions

1. **Admin accounts cannot be created via the public API** — prevents privilege escalation
2. **Login error messages are intentionally vague** ("Invalid credentials") — prevents email enumeration
3. **Rate limiting on auth routes** (20 req/15min) — prevents brute force attacks
4. **JWT has 24h expiry** — balances security with user convenience for field workers

---

## Structured Logging

All backend logging uses Winston with contextual metadata:

```javascript
// Development output (colorized, human-readable)
2024-01-15 14:30:22 [info] Geofence check {"rideId":42,"officerCount":3,"etaMinutes":4.2}
2024-01-15 14:30:22 [info] Triggering officer alert {"rideId":42,"officerId":7,"reason":"adaptive_eta","tClear":195}

// Production output (JSON for log aggregators)
{"timestamp":"2024-01-15T14:30:22","level":"info","message":"Geofence check","service":"ems-backend","rideId":42,"officerCount":3}
```

Every error log includes:
- Error message and stack trace
- Request ID for tracing
- Entity IDs (rideId, userId, alertId) for context
- HTTP method and URL

---

## Frontend Component Architecture

```
App.jsx (coordinator — ~200 lines)
├── Auth state management
├── Session restore
├── Role-based routing
│
├── LoginScreen
│   └── Notification
│
├── PoliceDashboard
│   ├── Notification
│   ├── ProfilePanel (shared)
│   └── GoogleMap (with tracking overlays)
│
├── AmbulanceHospitalSelect
│   ├── Notification
│   └── ProfilePanel (shared)
│
└── AmbulanceNavigation
    ├── Notification
    ├── PreArrivalAlert (modal)
    └── GoogleMap (with route overlay)

Custom Hooks:
├── useGeolocation — browser GPS watcher with cleanup
└── useFirestoreListeners — Firestore subscriptions with cleanup
```

**Design decisions**:
- **Simple prop drilling** over React Context — the component tree is shallow (max 2 levels), so Context would add complexity without benefit
- **Custom hooks** for side effects — ensures proper cleanup of GPS watchers and Firestore listeners
- **Component-per-screen** pattern — each role gets its own top-level component

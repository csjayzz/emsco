# EMS Coordination System

A full-stack **Emergency Medical Services** coordination platform that provides real-time ambulance tracking, intelligent police traffic clearance alerts, and hospital pre-arrival notifications. Built with a hybrid PostgreSQL + Firebase architecture for both persistent analytics and real-time streaming.

---

## Features

### 🚑 Ambulance Driver Dashboard
- **Hospital selection** with search and severity/case-type classification
- **Real-time GPS tracking** with Google Maps navigation overlay
- **Pre-arrival alerts** — transmit patient vitals (HR, BP, SpO₂, treatments) to the destination hospital before arrival
- **Live police officer visibility** — see nearby traffic police on the map

### 🚔 Police Traffic Dashboard
- **Adaptive geofence alerts** — receive notifications when ambulances approach your location
- **One-tap acknowledge & track** — lock onto an incoming ambulance with live route overlay
- **Browser push notifications** with audio alerts and vibration
- **Night-mode adjusted timing** — alert lead times automatically adjust for time-of-day

### 🏥 Hospital Pre-Arrival System
- Hospitals receive structured patient data before the ambulance arrives
- Case severity, emergency type, live vitals, and treatments administered
- Preparation time recommendations based on case classification

### 📊 Profile & Analytics
- Trip history with pagination (ambulance drivers)
- Alert acknowledgment history and response metrics (police officers)
- Editable profile with role-specific fields

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                    │
│  ┌───────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Login     │  │ Ambulance    │  │ Police Dashboard      │ │
│  │ Screen    │  │ Dashboard    │  │ (alerts, tracking)    │ │
│  └───────────┘  └──────────────┘  └───────────────────────┘ │
│                         │                       │            │
│              ┌──────────┴───────────────────────┘            │
│              ▼                                               │
│     ┌─────────────────┐     ┌──────────────────────┐        │
│     │  Axios API      │     │  Firestore Realtime  │        │
│     │  (REST calls)   │     │  (live streaming)    │        │
│     └────────┬────────┘     └──────────┬───────────┘        │
└──────────────┼──────────────────────────┼────────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│   Express Backend        │  │   Firebase (Google Cloud)      │
│  ┌────────────────────┐  │  │  ┌─────────────────────────┐  │
│  │ Auth (JWT + bcrypt) │  │  │  │ Firestore               │  │
│  │ Rides Controller    │  │  │  │ • policeLocations       │  │
│  │ Alerts Controller   │  │  │  │ • activeRides           │  │
│  │ Geofence Service    │──┼──│  │ • alerts                │  │
│  │ Pre-Arrival Ctrl    │  │  │  │ • preArrivalAlerts      │  │
│  └────────────────────┘  │  │  └─────────────────────────┘  │
│           │               │  │  ┌─────────────────────────┐  │
│           ▼               │  │  │ FCM (Push Notifications)│  │
│  ┌────────────────────┐  │  │  └─────────────────────────┘  │
│  │   PostgreSQL       │  │  └───────────────────────────────┘
│  │ • users            │  │
│  │ • rides            │  │
│  │ • ride_locations   │  │
│  │ • police_alerts    │  │
│  │ • hospitals        │  │
│  │ • pre_arrival_data │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

**Why two databases?**
- **PostgreSQL** handles persistent records, analytics queries, and transactional integrity (ride history, user management, alert logs).
- **Firebase Firestore** provides sub-second real-time streaming for live locations and alert delivery — critical for emergency response where every second counts.

---

## Geofencing Algorithms

The system uses three original algorithms for intelligent police alerting:

### 1. Adaptive T_clear (Traffic Clearance Time)

```
T_clear = 150 + 40·f_α + 30·g_v + 25·w + 15·d_drift + 20·n
```

Where:
- **f_α** = congestion factor derived from Google Maps traffic alpha
- **g_v** = speed gradient penalty (slower ambulance → more lead time)
- **w** = weather severity (0–1 scale)
- **d_drift** = ETA instability (measures how much ETA fluctuates)
- **n** = day/night factor (daytime = 1, nighttime = 0)
- Clamped to **[150s, 360s]** range

### 2. Hospital Preparation Time

Lookup table based on `(severity, case_type)` — determines how far in advance the hospital should be notified:

| Severity | Cardiac | Trauma | Stroke | Respiratory | Other |
|----------|---------|--------|--------|-------------|-------|
| Critical | 600s    | 480s   | 540s   | 420s        | 480s  |
| Serious  | 360s    | 360s   | 360s   | 360s        | 360s  |
| Stable   | 240s    | 240s   | 240s   | 240s        | 240s  |

### 3. Distress Detection

Monitors ambulance speed buffer (last N readings). If the mean speed drops below 5 km/h for sustained periods, triggers a distress alert to all nearby officers.

---

## Tech Stack

| Layer      | Technology                                     |
|------------|------------------------------------------------|
| Frontend   | React 19, Vite, Tailwind CSS                   |
| Maps       | Google Maps JavaScript API, Directions Service  |
| Backend    | Node.js, Express 4                              |
| Database   | PostgreSQL (persistent) + Firestore (realtime)  |
| Auth       | JWT (jsonwebtoken) + bcryptjs                   |
| Logging    | Winston (structured JSON in production)         |
| Security   | Helmet, CORS, express-rate-limit                |
| Testing    | Jest (39 unit tests)                            |
| Container  | Docker Compose (PostgreSQL)                     |
| Notifications | Firebase Cloud Messaging (FCM)               |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (for PostgreSQL) or a managed PostgreSQL instance
- Firebase project with Firestore and FCM enabled
- Google Maps API key with Directions API enabled

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/ems-coordination.git
cd ems-coordination

# Frontend
npm install

# Backend
cd backend && npm install
```

### 2. Configure environment

```bash
# Root directory — frontend
cp .env.example .env
# Edit .env with your Firebase and Google Maps keys

# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your PostgreSQL URL, JWT secret, and Firebase Admin credentials
```

### 3. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 4. Initialize database

```bash
psql -h localhost -U postgres -d ems -f backend/schema.sql
```

### 5. Run

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | — | Create account (ambulance/police) |
| POST | `/auth/login` | — | Authenticate and receive JWT |
| GET | `/hospitals` | JWT | List active hospitals |
| POST | `/rides` | JWT | Start a new ride |
| PATCH | `/rides/:id/location` | JWT | Update ambulance location |
| PATCH | `/rides/:id/end` | JWT | End a ride |
| GET | `/rides/history` | JWT | Paginated ride history |
| PATCH | `/alerts/:id/acknowledge` | JWT | Acknowledge a police alert |
| GET | `/alerts/history` | JWT | Paginated alert history |
| GET | `/profile` | JWT | Get user profile + stats |
| PATCH | `/profile` | JWT | Update profile fields |
| GET | `/profile/trips` | JWT | Ambulance trip history |
| GET | `/profile/alerts` | JWT | Police alert history |
| POST | `/rides/:id/pre-arrival` | JWT | Transmit pre-arrival data |
| GET | `/rides/:id/pre-arrival` | JWT | Get pre-arrival record |
| GET | `/health` | — | Service health check |

---

## Testing

```bash
cd backend
npm test
```

```
Test Suites: 2 passed, 2 total
Tests:       39 passed, 39 total
```

Tests cover:
- **Haversine distance** calculations (5 tests)
- **Hospital preparation time** lookups (8 tests)
- **Day/night factor** boundary conditions (3 tests)
- **Adaptive T_clear** algorithm properties (8 tests)
- **Validation middleware** — all 5 rules (16 tests)

---

## Project Structure

```
emsco/
├── src/                          # React frontend
│   ├── App.jsx                   # Root coordinator (~200 lines)
│   ├── components/
│   │   ├── LoginScreen.jsx       # Auth UI
│   │   ├── PoliceDashboard.jsx   # Police alerts + tracking
│   │   ├── AmbulanceHospitalSelect.jsx
│   │   ├── AmbulanceNavigation.jsx
│   │   ├── PreArrivalAlert.jsx   # Patient vitals modal
│   │   ├── ProfilePanel.jsx      # Shared profile component
│   │   └── Notification.jsx      # Toast notifications
│   ├── hooks/
│   │   ├── useGeolocation.js     # GPS watcher with cleanup
│   │   └── useFirestoreListeners.js  # Realtime subscriptions
│   ├── config/firebase.js
│   └── services/api.js           # Axios client with JWT interceptors
│
├── backend/
│   ├── server.js                 # Express app with rate limiting + graceful shutdown
│   ├── controllers/              # Route handlers
│   ├── middleware/                # Auth, RBAC, validation
│   ├── services/
│   │   ├── geofence.js           # Geofencing algorithms
│   │   └── firebaseAdmin.js      # Firebase Admin SDK
│   ├── utils/logger.js           # Winston structured logging
│   ├── tests/                    # Jest unit tests
│   ├── schema.sql                # PostgreSQL schema
│   └── db.js                     # Connection pool
│
├── docker-compose.yml
├── ARCHITECTURE.md               # Deep technical documentation
└── README.md                     # This file
```

---

## Security

- **JWT authentication** with 24h expiry on all protected routes
- **Role-based access control** (ambulance, police, admin)
- **Admin registration blocked** via public API — admin accounts must be created directly in the database
- **Rate limiting** — 200 req/15min global, 20 req/15min on auth endpoints
- **Helmet** security headers on all responses
- **Input validation** middleware with lat/lng bounds checking
- **Structured logging** — no sensitive data in logs

---

## License

MIT

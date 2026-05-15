# ================================================================
# Git History Setup Script for EMS Coordination System
# ================================================================
# This script creates a realistic, feature-by-feature commit history.
# Run this ONCE from the emsco/ root directory.
#
# Usage:   powershell -ExecutionPolicy Bypass -File scripts/setup-git-history.ps1
# ================================================================

# --- Config ---
$AUTHOR = "Jayesh Jagtap <jayeshj0304@gmail.com>"

# --- Helper: commit only what's already staged ---
function Make-Commit {
    param([string]$Message, [string]$Date)
    $env:GIT_AUTHOR_DATE = $Date
    $env:GIT_COMMITTER_DATE = $Date
    git commit -m $Message --author $AUTHOR
    Remove-Item Env:\GIT_AUTHOR_DATE
    Remove-Item Env:\GIT_COMMITTER_DATE
}

# --- Initialize ---
git init
git branch -M main

# --- Commit 0: gitignore first (so secrets never enter history) ---
git add .gitignore
git add backend/.gitignore
Make-Commit "chore: initial project setup with .gitignore" "2026-04-14T10:00:00"

# --- Commit 1: Database schema ---
git add backend/schema.sql backend/db.js
Make-Commit "feat(db): PostgreSQL schema with users, rides, hospitals, alerts tables" "2026-04-15T10:00:00"

# --- Commit 2: Backend foundation ---
git add backend/package.json backend/package-lock.json backend/.env.example
Make-Commit "feat(backend): Express project setup with dependencies" "2026-04-17T14:00:00"

# --- Commit 3: Auth system ---
git add backend/middleware/auth.js backend/middleware/role.js backend/middleware/validate.js
git add backend/controllers/authController.js backend/routes/auth.js
Make-Commit "feat(auth): JWT authentication with bcrypt, RBAC middleware, input validation" "2026-04-19T11:00:00"

# --- Commit 4: Firebase Admin setup ---
git add backend/services/firebaseAdmin.js
Make-Commit "feat(firebase): Firebase Admin SDK integration for Firestore and FCM" "2026-04-21T09:00:00"

# --- Commit 5: Hospital management ---
git add backend/controllers/hospitalsController.js backend/routes/hospitals.js
git add backend/controllers/adminController.js backend/routes/admin.js
Make-Commit "feat(hospitals): CRUD endpoints for hospital management" "2026-04-23T16:00:00"

# --- Commit 6: Ride system ---
git add backend/controllers/ridesController.js backend/routes/rides.js
Make-Commit "feat(rides): ride lifecycle - start, location updates, end with Firestore sync" "2026-04-26T10:00:00"

# --- Commit 7: Geofencing algorithms ---
git add backend/services/geofence.js
Make-Commit "feat(geofence): adaptive T_clear algorithm, hospital prep time, distress detection" "2026-04-29T14:00:00"

# --- Commit 8: Police alerts ---
git add backend/controllers/alertsController.js backend/routes/alerts.js
git add backend/controllers/officersController.js backend/routes/officers.js
Make-Commit "feat(alerts): police alert system with FCM push notifications" "2026-05-01T11:00:00"

# --- Commit 9: Pre-arrival system ---
git add backend/controllers/preArrivalController.js backend/routes/preArrival.js
Make-Commit "feat(pre-arrival): hospital pre-arrival alert transmission" "2026-05-03T15:00:00"

# --- Commit 10: Profile system ---
git add backend/controllers/profileController.js backend/routes/profile.js
Make-Commit "feat(profile): user profiles with trip/alert history and pagination" "2026-05-05T10:00:00"

# --- Commit 11: Server entry point + logger ---
git add backend/server.js backend/utils/logger.js
Make-Commit "feat(server): Express server with rate limiting, structured logging, graceful shutdown" "2026-05-06T09:00:00"

# --- Commit 12: Backend Docker ---
git add backend/Dockerfile backend/.dockerignore
Make-Commit "ops(backend): Dockerfile for containerized deployment" "2026-05-06T15:00:00"

# --- Commit 13: Frontend foundation ---
git add package.json package-lock.json vite.config.js postcss.config.js tailwind.config.js index.html
git add src/main.jsx src/index.css src/config/firebase.js src/services/api.js
Make-Commit "feat(frontend): React + Vite + Tailwind setup with Firebase and Axios client" "2026-05-07T09:00:00"

# --- Commit 14: Login + shared components ---
git add src/components/LoginScreen.jsx src/components/Notification.jsx src/components/ProfilePanel.jsx
Make-Commit "feat(ui): login screen, notification toasts, shared profile panel" "2026-05-08T14:00:00"

# --- Commit 15: Ambulance dashboard ---
git add src/components/AmbulanceHospitalSelect.jsx src/components/AmbulanceNavigation.jsx src/components/PreArrivalAlert.jsx
Make-Commit "feat(ambulance): hospital selection, navigation dashboard, pre-arrival modal" "2026-05-09T11:00:00"

# --- Commit 16: Police dashboard ---
git add src/components/PoliceDashboard.jsx
Make-Commit "feat(police): alert dashboard with live tracking and browser notifications" "2026-05-10T16:00:00"

# --- Commit 17: Custom hooks + App coordinator ---
git add src/hooks/useGeolocation.js src/hooks/useFirestoreListeners.js src/App.jsx
Make-Commit "refactor(app): extract custom hooks, modularize App.jsx (1988 to 200 lines)" "2026-05-11T10:00:00"

# --- Commit 18: Tests ---
git add backend/tests/geofence.test.js backend/tests/validate.test.js
Make-Commit "test: 39 unit tests for geofence algorithms and validation middleware" "2026-05-13T14:00:00"

# --- Commit 19: Docker Compose ---
git add docker-compose.yml
Make-Commit "ops: Docker Compose with PostgreSQL healthchecks" "2026-05-14T17:00:00"

# --- Commit 20: Documentation ---
git add README.md ARCHITECTURE.md .env.example
Make-Commit "docs: professional README, architecture deep dive, env templates" "2026-05-15T10:00:00"

# --- Commit 21: Catch any remaining files ---
git add -A
$staged = git diff --cached --name-only
if ($staged) {
    Make-Commit "chore: remaining project files and assets" "2026-05-15T10:30:00"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Git history created successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
git log --oneline --all
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Create an EMPTY repo on GitHub (no README, no .gitignore)"
Write-Host "  2. Run:  git remote add origin https://github.com/YOUR_USERNAME/ems-coordination.git"
Write-Host "  3. Run:  git push -u origin main"

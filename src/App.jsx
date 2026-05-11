import { useState, useEffect } from "react";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "./config/firebase";
import api from "./services/api";
import useGeolocation from "./hooks/useGeolocation";
import useFirestoreListeners from "./hooks/useFirestoreListeners";

// Components
import LoginScreen from "./components/LoginScreen";
import PoliceDashboard from "./components/PoliceDashboard";
import AmbulanceHospitalSelect from "./components/AmbulanceHospitalSelect";
import AmbulanceNavigation from "./components/AmbulanceNavigation";

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Root App component — orchestrates authentication, role routing,
 * and shared state. Individual dashboards live in their own components.
 */
export default function App() {
  // ── Auth state ──
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userDisplayName, setUserDisplayName] = useState("");

  // ── Shared UI state ──
  const [darkMode, setDarkMode] = useState(false);
  const [notification, setNotification] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [isRiding, setIsRiding] = useState(false);
  const [rideId, setRideId] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [activeTab, setActiveTab] = useState("map");

  // ── Profile state ──
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [profileTrips, setProfileTrips] = useState({ trips: [], total: 0 });
  const [profileAlerts, setProfileAlerts] = useState({ alerts: [], total: 0 });
  const [profilePage, setProfilePage] = useState(1);

  // ── Custom hooks ──
  const { location: geoLocation, speed, loading: locationLoading } = useGeolocation(userRole);
  const { policeOfficersLocations, activeAmbulances, alerts, setAlerts } = useFirestoreListeners(userRole, userId);

  // Derive role-specific location
  const ambulanceLocation = userRole === "ambulance" ? geoLocation : null;
  const policeLocation = userRole === "police" ? geoLocation : null;

  // ── Helpers ──
  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Session restore ──
  useEffect(() => {
    const token = localStorage.getItem("ems_token");
    if (!token) { setAuthLoading(false); return; }

    api.get("/profile")
      .then((res) => {
        const { user } = res.data;
        setUserRole(user.role);
        setUserId(user.id);
        setUserDisplayName(user.name || user.email || "User");
      })
      .catch(() => localStorage.removeItem("ems_token"))
      .finally(() => setAuthLoading(false));
  }, []);

  // ── Load hospitals when authenticated ──
  useEffect(() => {
    if (userRole) {
      api.get("/hospitals")
        .then((res) => {
          const normalized = res.data.map((h) => ({ ...h, lat: toNumber(h.lat), lng: toNumber(h.lng) }));
          const byKey = normalized.reduce((acc, h) => {
            if (!h || h.lat === null || h.lng === null || !h.name) return acc;
            const key = `${h.id || ''}-${h.name.trim().toLowerCase()}-${h.lat.toFixed(6)}-${h.lng.toFixed(6)}`;
            acc[key] = acc[key] || h;
            return acc;
          }, {});
          setHospitals(Object.values(byKey));
        })
        .catch((err) => console.error("Failed to load hospitals:", err));
    }
  }, [userRole]);

  // ── Load profile when tab switches ──
  useEffect(() => {
    if (activeTab === "profile" && userRole) {
      fetchProfile();
      if (userRole === "ambulance") fetchProfileTrips(1);
      if (userRole === "police") fetchProfileAlerts(1);
    }
  }, [activeTab, userRole]);

  // ── Auth handlers ──
  const handleLogin = async (email, password) => {
    if (!email || !password) { showNotification("Please enter your email and password.", "error"); return; }
    setLoginLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("ems_token", res.data.token);
      const { user } = res.data;
      setUserRole(user.role); setUserId(user.id); setUserDisplayName(user.name || email);
      showNotification(`Logged in as ${user.role === "ambulance" ? "Ambulance Driver" : "Traffic Police"}`, "success");
    } catch (error) {
      showNotification(error.response?.data?.error || "Login failed.", "error");
    } finally { setLoginLoading(false); }
  };

  const handleSignUp = async (name, email, password, role) => {
    if (!name?.trim()) { showNotification("Please enter your full name.", "error"); return; }
    if (!email || !password) { showNotification("Please enter your email and password.", "error"); return; }
    if (password.length < 6) { showNotification("Password must be at least 6 characters.", "error"); return; }
    setSignUpLoading(true);
    try {
      const res = await api.post("/auth/register", { name: name.trim(), email, password, role });
      localStorage.setItem("ems_token", res.data.token);
      const { user } = res.data;
      setUserRole(user.role); setUserId(user.id); setUserDisplayName(user.name || name.trim());
      showNotification(`Account created! Logged in as ${role === "ambulance" ? "Ambulance Driver" : "Traffic Police"}.`, "success");
    } catch (error) {
      showNotification(error.response?.data?.error || "Registration failed.", "error");
    } finally { setSignUpLoading(false); }
  };

  const handleLogout = async () => {
    if (isRiding && rideId) await api.patch(`/rides/${rideId}/end`).catch(() => {});
    if (userRole === "police" && userId) {
      await updateDoc(doc(db, "policeLocations", userId), { status: "inactive" }).catch(() => {});
    }
    localStorage.removeItem("ems_token");
    setUserRole(null); setUserId(null); setUserDisplayName(""); setSelectedHospital(null);
    setIsRiding(false); setRideId(null); setActiveTab("map"); setProfileData(null);
  };

  // ── Profile helpers ──
  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await api.get("/profile");
      setProfileData(res.data); setEditForm(res.data.user);
    } catch (err) { console.error("Profile fetch error:", err); }
    finally { setProfileLoading(false); }
  };

  const saveProfile = async () => {
    try {
      const updateFields = {};
      const allowed = ["name","phone","bio","years_experience","vehicle_id","vehicle_type","license_plate","badge_number","station","jurisdiction"];
      for (const f of allowed) {
        if (editForm[f] !== undefined && editForm[f] !== profileData.user[f]) updateFields[f] = editForm[f];
      }
      if (Object.keys(updateFields).length === 0) { setEditMode(false); return; }
      const res = await api.patch("/profile", updateFields);
      setProfileData((prev) => ({ ...prev, user: res.data.user }));
      setEditMode(false);
      showNotification("Profile updated!", "success");
    } catch (err) { showNotification("Failed to update profile", "error"); }
  };

  const fetchProfileTrips = async (page = 1) => {
    try { const res = await api.get(`/profile/trips?page=${page}&limit=10`); setProfileTrips(res.data); setProfilePage(page); }
    catch (err) { console.error("Trips fetch error:", err); }
  };

  const fetchProfileAlerts = async (page = 1) => {
    try { const res = await api.get(`/profile/alerts?page=${page}&limit=10`); setProfileAlerts(res.data); setProfilePage(page); }
    catch (err) { console.error("Alerts fetch error:", err); }
  };

  // ── Render ──

  // Auth loading splash
  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className={darkMode ? "text-gray-300" : "text-gray-600"}>Loading…</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!userRole) {
    return (
      <LoginScreen
        darkMode={darkMode} setDarkMode={setDarkMode} notification={notification}
        onLogin={handleLogin} onSignUp={handleSignUp}
        loginLoading={loginLoading} signUpLoading={signUpLoading}
      />
    );
  }

  // Police dashboard
  if (userRole === "police") {
    return (
      <PoliceDashboard
        darkMode={darkMode} setDarkMode={setDarkMode} notification={notification}
        showNotification={showNotification} userId={userId} userDisplayName={userDisplayName}
        policeLocation={policeLocation} locationLoading={locationLoading}
        alerts={alerts} setAlerts={setAlerts} activeAmbulances={activeAmbulances}
        onLogout={handleLogout}
        profileData={profileData} profileLoading={profileLoading}
        editMode={editMode} setEditMode={setEditMode}
        editForm={editForm} setEditForm={setEditForm} onSaveProfile={saveProfile}
        profileAlerts={profileAlerts} profilePage={profilePage} onFetchAlerts={fetchProfileAlerts}
      />
    );
  }

  // Ambulance — hospital selection
  if (userRole === "ambulance" && !selectedHospital) {
    return (
      <AmbulanceHospitalSelect
        darkMode={darkMode} setDarkMode={setDarkMode} notification={notification}
        hospitals={hospitals} onSelectHospital={setSelectedHospital} onLogout={handleLogout}
        activeTab={activeTab} setActiveTab={setActiveTab}
        profileData={profileData} profileLoading={profileLoading}
        editMode={editMode} setEditMode={setEditMode}
        editForm={editForm} setEditForm={setEditForm} onSaveProfile={saveProfile}
        profileTrips={profileTrips} profilePage={profilePage} onFetchTrips={fetchProfileTrips}
      />
    );
  }

  // Ambulance — active navigation
  if (userRole === "ambulance" && selectedHospital) {
    return (
      <AmbulanceNavigation
        darkMode={darkMode} setDarkMode={setDarkMode} notification={notification}
        showNotification={showNotification}
        selectedHospital={selectedHospital} setSelectedHospital={setSelectedHospital}
        userId={userId} ambulanceLocation={ambulanceLocation} speed={speed}
        policeOfficersLocations={policeOfficersLocations}
        rideId={rideId} setRideId={setRideId}
        isRiding={isRiding} setIsRiding={setIsRiding} onLogout={handleLogout}
      />
    );
  }
}

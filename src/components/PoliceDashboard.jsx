import { useState, useEffect, useMemo, useRef } from "react";
import { Shield, MapPin, AlertTriangle, Navigation, Ambulance, Bell, BellOff, Moon, Sun, User } from "lucide-react";
import { GoogleMap, Marker, DirectionsRenderer, useJsApiLoader } from "@react-google-maps/api";
import { updateDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import Notification from "./Notification";
import ProfilePanel from "./ProfilePanel";
import api from "../services/api";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const mapContainerStyle = { width: '100%', height: '100%' };

const baseMapOptions = {
  disableDefaultUI: false, zoomControl: true, streetViewControl: false,
  mapTypeControl: false, fullscreenControl: true,
};

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
];

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const playAlertBeep = () => {
  const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGJ0fPTgjMGHm7A7+OZUQ8NVart67FYEQ1Lp+Twul4cBzmP1vLNeisFJHjI8N+SQwsVYLPp66dUFAlEnuHy');
  let count = 0;
  const interval = setInterval(() => { audio.currentTime = 0; audio.play().catch(() => {}); if (++count >= 3) clearInterval(interval); }, 700);
};

/**
 * Police Dashboard component.
 * Shows status, alerts, map with tracked ambulance, and profile tab.
 */
export default function PoliceDashboard({
  darkMode, setDarkMode, notification, showNotification,
  userId, userDisplayName, policeLocation, locationLoading,
  alerts, setAlerts, activeAmbulances, onLogout,
  // Profile props
  profileData, profileLoading, editMode, setEditMode,
  editForm, setEditForm, onSaveProfile,
  profileAlerts: profileAlertsData, profilePage, onFetchAlerts
}) {
  const [activeTab, setActiveTab] = useState('map');
  const [trackedAlert, setTrackedAlert] = useState(null);
  const [policeRoute, setPoliceRoute] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [previousAlertCount, setPreviousAlertCount] = useState(0);
  const initialCenter = useRef({ lat: 21.1458, lng: 79.0882 });

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });

  const mapOptions = useMemo(() => ({ ...baseMapOptions, styles: darkMode ? darkMapStyles : [] }), [darkMode]);
  const policeDirectionsOptions = useMemo(() => ({ polylineOptions: { strokeColor: "#3B82F6", strokeWeight: 5 }, suppressMarkers: true }), []);

  // Set initial center once
  useEffect(() => {
    if (policeLocation && initialCenter.current.lat === 21.1458) {
      initialCenter.current = { ...policeLocation };
    }
  }, [policeLocation]);

  // Update police location in Firestore
  useEffect(() => {
    if (userId && policeLocation) {
      const policeDocRef = doc(db, "policeLocations", userId);
      updateDoc(policeDocRef, {
        lat: policeLocation.lat, lng: policeLocation.lng,
        officerName: userDisplayName || "Unknown", lastUpdated: new Date(), status: "active"
      }).catch(async (err) => {
        if (err.code === 'not-found') {
          await setDoc(policeDocRef, {
            lat: policeLocation.lat, lng: policeLocation.lng,
            officerName: userDisplayName || "Unknown", lastUpdated: new Date(), status: "active"
          });
        }
      });
    }
  }, [policeLocation, userId, userDisplayName]);

  // Notification permission check
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  // Browser notifications for new alerts
  useEffect(() => {
    if (notificationsEnabled && alerts.length > previousAlertCount) {
      alerts.slice(previousAlertCount).forEach((alert) => {
        if (!alert.acknowledged) {
          new window.Notification("🚨 Emergency Alert!", {
            body: `Ambulance ${alert.ambulanceId} approaching - ${alert.distance}m away (${alert.severity?.toUpperCase()})`,
            tag: alert.id, requireInteraction: true
          });
          playAlertBeep();
          if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 200]);
        }
      });
      setPreviousAlertCount(alerts.length);
    } else if (alerts.length < previousAlertCount) {
      setPreviousAlertCount(alerts.length);
    }
  }, [alerts, notificationsEnabled, previousAlertCount]);

  // Track ambulance route
  useEffect(() => {
    const liveAmbulance = trackedAlert ? activeAmbulances[trackedAlert.rideId] : null;
    if (trackedAlert && (!liveAmbulance || liveAmbulance.status !== 'active')) {
      setTrackedAlert(null); setPoliceRoute(null); return;
    }
    if (trackedAlert && liveAmbulance && policeLocation && isLoaded && window.google
        && liveAmbulance.currentLat !== null && liveAmbulance.currentLng !== null) {
      new window.google.maps.DirectionsService().route({
        origin: new window.google.maps.LatLng(liveAmbulance.currentLat, liveAmbulance.currentLng),
        destination: new window.google.maps.LatLng(policeLocation.lat, policeLocation.lng),
        travelMode: window.google.maps.TravelMode.DRIVING,
      }, (result, status) => { if (status === 'OK') setPoliceRoute(result); });
    } else { setPoliceRoute(null); }
  }, [trackedAlert, activeAmbulances, policeLocation, isLoaded]);

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await window.Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
      showNotification(permission === "granted" ? "Browser notifications enabled!" : "Notification permission denied", permission === "granted" ? "success" : "error");
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await api.patch(`/alerts/${alertId}/acknowledge`);
      setAlerts(prev => {
        const next = prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a);
        const acked = next.find(a => a.id === alertId);
        if (acked) setTrackedAlert(acked);
        return next;
      });
      showNotification("Alert acknowledged. Tracking ambulance...", "success");
    } catch (error) {
      console.error("Error acknowledging alert:", error);
    }
  };

  const visiblePoliceAlerts = alerts.filter((alert) => {
    const ride = activeAmbulances[alert.rideId];
    return !alert.acknowledged && !alert.resolved && ride?.status === "active";
  });

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Notification notification={notification} />

      <button onClick={() => setDarkMode(!darkMode)}
        className={`fixed top-4 left-4 p-3 rounded-full shadow-lg transition-all z-50 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' : 'bg-white hover:bg-gray-100 text-gray-700'}`}>
        {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="bg-blue-500 text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <Shield className="h-8 w-8 mr-3" />
          <div>
            <h2 className="text-xl font-bold">{userDisplayName || "Officer"}</h2>
            <p className="text-sm text-blue-100">Traffic Police - Emergency Response</p>
          </div>
        </div>
        <button onClick={onLogout} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors border border-white text-white font-medium">Logout</button>
      </div>

      <div className="p-4 space-y-4" style={{ display: activeTab === 'map' ? 'block' : 'none' }}>
        {/* Status Card */}
        <div className={`rounded-lg shadow p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-900'}`}>Status</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${policeLocation ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}>
              {policeLocation ? 'Active' : 'Detecting GPS'}
            </span>
          </div>
          <div className={`flex items-center mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <MapPin className="h-4 w-4 mr-2" />
            <span className="text-sm">
              Position: {locationLoading ? <span className="text-yellow-600">Detecting GPS...</span>
                : policeLocation ? `${policeLocation.lat.toFixed(4)}, ${policeLocation.lng.toFixed(4)}`
                : <span className="text-red-600">GPS unavailable</span>}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {notificationsEnabled ? <><Bell className="h-4 w-4 mr-2 text-green-600" /><span className="text-sm text-green-600">Notifications enabled</span></>
                : <><BellOff className="h-4 w-4 mr-2 text-gray-400" /><span className="text-sm text-gray-400">Notifications disabled</span></>}
            </div>
            {!notificationsEnabled && "Notification" in window && (
              <button onClick={requestNotificationPermission} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-semibold transition-colors">Enable Alerts</button>
            )}
          </div>
        </div>

        {/* Alerts Card */}
        <div className={`rounded-lg shadow p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-900'}`}>Alerts</h3>
            <span className={"px-2 py-1 rounded-full text-sm " + (visiblePoliceAlerts.length > 0 ? "bg-red-100 text-red-700" : darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700")}>{visiblePoliceAlerts.length}</span>
          </div>
          {visiblePoliceAlerts.length === 0 ? (
            <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
              <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-gray-300" /><p>No Active Alerts</p>
              <p className="text-xs mt-1">Waiting for ambulance signals...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visiblePoliceAlerts.map((alert) => {
                const ambulance = activeAmbulances[alert.rideId];
                const currentDistance = ambulance && policeLocation
                  ? Math.round(calculateDistance(ambulance.currentLat, ambulance.currentLng, policeLocation.lat, policeLocation.lng))
                  : alert.distance;
                return (
                  <div key={alert.id} className={"border-l-4 p-4 rounded " + (alert.severity === "critical" ? "border-red-500 bg-red-50" : "border-yellow-500 bg-yellow-50")}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-gray-800"><Ambulance className="inline h-4 w-4 mr-1" />{alert.ambulanceName || alert.ambulanceId}</h4>
                        <p className="text-sm text-gray-600">Destination: {alert.hospital}</p>
                      </div>
                      <span className={"px-2 py-1 rounded text-xs font-semibold " + (alert.severity === "critical" ? "bg-red-500 text-white" : "bg-yellow-500 text-white")}>{alert.severity?.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 mb-3">
                      <Navigation className="h-3 w-3 mr-1" />
                      <span>{currentDistance}m away - {ambulance ? `Speed: ${ambulance.speed} km/h` : ''}</span>
                    </div>
                    {!alert.acknowledged ? (
                      <button onClick={() => handleAcknowledge(alert.id)} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded font-semibold transition-colors">Acknowledge & Track</button>
                    ) : (
                      <div className="bg-green-100 text-green-800 py-2 px-3 rounded text-center font-semibold text-sm">✓ Acknowledged - Tracking Active</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Map */}
        <div className={`rounded-lg shadow p-4 h-96 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          {isLoaded && (
            <GoogleMap mapContainerStyle={mapContainerStyle} center={initialCenter.current} zoom={14} options={mapOptions}>
              {policeLocation && <Marker position={policeLocation}
                icon={{ url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="blue" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>') }}
                label={{ text: "You", color: "white", fontSize: "12px", fontWeight: "bold" }} />}
              {trackedAlert && (() => {
                const amb = activeAmbulances[trackedAlert.rideId];
                if (!amb || amb.status === "completed" || amb.currentLat === null) return null;
                return <Marker position={{ lat: amb.currentLat, lng: amb.currentLng }}
                  icon={{ url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="red" stroke="white" stroke-width="2"><rect x="3" y="11" width="18" height="8" rx="2"/><path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4"/></svg>') }}
                  label={{ text: trackedAlert.ambulanceName || trackedAlert.ambulanceId, color: "white", fontSize: "11px", fontWeight: "bold" }} />;
              })()}
              {policeRoute && <DirectionsRenderer directions={policeRoute} options={policeDirectionsOptions} />}
            </GoogleMap>
          )}
        </div>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <ProfilePanel darkMode={darkMode} userRole="police" profileData={profileData}
          profileLoading={profileLoading} editMode={editMode} setEditMode={setEditMode}
          editForm={editForm} setEditForm={setEditForm} onSaveProfile={onSaveProfile}
          profileTrips={{ trips: [], total: 0 }} profileAlerts={profileAlertsData}
          profilePage={profilePage} onFetchTrips={() => {}} onFetchAlerts={onFetchAlerts} />
      )}

      {/* Bottom Tab Bar */}
      <div className={`fixed bottom-0 left-0 right-0 border-t flex ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <button onClick={() => setActiveTab('map')} className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs font-semibold ${activeTab === 'map' ? 'text-blue-500' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}><Shield className="h-5 w-5" />Dashboard</button>
        <button onClick={() => setActiveTab('profile')} className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs font-semibold ${activeTab === 'profile' ? 'text-blue-500' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}><User className="h-5 w-5" />Profile</button>
      </div>
    </div>
  );
}

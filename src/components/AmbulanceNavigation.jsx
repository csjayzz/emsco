import { useState, useEffect, useMemo, useRef } from "react";
import { Ambulance, MapPin, Clock, Gauge, Heart, Activity, Droplet, Wind, AlertTriangle, FileText, Moon, Sun } from "lucide-react";
import { GoogleMap, Marker, DirectionsRenderer, useJsApiLoader } from "@react-google-maps/api";
import Notification from "./Notification";
import PreArrivalAlert from "./PreArrivalAlert";
import api from "../services/api";
import { db } from "../config/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

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

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeLatLng(value) {
  if (!value) return null;
  const lat = toNumber(value.lat);
  const lng = toNumber(value.lng);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

/**
 * Ambulance Navigation Dashboard.
 * Shown when a hospital is selected — displays route, metrics, ride controls, and map.
 */
export default function AmbulanceNavigation({
  darkMode, setDarkMode, notification, showNotification,
  selectedHospital, setSelectedHospital,
  userId, ambulanceLocation, speed,
  policeOfficersLocations, rideId, setRideId,
  isRiding, setIsRiding, onLogout
}) {
  const [severity, setSeverity] = useState("critical");
  const [caseType, setCaseType] = useState("cardiac");
  const [eta, setEta] = useState("--");
  const [distance, setDistance] = useState(0);
  const [directions, setDirections] = useState(null);
  const [showPreArrivalAlert, setShowPreArrivalAlert] = useState(false);
  const [acknowledgedOfficerIds, setAcknowledgedOfficerIds] = useState([]);
  const initialCenter = useRef({ lat: 21.1458, lng: 79.0750 });

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  const mapOptions = useMemo(() => ({ ...baseMapOptions, styles: darkMode ? darkMapStyles : [] }), [darkMode]);
  const ambulanceDirectionsOptions = useMemo(() => ({ polylineOptions: { strokeColor: "#FF0000", strokeWeight: 5 }, suppressMarkers: true }), []);
  const selectedHospitalPosition = normalizeLatLng(selectedHospital);

  // Set initial center once
  useEffect(() => {
    if (ambulanceLocation && initialCenter.current.lat === 21.1458) {
      initialCenter.current = { ...ambulanceLocation };
    }
  }, [ambulanceLocation]);

  // Update directions when location changes
  useEffect(() => {
    if (!isLoaded || !ambulanceLocation || !selectedHospitalPosition || !window.google?.maps?.DirectionsService) {
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({
      origin: new window.google.maps.LatLng(ambulanceLocation.lat, ambulanceLocation.lng),
      destination: new window.google.maps.LatLng(selectedHospitalPosition.lat, selectedHospitalPosition.lng),
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK') {
        setDirections(result);
        const route = result.routes[0].legs[0];
        setDistance((route.distance.value / 1000).toFixed(2));
        setEta((route.duration.value / 60).toFixed(1));
      }
    });
  }, [ambulanceLocation, selectedHospitalPosition, isLoaded]);

  // Send location updates to backend during active ride
  useEffect(() => {
    if (isRiding && rideId && ambulanceLocation) {
      // Derive congestion_alpha from Google Maps route data.
      // Alpha = traffic_duration / free_flow_duration (1.0 = no traffic, 2.0+ = heavy).
      // If traffic data isn't available, default to 1.0 (free flow).
      let congestionAlpha = 1.0;
      if (directions?.routes?.[0]?.legs?.[0]) {
        const leg = directions.routes[0].legs[0];
        const freeFlow = leg.duration?.value || 1;
        const inTraffic = leg.duration_in_traffic?.value || freeFlow;
        congestionAlpha = Math.max(1.0, inTraffic / freeFlow);
      }

      api.patch(`/rides/${rideId}/location`, {
        lat: ambulanceLocation.lat, lng: ambulanceLocation.lng,
        speed, eta_minutes: parseFloat(eta) || null,
        congestion_alpha: congestionAlpha,
        weather: 0   // 0 = clear; can be extended with a weather API later
      }).catch(err => console.error("Error updating location:", err));
    }
  }, [ambulanceLocation, isRiding, rideId, speed, eta, directions]);

  // Listen for acknowledged alerts for this ride (ambulance view)
  useEffect(() => {
    if (!rideId) {
      setAcknowledgedOfficerIds([]);
      return;
    }

    const q = query(
      collection(db, 'alerts'),
      where('rideId', '==', rideId),
      where('acknowledged', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.officerId) ids.push(data.officerId);
      });
      setAcknowledgedOfficerIds(Array.from(new Set(ids)));
    }, (err) => {
      console.error('Acknowledged alerts listener error:', err);
    });

    return () => unsubscribe();
  }, [rideId]);

  const handleStartRide = async () => {
    setIsRiding(true);
    try {
      const res = await api.post('/rides', {
        hospital_id: selectedHospital.id, severity, case_type: caseType
      });
      setRideId(res.data.rideId);
      showNotification("Ride started! Monitoring for nearby police...", "success");
    } catch (error) {
      console.error("Error starting ride:", error);
      showNotification("Error starting ride. Check console.", "error");
      setIsRiding(false);
    }
  };

  const handleEndRide = async () => {
    if (rideId) {
      await api.patch(`/rides/${rideId}/end`).catch(err => console.error('Error ending ride:', err));
    }
    setSelectedHospital(null);
    setIsRiding(false);
    setRideId(null);
  };

  const handleTransmitAlert = async (patientData) => {
    try {
      await api.post(`/rides/${rideId}/pre-arrival`, {
        emergency_type: patientData.emergencyType,
        severity: patientData.caseSeverity,
        heart_rate: parseInt(patientData.heartRate),
        blood_pressure: patientData.bloodPressure,
        spo2: parseInt(patientData.spO2),
        treatments: Object.keys(patientData.treatments || {}).filter(k => patientData.treatments[k]),
        notes: patientData.notes || ''
      });
      showNotification('Pre-arrival alert transmitted to hospital!', 'success');
    } catch (error) {
      console.error('Pre-arrival error:', error);
      showNotification('Failed to transmit pre-arrival alert', 'error');
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Notification notification={notification} />

      <button onClick={() => setDarkMode(!darkMode)}
        className={`fixed top-20 left-4 p-3 rounded-full shadow-lg transition-all z-50 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' : 'bg-white hover:bg-gray-100 text-gray-700'}`}>
        {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <PreArrivalAlert isOpen={showPreArrivalAlert} onClose={() => setShowPreArrivalAlert(false)}
        selectedHospital={selectedHospital} eta={eta} ambulanceId={userId} onTransmit={handleTransmitAlert} />

      <div className="bg-red-500 text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <Ambulance className="h-8 w-8 mr-3" />
          <div>
            <h2 className="text-xl font-bold">Ambulance Driver</h2>
            <p className="text-sm text-red-100">Emergency Response System</p>
          </div>
        </div>
        <button onClick={onLogout} className="bg-transparent bg-opacity-20 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors">Logout</button>
      </div>

      <div className="p-4">
        <div className={`rounded-lg shadow-lg p-6 mb-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-start mb-4">
            <div className="bg-red-100 p-3 rounded-full mr-4"><MapPin className="h-6 w-6 text-red-500" /></div>
            <div className="flex-1">
              <h3 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-800'}`}>{selectedHospital.name}</h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Distance: {distance} km</p>
            </div>
          </div>

          {/* Severity & Case Type selectors (pre-ride) */}
          {!isRiding && (
            <div className="mb-4 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Case Severity</label>
                <div className="flex gap-2">
                  {[{v:'critical',c:'bg-red-500'},{v:'serious',c:'bg-orange-500'},{v:'stable',c:'bg-green-500'}].map(({v,c}) => (
                    <button key={v} onClick={() => setSeverity(v)}
                      className={`flex-1 py-2 rounded font-semibold capitalize ${severity === v ? `${c} text-white` : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>{v}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Case Type</label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    {v:'cardiac',icon:Heart,color:'text-red-500'}, {v:'trauma',icon:Activity,color:'text-orange-500'},
                    {v:'stroke',icon:Droplet,color:'text-purple-500'}, {v:'respiratory',icon:Wind,color:'text-blue-500'},
                    {v:'other',icon:AlertTriangle,color:'text-gray-500'}
                  ].map(({v,icon:Icon,color}) => (
                    <button key={v} onClick={() => setCaseType(v)}
                      className={`py-2 px-1 rounded flex flex-col items-center gap-1 text-xs font-semibold capitalize transition-colors ${
                        caseType === v ? 'bg-blue-500 text-white' : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                      }`}>
                      <Icon className={`h-4 w-4 ${caseType === v ? 'text-white' : color}`} />
                      {v === 'respiratory' ? 'resp.' : v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Clock className={`h-4 w-4 mr-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>ETA</span>
              </div>
              <p className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-900'}`}>{eta} min</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Gauge className={`h-4 w-4 mr-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Speed</span>
              </div>
              <p className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-900'}`}>{speed} km/h</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <MapPin className={`h-4 w-4 mr-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>GPS</span>
              </div>
              <p className={`font-bold text-xs ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {ambulanceLocation ? ambulanceLocation.lat.toFixed(4) : "---"}<br/>
                {ambulanceLocation ? ambulanceLocation.lng.toFixed(4) : "---"}
              </p>
            </div>
          </div>

          {/* Start / Active Ride controls */}
          {!isRiding && (
            <button onClick={handleStartRide} className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-lg font-bold text-lg transition-colors">Start Ride</button>
          )}

          {isRiding && (
            <div className="space-y-3">
              <div className={`py-3 px-4 rounded-lg text-center font-semibold ${severity === 'critical' ? 'bg-red-100 text-red-800' : severity === 'serious' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                🚨 En Route - {severity.toUpperCase()} ({caseType})
              </div>
              <div className="bg-green-100 text-green-800 py-2 px-3 rounded text-center text-sm">
                Active police nearby: {Object.keys(policeOfficersLocations).length} officer(s)
                {acknowledgedOfficerIds.length > 0 && (
                  <div className="text-red-700 text-xs mt-1">{acknowledgedOfficerIds.length} officer(s) acknowledged alert(s)</div>
                )}
              </div>
              <button onClick={() => setShowPreArrivalAlert(true)}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-semibold transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg">
                <FileText className="h-5 w-5" /> Send Pre-Arrival Alert
              </button>
              <button onClick={handleEndRide} className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors">End Ride</button>
            </div>
          )}
        </div>

        {/* Map */}
        <div className={`rounded-lg shadow-lg p-4 h-96 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          {isLoaded && (
            <GoogleMap mapContainerStyle={mapContainerStyle} center={ambulanceLocation || initialCenter.current} zoom={14} options={mapOptions}>
              {ambulanceLocation && <Marker position={ambulanceLocation}
                icon={{ url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="red" stroke="white" stroke-width="2"><rect x="3" y="11" width="18" height="8" rx="2"/><path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4"/><path d="M12 15h.01"/></svg>') }} />}
              {selectedHospitalPosition && <Marker position={selectedHospitalPosition}
                icon={{ url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="green" stroke="white" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><path d="M12 8v8m-4-4h8" stroke="white" stroke-width="3"/></svg>') }} />}
              {Object.values(policeOfficersLocations).map((officer) => {
                const acknowledged = acknowledgedOfficerIds.includes(officer.id);
                const iconSvg = acknowledged
                  ? '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#dc2626" stroke="white" stroke-width="2.5"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="11" r="4" fill="#dc2626"/><path d="M10.5 11.5l1.5 1.5 3-3" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                  : '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3" fill="none" stroke="#2563eb" stroke-width="2"/></svg>';

                return (
                  <Marker key={officer.id} position={{ lat: officer.lat, lng: officer.lng }}
                    icon={{ url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(iconSvg) }}
                    label={{ text: officer.officerName, color: acknowledged ? 'white' : 'blue', fontSize: '11px', fontWeight: 'bold' }} />
                );
              })}
              {directions && <DirectionsRenderer directions={directions} options={ambulanceDirectionsOptions} />}
            </GoogleMap>
          )}
        </div>
      </div>
    </div>
  );
}

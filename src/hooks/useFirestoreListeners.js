import { useState, useEffect } from "react";
import { db } from "../config/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

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
 * Custom hook for Firestore realtime subscriptions.
 * Manages police locations, active ambulance rides, and police alerts.
 * All listeners are properly cleaned up on unmount.
 */
export default function useFirestoreListeners(userRole, userId) {
  const [policeOfficersLocations, setPoliceOfficersLocations] = useState({});
  const [activeAmbulances, setActiveAmbulances] = useState({});
  const [alerts, setAlerts] = useState([]);

  // Ambulance role: listen to active police officers
  useEffect(() => {
    if (userRole !== "ambulance") return;

    const q = query(
      collection(db, "policeLocations"),
      where("status", "==", "active")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const locations = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        const position = normalizeLatLng(data);
        if (!position) return;
        locations[doc.id] = { id: doc.id, ...data, ...position };
      });
      setPoliceOfficersLocations(locations);
    });

    return () => unsubscribe();
  }, [userRole]);

  // Police role: listen to active ambulance rides
  useEffect(() => {
    if (userRole !== "police") return;

    const q = query(
      collection(db, "activeRides"),
      where("status", "==", "active")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ambulances = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        ambulances[doc.id] = {
          id: doc.id,
          ...data,
          currentLat: toNumber(data.currentLat),
          currentLng: toNumber(data.currentLng),
          hospitalLat: toNumber(data.hospitalLat),
          hospitalLng: toNumber(data.hospitalLng)
        };
      });
      setActiveAmbulances(ambulances);
    });

    return () => unsubscribe();
  }, [userRole]);

  // Police role: listen to officer-specific alerts
  useEffect(() => {
    if (userRole !== "police" || !userId) return;

    const q = query(
      collection(db, "alerts"),
      where("officerId", "==", userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newAlerts = [];
        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          if (!data.acknowledged) {
            newAlerts.push(data);
          }
        });
        setAlerts(newAlerts);
      },
      (error) => {
        console.error("Police alerts listener error:", error);
      }
    );

    return () => unsubscribe();
  }, [userRole, userId]);

  return { policeOfficersLocations, activeAmbulances, alerts, setAlerts };
}

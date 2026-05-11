import { useState, useEffect } from "react";

/**
 * Custom hook for browser geolocation tracking.
 * Returns the current position and loading state.
 * Starts watching when userRole is set.
 */
export default function useGeolocation(userRole) {
  const [location, setLocation] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userRole) return;

    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setLocation(coords);
        setSpeed(Math.round((position.coords.speed || 0) * 3.6));
        setLoading(false);
      },
      (error) => {
        console.log("Location error:", error);
        setLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userRole]);

  return { location, speed, loading };
}

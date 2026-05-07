// firebase.js
import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

/**
 * Firebase is used here for Firestore realtime data and FCM.
 * Application authentication is handled by the backend JWT flow.
 */


const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// --------------------
// Firebase Services
// --------------------
export const db = initializeFirestore(app, {
  // Some Windows/browser/network setups break Firestore's default
  // streaming transport with QUIC/channel errors. Force long-polling
  // for more reliable realtime listeners.
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});
export const messaging = getMessaging(app);

// --------------------
// FCM (Push Notifications)
// --------------------
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Requests notification permission and returns FCM token
 * Used mainly on Police login
 */
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.warn("Notification permission denied");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    });

    if (token) {
      console.log("FCM Token generated:", token);
      return token;
    }

    console.warn("No FCM token received");
    return null;
  } catch (error) {
    console.error("FCM permission/token error:", error);
    return null;
  }
};

/**
 * Foreground message listener
 * (When app is open and notification arrives)
 */
export const onMessageListener = (callback) => {
  onMessage(messaging, (payload) => {
    console.log("Foreground FCM message:", payload);
    callback(payload);
  });
};

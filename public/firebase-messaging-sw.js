// public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// ⚠️ MUST match your firebase.js config EXACTLY
firebase.initializeApp({
  apiKey: "AIzaSyDlazzShSAyRDf13ndtkRHULgOujnek3cA",
  authDomain: "ems-auth-ad233.firebaseapp.com",
  projectId: "ems-auth-ad233",
  storageBucket: "ems-auth-ad233.appspot.com",
  messagingSenderId: "873948544358",
  appId: "1:873948544358:web:ab04b043d81509f4b21ca7",
});

const messaging = firebase.messaging();

/**
 * Handle background push notifications
 */
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message received:", payload);

  const notificationTitle =
    payload.notification?.title || "🚑 EMS Alert";

  const notificationOptions = {
    body:
      payload.notification?.body ||
      "An ambulance is approaching your location",
    icon: "/ambulance-icon.png",
    badge: "/badge-icon.png",
    tag: "ems-alert", // prevents spam stacking
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: payload.data, // rideId, alertId, etc
  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

/**
 * Handle notification click
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes("/") && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open new tab
        if (clients.openWindow) {
          return clients.openWindow("/");
        }
      })
  );
});

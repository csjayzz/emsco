const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Listen for new notifications in Firestore and send FCM
exports.sendNotification = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snap, _context) => {  // Add underscore to unused param
    const notification = snap.data();

    const message = {
      token: notification.to,
      notification: {
        title: notification.notification.title,
        body: notification.notification.body,
      },
      data: notification.data || {},
      webpush: {
        notification: {
          icon: "/ambulance-icon.png",
          badge: "/badge-icon.png",
          vibrate: [200, 100, 200],
          requireInteraction: true,
        },
      },
    };

    try {
      const response = await admin.messaging().send(message);
      console.log("Successfully sent message:", response);

      // Mark as sent
      await snap.ref.update({
        sent: true,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return response;
    } catch (error) {
      console.error("Error sending message:", error);
      await snap.ref.update({
        error: error.message,
        sent: false,
      });
      return null;
    }
  });

// Listen for new alerts and send FCM to police
exports.sendAlertNotification = functions.firestore
  .document("alerts/{alertId}")
  .onCreate(async (snap, context) => {
    const alert = snap.data();

    // Get police officer's FCM token
    const tokenDoc = await admin.firestore()
      .collection("fcmTokens")
      .doc(alert.officerId)
      .get();

    if (!tokenDoc.exists) {
      console.log("No FCM token for officer:", alert.officerId);
      return null;
    }

    const fcmToken = tokenDoc.data().token;

    const message = {
      token: fcmToken,
      notification: {
        title: "🚨 Emergency Alert!",
        body: `Ambulance ${alert.ambulanceId} approaching - ${alert.distance}m away (${alert.severity.toUpperCase()})`,
      },
      data: {
        alertId: context.params.alertId,
        type: "geofence_alert",
        severity: alert.severity,
        ambulanceId: alert.ambulanceId,
        hospital: alert.hospital,
      },
      webpush: {
        notification: {
          icon: "/ambulance-icon.png",
          badge: "/badge-icon.png",
          vibrate: [200, 100, 200, 100, 200],
          requireInteraction: true,
          actions: [
            {
              action: "acknowledge",
              title: "Acknowledge",
            },
            {
              action: "ignore",
              title: "Dismiss",
            },
          ],
        },
      },
    };

    try {
      const response = await admin.messaging().send(message);
      console.log("Alert notification sent:", response);
      return response;
    } catch (error) {
      console.error("Error sending alert notification:", error);
      return null;
    }
  });

// Update police officer location in real-time
exports.updatePoliceLocation = functions.firestore
  .document("policeLocations/{officerId}")
  .onWrite(async (change, context) => {
    const officerId = context.params.officerId;
    const newLocation = change.after.exists ? change.after.data() : null;

    if (!newLocation) {
      console.log("Police officer location deleted:", officerId);
      return null;
    }

    console.log(`Police ${officerId} location updated:`, newLocation);

    // You can add additional logic here, like notifying nearby ambulances
    return null;
  });
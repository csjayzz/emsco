const admin = require('firebase-admin');

/**
 * Firebase Admin SDK initialisation.
 * Reads credentials from environment variables and guards against
 * double-initialisation with the apps.length check.
 */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // The private key in .env has literal "\n" — convert to real newlines
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    })
  });
}

const firestore = admin.firestore();
const messaging = admin.messaging();

module.exports = { admin, firestore, messaging };

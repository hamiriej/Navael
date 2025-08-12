import admin from 'firebase-admin';

let firestoreInstance: admin.firestore.Firestore;
let authInstance: admin.auth.Auth;

if (!admin.apps.length) {
  const serviceAccountKey = process.env.SERVICE_ACCOUNT_KEY; // 🔁 Updated key name

  if (!serviceAccountKey) {
    throw new Error('SERVICE_ACCOUNT_KEY environment variable is not set. Please define it in Firebase Functions secrets or your .env file.');
  }
 

  let serviceAccount: admin.ServiceAccount;

  try {
    const decodedServiceAccountString = Buffer.from(serviceAccountKey, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decodedServiceAccountString);
  } catch (parseError: any) {
    console.error("Error processing SERVICE_ACCOUNT_KEY:", parseError);
    throw new Error(`Failed to decode or parse SERVICE_ACCOUNT_KEY. Ensure it's a valid Base64-encoded JSON string. Details: ${parseError.message}`);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  firestoreInstance = admin.firestore();
  authInstance = admin.auth();

  firestoreInstance.settings({ ignoreUndefinedProperties: true });

  console.log("Firebase Admin SDK initialized successfully.");
} else {
  firestoreInstance = admin.firestore();
  authInstance = admin.auth();
}

export const adminDb = firestoreInstance;
export const adminAuth = authInstance;

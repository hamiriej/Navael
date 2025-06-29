// src/lib/firebase-admin.ts

import admin from 'firebase-admin'; // Import the entire 'firebase-admin' library

// Declare variables to hold our initialized Firestore and Auth instances.
// We declare them with `let` and outside the `if` block so they can be
// assigned within the initialization logic and then exported.
let firestoreInstance: admin.firestore.Firestore;
let authInstance: admin.auth.Auth;

// This is the core "singleton" pattern to ensure Firebase Admin SDK is initialized only once.
// `admin.apps` is an array of all initialized Firebase apps. If it's empty, no app is initialized yet.
// This prevents re-initialization errors, especially common during Next.js development's hot reloading.
if (!admin.apps.length) {
  // Get the Base64 encoded service account key from environment variables.
  // This key is crucial for authenticating your backend with Firebase services.
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  // Crucial check: Always validate that the environment variable is indeed set.
  // If not, it means your .env.local file is missing the key or it's not being loaded correctly.
  if (!serviceAccountKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Please ensure it is defined in your .env.local file and contains your Base64 encoded service account JSON.');
  }

  let serviceAccount: admin.ServiceAccount; // Declare type for clarity of the parsed service account object.

  try {
    // 1. Decode the Base64 string back into a UTF-8 string.
    // This step reverses the encoding you applied when setting up the .env.local file.
    const decodedServiceAccountString = Buffer.from(serviceAccountKey, 'base64').toString('utf8');
    
    // 2. Parse the UTF-8 string into a JavaScript object.
    // This converts the JSON string into a usable JavaScript object.
    serviceAccount = JSON.parse(decodedServiceAccountString);
    
  } catch (parseError: any) {
    // If decoding or JSON parsing fails, we log the error and throw a more descriptive one.
    // This helps in debugging issues related to the format of your FIREBASE_SERVICE_ACCOUNT_KEY.
    console.error("Error processing FIREBASE_SERVICE_ACCOUNT_KEY:", parseError);
    throw new Error(`Failed to decode or parse your FIREBASE_SERVICE_ACCOUNT_KEY. Please ensure it is a valid Base64 encoded JSON string. Details: ${parseError.message}`);
  }

  // Initialize the Firebase Admin SDK using the parsed service account object.
  // `admin.credential.cert(serviceAccount)` creates credentials from the service account object.
  // This is the most direct and commonly used method for server-side authentication.
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // You can add other configurations here if needed, for example:
    // databaseURL: 'https://YOUR_DATABASE_NAME.firebaseio.com', // Required for Realtime Database Admin SDK
    // storageBucket: 'YOUR_STORAGE_BUCKET.appspot.com',       // Required for Cloud Storage Admin SDK
  });

  // Get the initialized Firestore and Authentication instances.
  // These instances are now ready to be used to interact with your Firebase project.
  firestoreInstance = admin.firestore();
  authInstance = admin.auth();

  // Apply Firestore settings. This MUST be called immediately after getting the Firestore instance
  // and before any other Firestore operations.
  // `ignoreUndefinedProperties: true` is highly recommended for Firestore, as it allows
  // storing objects with `undefined` properties without throwing an error (Firestore doesn't store undefined).
  firestoreInstance.settings({ ignoreUndefinedProperties: true });

  // A success message to confirm that the Firebase Admin SDK has been initialized.
  console.log("Firebase Admin SDK initialized successfully.");

} else {
  // If a Firebase app has already been initialized (e.g., this module was imported before),
  // we simply retrieve the existing instances. This ensures efficiency and avoids re-initialization errors.
  // The settings would have already been applied during the first initialization.
  firestoreInstance = admin.firestore();
  authInstance = admin.auth();
  // Optional: console.log("Firebase Admin SDK already initialized. Reusing existing instances.");
}

// Export the initialized services so they can be imported and used by your API routes and other server-side logic.
export const adminDb = firestoreInstance;
export const adminAuth = authInstance;

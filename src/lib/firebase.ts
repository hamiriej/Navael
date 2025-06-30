// src/lib/firebase.ts

// Import the necessary functions and types from the Firebase SDKs
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";

import {
  getFirestore,
  type Firestore,
  Timestamp,
  initializeFirestore,       // Used for granular control over Firestore initialization
  persistentLocalCache,     // For enabling client-side data persistence
  persistentMultipleTabManager // For managing persistence across multiple browser tabs
} from "firebase/firestore";

import { getAuth, type Auth } from "firebase/auth";

// Your Firebase web app's configuration.
// IMPORTANT: These values are read from your environment variables (e.g., .env.local).
// Ensure these variables are correctly set and match your Firebase project's configuration.
// The 'auth/invalid-api-key' error typically means NEXT_PUBLIC_FIREBASE_API_KEY
// is missing or incorrect at runtime.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional: Uncomment if using Analytics
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// Initialize Firebase App only once to prevent multiple app instances,
// which can cause issues with hot reloading in development environments.
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  // If an app instance already exists, retrieve it.
  app = getApp();
}

// Initialize Firebase Authentication.
// The 'auth/invalid-api-key' error usually originates from an incorrect
// apiKey within the firebaseConfig when getAuth() is called.
auth = getAuth(app);

// --- FIRESTORE INITIALIZATION WITH PERSISTENCE ---
// Persistence (localCache) is a client-side feature, so it should only be
// initialized when the code runs in a browser environment (not during SSR).
if (typeof window !== 'undefined') {
  // Option 1: Basic Persistent Cache (single tab by default)
  // This is a simpler setup if you don't need multi-tab synchronization.
  // db = initializeFirestore(app, { localCache: persistentLocalCache() });

  // Option 2: Multi-Tab Persistent Cache (recommended for web apps with multiple tabs)
  // This allows Firestore data to be synchronized across different tabs of your application.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager() // Enables cross-tab synchronization
    })
  });
} else {
  // For Server-Side Rendering (SSR) environments (e.g., Next.js server builds),
  // initialize Firestore without persistence, as it's not applicable on the server.
  db = getFirestore(app);
}
// --- END FIRESTORE INITIALIZATION ---


// Export the initialized Firebase instances for use throughout your application.
export { app, auth, db, Timestamp };

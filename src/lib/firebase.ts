// src/lib/firebase.ts

// Import the functions you need from the Firebase SDKs
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";

import {
  getFirestore,
  type Firestore,
  Timestamp,
  // NO LONGER NEED enableIndexedDbPersistence here
  initializeFirestore, // <--- NEW: Import initializeFirestore
  persistentLocalCache, // <--- NEW: Import persistentLocalCache
  persistentMultipleTabManager // <--- NEW: Import persistentMultipleTabManager (for multi-tab)
} from "firebase/firestore";

import { getAuth, type Auth } from "firebase/auth";

// Your Firebase web app's configuration.
// Use environment variables for security
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// Initialize Firebase only once (important for SSR/Hot Reload)
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

auth = getAuth(app); // Auth can be initialized normally

// --- NEW/MODIFIED CODE FOR FIRESTORE INITIALIZATION ---

// IMPORTANT for Next.js: Firestore initialization with persistence settings
// should only happen on the client-side.
if (typeof window !== 'undefined') {
  // Option 1: Basic Persistent Cache (single tab by default)
  // db = initializeFirestore(app, { localCache: persistentLocalCache() });

  // Option 2: Multi-Tab Persistent Cache (recommended for web apps with multiple tabs)
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager() // Allows persistence across multiple browser tabs
    })
  });
} else {
  // For SSR (server-side rendering), initialize Firestore without persistence
  // as persistence is a client-side feature.
  db = getFirestore(app);
}

// --- END NEW/MODIFIED CODE ---


// We no longer need the async setupFirestorePersistence function
// because persistence is handled directly in initializeFirestore.

// Export Firebase instances
export { app, auth, db, Timestamp };

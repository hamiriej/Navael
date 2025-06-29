// src/firebase/config.ts

import { initializeApp, getApps, getApp } from 'firebase/app'; // Import getApps and getApp
import { getFirestore } from 'firebase/firestore';
// If you're also using Auth, add getAuth:
// import { getAuth } from 'firebase/auth';
// If you're also using Storage, add getStorage:
// import { getStorage } from 'firebase/storage';


// Your Firebase project configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // Make sure you've replaced this!
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
let firebaseApp;
if (!getApps().length) { // Check if no Firebase apps have been initialized
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp(); // If an app already exists, retrieve it
}

// Get a reference to the Firestore service
export const db = getFirestore(firebaseApp);

// Export other services if you need them:
// export const auth = getAuth(firebaseApp);
// export const storage = getStorage(firebaseApp);

// src/firebase/config.ts

import { initializeApp, getApps, getApp } from 'firebase/app'; // Import getApps and getApp
import { getFirestore } from 'firebase/firestore';
// If you're also using Auth, add getAuth:
// import { getAuth } from 'firebase/auth';
// If you're also using Storage, add getStorage:
// import { getStorage } from 'firebase/storage';


// Your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBKm9xhWBogV4Muk3d70rn6_-lo73T2irw",
  authDomain: "navael.firebaseapp.com",
  projectId: "navael",
  storageBucket: "navael.firebasestorage.app",
  messagingSenderId: "36160001734",
  appId: "1:36160001734:web:ee096485297757ec1c29c7"
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

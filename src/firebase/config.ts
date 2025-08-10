// src/firebase/config.ts
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
// If you're also using Auth, add getAuth and Auth:
// import { getAuth, Auth } from 'firebase/auth';
// If you're also using Storage, add getStorage and FirebaseStorage:
// import { getStorage, FirebaseStorage } from 'firebase/storage';

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
let firebaseApp: FirebaseApp | undefined;
let db: Firestore | undefined; // Make db potentially undefined
// let auth: Auth | undefined; // Make auth potentially undefined
// let storage: FirebaseStorage | undefined; // Make storage potentially undefined


// Only initialize Firebase client SDK if in a browser environment
if (typeof window !== 'undefined') {
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApp();
  }

  // Get references to services only if firebaseApp is initialized
  db = getFirestore(firebaseApp);
  // auth = getAuth(firebaseApp);
  // storage = getStorage(firebaseApp);
}

// Export the initialized services (they will be undefined on the server)
export { firebaseApp, db };
// export { firebaseApp, db, auth, storage }; // If you export other services

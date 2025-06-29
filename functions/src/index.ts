// functions/src/index.ts

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK (it automatically uses credentials when deployed to Firebase)
admin.initializeApp();

// Get a reference to Firestore
const db = admin.firestore();

// Define allowed roles (ensure these match your frontend's ALL_ROLES or ROLES)
const ALLOWED_ROLES = ["Administrator", "Doctor", "Nurse", "Receptionist", "Pharmacist", "Lab Technician"];

// Define the expected structure of the data argument for the callable function
interface CreateUserRequestData {
  email: string;
  password: string;
  role: string; // This should match a string from ALLOWED_ROLES
  name: string;
  staffId: string;
}

/**
 * Helper function to work around HttpsError type issues in some TypeScript/Firebase Functions setups.
 * This explicitly casts the HttpsError constructor to 'any' to bypass strict type checking.
 */
function createHttpsError(code: functions.https.FunctionsErrorCode, message: string, details?: unknown): functions.https.HttpsError {
    // We are deliberately casting to 'any' here because some TS configs
    // are incorrectly flagging HttpsError as not constructable.
    return new (functions.https.HttpsError as any)(code, message, details);
}


// This function will be called from your Next.js frontend
// It's an HTTPS Callable function, so it's easy to call from client-side code.
export const createUserWithRole = functions.https.onCall(async (request) => {
  // Extract data and auth context from the request object
  const data = request.data as CreateUserRequestData; // Explicitly cast data to your interface
  const context = request; // The request object itself holds the context (including auth)

  // 1. Authenticate the caller: Only admins should be able to create users
  // This checks if the user making the request is authenticated and has the 'Administrator' role.
  if (!context.auth) {
    throw createHttpsError( // <-- CHANGED
      "unauthenticated",
      "Only authenticated users can create accounts."
    );
  }
  // Fetch the caller's role from Firestore (or custom claims if you've set them up for admins)
  const callerUid = context.auth.uid;
  const callerDoc = await db.collection("users").doc(callerUid).get();
  const callerRole = callerDoc.data()?.role;

  if (callerRole !== "Administrator") {
    throw createHttpsError( // <-- CHANGED
      "permission-denied",
      "Only administrators can create new user accounts."
    );
  }

  // 2. Validate input data
  // Directly use properties from the typed 'data' object
  const { email, password, role, name, staffId } = data;

  if (!email || !password || !role || !name || !staffId) {
    throw createHttpsError( // <-- CHANGED
      "invalid-argument",
      "The function must be called with 'email', 'password', 'role', 'name', and 'staffId'."
    );
  }
  if (!ALLOWED_ROLES.includes(role)) {
    throw createHttpsError( // <-- CHANGED
      "invalid-argument",
      `Invalid role: ${role}. Allowed roles are: ${ALLOWED_ROLES.join(", ")}.`
    );
  }
  if (password.length < 6) {
    throw createHttpsError( // <-- CHANGED
      "invalid-argument",
      "Password must be at least 6 characters long."
    );
  }

  try {
    // 3. Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name,
      emailVerified: true, // You might want to set this to false for new users to verify later
      disabled: false,
    });

    // 4. Store user's profile and role in Firestore
    // We use the user's UID (User ID) from Firebase Auth as the Document ID in Firestore.
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: email,
      name: name,
      role: role,
      staffId: staffId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      // You can add more fields here like department, phone, address, etc.
    });

    // 5. (Optional but recommended) Set custom claims for role
    // Custom claims are useful for role-based security rules and client-side access control.
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: role });

    return {
      uid: userRecord.uid,
      email: userRecord.email,
      role: role,
      message: "User created successfully!",
    };
  } catch (error: any) { // Keeping error: any for now, but in real code, you'd narrow this.
    // Handle Firebase Auth errors (e.g., email already in use)
    if (error.code === 'auth/email-already-exists') {
      throw createHttpsError( // <-- CHANGED
        "already-exists",
        "The email address is already in use by another account."
      );
    }
    console.error("Error creating user:", error);
    throw createHttpsError( // <-- CHANGED
      "internal",
      "Failed to create user. An unexpected error occurred."
    );
  }
});

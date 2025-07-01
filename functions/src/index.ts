// functions/src/index.ts
import * as functions from 'firebase-functions/v2'; // Ensure this is v2 import
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';

// Define the secret parameter.
const serviceAccountSecret = defineSecret('SERVICE_ACCOUNT_KEY');

// This Cloud Function will perform an admin operation, getting the service account key from secrets.
export const performAdminOperation = functions
  .https.onCall(
    // Pass secrets directly in the options object for v2 functions
    { secrets: [serviceAccountSecret] },
    // **KEY CHANGE HERE:** Single 'request' parameter for v2 callable functions
    async (request: functions.https.CallableRequest<any>) => {
      // Data validation
      // Access payload via request.data
      if (!request.data || typeof request.data.payload === 'undefined') {
        throw new functions.https.HttpsError('invalid-argument', 'Payload is required.');
      }

      // Access the secret's value.
      const serviceAccountKeyBase64 = serviceAccountSecret.value();

      if (!serviceAccountKeyBase64) {
        throw new functions.https.HttpsError('internal', 'SERVICE_ACCOUNT_KEY secret not found or accessible.');
      }

      let app: admin.app.App | undefined; // Declare app outside try-catch for finally block

      try {
        // Initialize admin SDK using the key *within this function*
        const serviceAccount = JSON.parse(
          Buffer.from(serviceAccountKeyBase64, 'base64').toString('ascii')
        );

        const appName = `adminApp_${Date.now()}`; // Unique name for this app instance

        // More robust Admin SDK initialization: try to get existing, or initialize if not found
        try {
          app = admin.app(appName); // Try to get an already initialized app by this name
        } catch (e) {
          // If app doesn't exist, initialize it
          app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            // You might need to specify other options like databaseURL, storageBucket if using other services
          }, appName);
        }

        const firestore = app.firestore();
        // Perform your Firestore Admin SDK operation here
        // Access payload via request.data.payload
        const docRef = await firestore.collection('someCollection').add(request.data.payload); // Example operation
        return { success: true, docId: docRef.id };

      } catch (error: unknown) { // Explicitly type catch variable as unknown
        console.error("Error in Cloud Function admin operation:", error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) { // Safely check error type
          errorMessage = error.message;
        }
        throw new functions.https.HttpsError('internal', 'Admin operation failed', errorMessage);
      } finally {
        // Clean up the temporary app instance if created and if it's not the default app
        if (app && app.name !== '[DEFAULT]') {
          await app.delete();
        }
      }
    }
  );

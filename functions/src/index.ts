// functions/src/index.ts

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

// --- IMPORTANT ---
// Initialize the Firebase Admin SDK once globally when your Cloud Functions environment starts.
// This makes `admin.firestore()`, `admin.auth()`, etc., available to all your functions.
// You do NOT need to re-initialize it inside each function for typical operations on the same project.
admin.initializeApp();

const db = admin.firestore(); // Get a reference to your Firestore database

// --- Your previous 'performAdminOperation' function (if you still want it for other purposes) ---
// You can keep it, but it's separate from the payment sync logic.
// const serviceAccountSecret = defineSecret('SERVICE_ACCOUNT_KEY'); // Only needed if still using this pattern

/*
export const performAdminOperation = functions
  .https.onCall(
    { secrets: [serviceAccountSecret] },
    async (request: functions.https.CallableRequest<any>) => {
      // ... (your existing code for performAdminOperation)
    }
  );
*/
// --- End of example for performAdminOperation ---


/**
 * Cloud Function triggered when an invoice document is updated.
 * It checks if the invoice's payment status has changed to 'Paid' and updates the
 * corresponding appointment's paymentStatus field in Firestore.
 */
export const syncInvoicePaymentStatusToAppointment = functions.firestore.onDocumentUpdated(
  // Specify the path to listen for updates. '{invoiceId}' is a wildcard for any document ID.
  'invoices/{invoiceId}',
  async (event) => {
    // For v2 functions, event.data contains the change object (before and after snapshots)
    const snapshot = event.data;

    // Exit if the snapshot data is missing (e.g., if the document was deleted)
    if (!snapshot) {
      console.log('No data associated with the Firestore update event. Exiting.');
      return; // Return explicitly for v2 functions
    }

    const newValue = snapshot.after.data(); // The new state of the document
    const oldValue = snapshot.before.data(); // The state of the document before the update

    // Safety checks: ensure both old and new data exist
    if (!newValue || !oldValue) {
      console.log('Missing data in event snapshots (old or new). Exiting.');
      return;
    }

    const newAmountPaid = newValue.amountPaid || 0;
    const totalAmount = newValue.totalAmount || 0;
    const invoiceId = snapshot.after.id; // Correct way to access the document ID

    // Determine the payment status before the update
    const oldAmountPaid = oldValue.amountPaid || 0;
    const wasPaid = oldAmountPaid >= totalAmount;

    // Determine the payment status after the update
    const isNowPaid = newAmountPaid >= totalAmount;

    // --- Logic to sync status to Appointment ---
    // Scenario 1: Invoice just became fully paid (wasn't paid, now is)
    if (!wasPaid && isNowPaid) {
      console.log(`Invoice ${invoiceId} is now fully paid. Updating associated appointments.`);

      try {
        // Query the 'appointments' collection to find all appointments linked to this invoice.
        // Assumes your appointment documents have an 'invoiceId' field.
        const appointmentsRef = db.collection('appointments');
        const querySnapshot = await appointmentsRef
          .where('invoiceId', '==', invoiceId)
          .get();

        if (querySnapshot.empty) {
          console.log(`No appointments found linked to invoice ${invoiceId}.`);
          return;
        }

        // Use a Firestore batch to update multiple appointments efficiently and atomically.
        const batch = db.batch();
        querySnapshot.forEach(doc => {
          console.log(`Adding appointment ${doc.id} to batch update for 'Paid' status.`);
          batch.update(doc.ref, { paymentStatus: 'Paid' });
        });

        await batch.commit(); // Commit all updates in the batch
        console.log(`Successfully updated paymentStatus to 'Paid' for ${querySnapshot.size} appointment(s) for invoice ${invoiceId}.`);

      } catch (error) {
        console.error(`Error updating appointments for invoice ${invoiceId}:`, error);
        // Re-throw the error to indicate function failure to Cloud Functions logging.
        throw error;
      }
    }
    // Scenario 2 (Optional): Handle invoice becoming unpaid (e.g., refund, adjustment)
    else if (wasPaid && !isNowPaid) {
      console.log(`Invoice ${invoiceId} transitioned from paid to unpaid. Reverting appointment status if applicable.`);
      try {
        const appointmentsRef = db.collection('appointments');
        const querySnapshot = await appointmentsRef
          .where('invoiceId', '==', invoiceId)
          .get();

        if (querySnapshot.empty) {
          console.log(`No appointments found linked to invoice ${invoiceId} for status reversion.`);
          return;
        }

        // Determine the new appropriate payment status for the appointment
        const newAppointmentStatus = newAmountPaid > 0 ? 'Partially Paid' : 'Pending Payment';
        const batch = db.batch();
        querySnapshot.forEach(doc => {
          console.log(`Adding appointment ${doc.id} to batch update for '${newAppointmentStatus}' status.`);
          batch.update(doc.ref, { paymentStatus: newAppointmentStatus });
        });

        await batch.commit();
        console.log(`Successfully updated paymentStatus for ${querySnapshot.size} appointment(s) to '${newAppointmentStatus}' for invoice ${invoiceId}.`);

      } catch (error) {
        console.error(`Error reverting appointment status for invoice ${invoiceId}:`, error);
        throw error;
      }
    }
    // Scenario 3: No relevant payment status change for appointments
    else {
      console.log(`Invoice ${invoiceId} update did not trigger a relevant payment status change for appointments.`);
    }

    return; // All v2 functions should return explicitly
  }
);

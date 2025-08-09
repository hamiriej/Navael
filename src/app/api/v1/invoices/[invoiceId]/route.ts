// app/api/v1/invoices/[invoiceId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore'; // Import FieldValue for advanced updates

// --- Firebase Admin SDK Initialization ---
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

// --- PATCH Handler: Update a specific Invoice ---
export async function PATCH(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const { invoiceId } = params;

  try {
    const updatedData: Partial<any> = await request.json();

    console.log(`--- Processing PATCH request for Invoice ID: ${invoiceId} ---`);
    console.log(`Received update data from client:`, JSON.stringify(updatedData, null, 2));

    if (updatedData.status) {
      console.log(`Attempting to set 'status' to: ${updatedData.status}`);
    } else {
      console.warn(`No 'status' field found in the received update data for invoice ${invoiceId}.`);
    }

    const dataToUpdate = {
      ...updatedData,
      updatedAt: FieldValue.serverTimestamp(),
    };

    const invoiceRef = db.collection('invoices').doc(invoiceId);
    const docSnapshot = await invoiceRef.get();
    if (!docSnapshot.exists) {
      console.warn(`Invoice document with ID ${invoiceId} not found in Firestore. Cannot update.`);
      return NextResponse.json({ message: 'Invoice not found.' }, { status: 404 });
    }

    // Perform the update operation on the invoice.
    await invoiceRef.update(dataToUpdate);
    console.log(`Invoice ${invoiceId} successfully updated in Firestore.`);

    // --- NEW LOGIC: Update related Lab Orders if invoice status is "Paid" ---
    if (updatedData.status === "Paid") { // Check if the invoice is being marked as Paid
      try {
        console.log(`Invoice ${invoiceId} status is 'Paid'. Querying for linked Lab Orders...`);
        const labOrdersRef = db.collection("labOrders"); // Reference to your labOrders collection
        // Query for lab orders where the 'invoiceId' field matches the current invoiceId
        const q = labOrdersRef.where("invoiceId", "==", invoiceId);
        const querySnapshot = await q.get(); // Execute the query

        if (!querySnapshot.empty) {
          // Use a batch write for atomic updates to multiple lab orders
          const batch = db.batch();
          let updatedCount = 0;

          querySnapshot.forEach((labOrderDoc) => {
            const labOrderRef = labOrdersRef.doc(labOrderDoc.id);
            // Add the update operation for each found lab order to the batch
            batch.update(labOrderRef, { paymentStatus: "Paid" });
            updatedCount++;
            console.log(`Adding LabOrder ${labOrderDoc.id} to batch update with paymentStatus: 'Paid'.`);
          });

          await batch.commit(); // Commit all updates in the batch
          console.log(`Successfully updated paymentStatus to 'Paid' for ${updatedCount} Lab Order(s) linked to Invoice ${invoiceId}.`);
        } else {
          console.log(`No Lab Order(s) found linked to Invoice ${invoiceId} (no 'invoiceId' field match).`);
        }
      } catch (labOrderUpdateError: any) {
        // Log any errors specific to the lab order update, but don't prevent the invoice update from succeeding.
        console.error(`ERROR updating related Lab Order paymentStatus for Invoice ${invoiceId}:`, labOrderUpdateError);
        // You might want to return a more detailed error or log it to a monitoring service.
      }
    }
    // --- END NEW LOGIC ---

    // Fetch and return the updated document's current state (good practice to confirm server-side changes).
    const updatedDocSnapshot = await invoiceRef.get();
    const updatedInvoice = updatedDocSnapshot.exists ? { id: updatedDocSnapshot.id, ...updatedDocSnapshot.data() } : null;

    return NextResponse.json(
      { message: 'Invoice and related data updated successfully!', updatedInvoice: updatedInvoice },
      { status: 200 }
    );

  } catch (error: any) {
    console.error(`ERROR in PATCH /api/v1/invoices/${invoiceId}:`, error);
    return NextResponse.json(
      { message: 'Failed to update invoice.', error: error.message || 'An unknown error occurred.' },
      { status: 500 }
    );
  }
}

// --- GET Handler: Fetch a specific Invoice by ID ---
export async function GET(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const { invoiceId } = params;

  try {
    const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();

    if (!invoiceDoc.exists) {
      console.warn(`Invoice ${invoiceId} not found.`);
      return NextResponse.json({ message: 'Invoice not found.' }, { status: 404 });
    }

    console.log(`Successfully fetched Invoice ${invoiceId}.`);
    return NextResponse.json({ id: invoiceDoc.id, ...invoiceDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`ERROR fetching invoice ${invoiceId}:`, error);
    return NextResponse.json(
      { message: 'Failed to retrieve invoice.', error: error.message },
      { status: 500 }
    );
  }
}

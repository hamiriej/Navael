// app/api/v1/lab/orders/[orderId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore'; // Import FieldValue for advanced updates

// --- Firebase Admin SDK Initialization ---
// This ensures that the Admin SDK is initialized only once across your serverless functions
// when they are invoked.
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore(); // Get a Firestore instance to interact with your database

// --- PATCH Handler: Update a specific Lab Order ---
// This function will handle HTTP PATCH requests to /api/v1/lab/orders/[orderId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } } // Next.js automatically provides dynamic segments in 'params'
) {
  // Extract the orderId from the URL parameters
const { orderId } = await params;

  try {
    // 1. Parse the request body:
    // The client sends the updated data as a JSON object in the request body.
    // We use await request.json() to parse this into a JavaScript object.
    const updatedData: Partial<any> = await request.json(); 
    // We use Partial<any> because the incoming data might only contain some fields,
    // not necessarily all fields of a complete LabOrder object.

    console.log(`--- Processing PATCH request for Lab Order ID: ${orderId} ---`);
    console.log(`Received data for update:`, JSON.stringify(updatedData, null, 2));

    // Optional: Add server-side validation here
    // Example: if (!updatedData.status) {
    //   return NextResponse.json({ message: 'Status is required for update.' }, { status: 400 });
    // }

    // Optional: Add a timestamp to the updated document
    // This is a common practice to track when a document was last modified.
    const dataToUpdate = {
      ...updatedData,
      updatedAt: FieldValue.serverTimestamp(), // Use Firestore's server-side timestamp
    };

    // 2. Reference the specific document in Firestore:
    // We use the extracted 'orderId' to target the exact document we want to update.
    const labOrderRef = db.collection('labOrders').doc(orderId);

    // 3. Perform the update operation:
    // db.update() is ideal for PATCH requests as it only modifies the fields
    // provided in 'dataToUpdate' and leaves other fields in the document untouched.
    // If the document does not exist, this operation will fail.
    await labOrderRef.update(dataToUpdate);

    console.log(`Lab Order ${orderId} successfully updated in Firestore.`);

    // 4. (Optional but recommended) Fetch the updated document to return it:
    // After a successful update, it's often useful to send back the *current* state
    // of the document to the client, especially if server-side updates (like timestamps)
    // or Cloud Functions triggers modify the document further.
    const updatedDocSnapshot = await labOrderRef.get();
    const updatedLabOrder = updatedDocSnapshot.exists ? { id: updatedDocSnapshot.id, ...updatedDocSnapshot.data() } : null;

    // 5. Send a success response back to the client:
    // We send back the full updated object or a success message.
    return NextResponse.json(
      { message: 'Lab order updated successfully!', updatedLabOrder: updatedLabOrder },
      { status: 200 }
    );

  } catch (error: any) {
    console.error(`ERROR updating lab order ${orderId}:`, error);

    // Send an error response back to the client
    return NextResponse.json(
      { message: 'Failed to update lab order.', error: error.message },
      { status: 500 }
    );
  }
}

// --- GET Handler: Fetch a specific Lab Order by ID (often useful with PATCH) ---
// This function will handle HTTP GET requests to /api/v1/lab/orders/[orderId]
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
const { orderId } = await params;

  try {
    const labOrderDoc = await db.collection('labOrders').doc(orderId).get();

    if (!labOrderDoc.exists) {
      console.warn(`Lab order ${orderId} not found.`);
      return NextResponse.json({ message: 'Lab order not found.' }, { status: 404 });
    }

    console.log(`Successfully fetched Lab Order ${orderId}.`);
    return NextResponse.json({ id: labOrderDoc.id, ...labOrderDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`ERROR fetching lab order ${orderId}:`, error);
    return NextResponse.json(
      { message: 'Failed to retrieve lab order.', error: error.message },
      { status: 500 }
    );
  }
}

// --- POST Handler: Create a new Lab Order (for completeness) ---
// This function handles HTTP POST requests to /api/v1/lab/orders/ (no ID in URL)
// You would place this in a separate file: I/api/v1/lab/orders/route.ts
/*
export async function POST(request: NextRequest) {
  try {
    const newOrderData = await request.json();
    console.log('Received data for new lab order:', JSON.stringify(newOrderData, null, 2));

    const dataToCreate = {
      ...newOrderData,
      orderDate: FieldValue.serverTimestamp(), // Set creation timestamp
      status: newOrderData.status || 'Pending', // Default status
      // Add other default fields or validation
    };

    const docRef = await db.collection('labOrders').add(dataToCreate);
    
    // Fetch the created document to include server-generated fields like timestamps
    const createdDocSnapshot = await docRef.get();
    const createdLabOrder = { id: createdDocSnapshot.id, ...createdDocSnapshot.data() };

    console.log(`New Lab Order created with ID: ${docRef.id}`);
    return NextResponse.json(
      { message: 'Lab order created successfully!', labOrder: createdLabOrder },
      { status: 201 } // 201 Created status
    );

  } catch (error: any) {
    console.error('ERROR creating lab order:', error);
    return NextResponse.json(
      { message: 'Failed to create lab order.', error: error.message },
      { status: 500 }
    );
  }
}
*/

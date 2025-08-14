// app/api/v1/lab/orders/route.ts

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Assuming you have initialized adminDb here
import { firestore } from 'firebase-admin'; // Import firestore to use Timestamp

// --- Interfaces for type safety ---

// Define the shape of a LabOrder object as it would be received from the frontend
// or sent back after processing (with 'id' and timestamps as strings for the frontend).
// You should ensure this matches your frontend's LabOrder interface.
interface LabOrder {
  id: string; // The generated LABYYYY-NNNNN ID
  patientId: string;
  patientName: string;
  tests: Array<{
    testName: string;
    status: string; // e.g., "Pending", "Processing", "Completed"
    // Add other test details like results, normalRanges, units etc.
  }>;
  status: string; //j Overall lab order status (e.g., "Ordered", "Received", "Results Available")
  clinicalNotes?: string;
  invoiceId?: string | null;
  orderDate: string; // YYYY-MM-DD string for frontend (originally a timestamp)
  createdAt: string; // ISO string for frontend
  updatedAt: string; // ISO string for frontend
  // Add any other lab order specific fields here
}

// Define the shape of a LabOrder object as it is stored in Firestore.
// Note that createdAt, updatedAt, and orderDate are Firestore Timestamps here.
interface StoredLabOrder extends Omit<LabOrder, 'orderDate' | 'createdAt' | 'updatedAt'> {
  orderDate: firestore.Timestamp;
  createdAt: firestore.Timestamp;
  updatedAt: firestore.Timestamp;
}

// --- POST /api/v1/lab/orders ---
// Handles creation of a new lab order with LABYYYY-NNNNN ID
export async function POST(request: Request) {
  try {
    // Data from the frontend, without 'id', and with client-side timestamps as strings
    const newOrderData: Omit<LabOrder, 'id' | 'createdAt' | 'updatedAt' | 'orderDate'> = await request.json();

    // Basic validation
    if (!newOrderData.patientId || !newOrderData.patientName || !newOrderData.tests || newOrderData.tests.length === 0) {
      return NextResponse.json(
        { message: "Missing required lab order data (patientId, patientName, tests)." },
        { status: 400 } // Bad Request
      );
    }

    // --- Lab Order ID Generation Logic ---
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const monthId = `${year}-${month}`;

    // Use a single document to store monthly counters for lab orders, consistent with patient IDs
    const labOrderCounterDocRef = adminDb.collection('sequences').doc('lab_orders');

    let generatedLabOrderId: string | undefined;
    let orderToStoreInFirestore: StoredLabOrder | undefined;
    let nextNumber = 1;

    await adminDb.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(labOrderCounterDocRef);

    if (counterDoc.exists) {
        const data = counterDoc.data();
        const monthSequence = data?.[monthId] || 0;
        nextNumber = monthSequence + 1;
      }

      // This will create the document if it doesn't exist, or update the
      // specific month's counter.
      transaction.set(labOrderCounterDocRef, { [monthId]: nextNumber }, { merge: true });

      // Format the sequential number to be NNNNN (e.g., 00001, 00010, 00123)
      const formattedNumber = String(nextNumber).padStart(5, '0');
      generatedLabOrderId = `LAB${year}-${month}-${formattedNumber}`;

      // Prepare the lab order data for Firestore storage
      // Use firestore.Timestamp.now() directly for timestamps as we are in a transaction
      orderToStoreInFirestore = {
        ...newOrderData,
        id: generatedLabOrderId, // Assign the newly generated ID
        status: newOrderData.status || "Ordered", // Default status
        orderDate: firestore.Timestamp.now(), // Server-side timestamp for the order date
        createdAt: firestore.Timestamp.now(), // Server-side timestamp for creation
        updatedAt: firestore.Timestamp.now(), // Server-side timestamp for last update
        invoiceId: newOrderData.invoiceId || null,
      } as StoredLabOrder; // Cast to the StoredLabOrder interface

      // Set the new lab order document in the 'labOrders' collection using the generated ID
      const labOrderDocRef = adminDb.collection('labOrders').doc(generatedLabOrderId);
      transaction.set(labOrderDocRef, orderToStoreInFirestore);
    });

    // --- End Lab Order ID Generation Logic ---

    if (!generatedLabOrderId || !orderToStoreInFirestore) {
        throw new Error('Failed to generate lab order ID or prepare order data after transaction.');
    }

    // Prepare the response for the frontend, converting Timestamps back to ISO strings
    const responseOrder: LabOrder = {
      ...orderToStoreInFirestore,
      orderDate: orderToStoreInFirestore.orderDate.toDate().toISOString(),
      createdAt: orderToStoreInFirestore.createdAt.toDate().toISOString(),
      updatedAt: orderToStoreInFirestore.updatedAt.toDate().toISOString(),
    };

    return NextResponse.json(responseOrder, { status: 201 }); // 201 Created
  } catch (error: any) {
    console.error("Error creating lab order:", error);
    return NextResponse.json(
      { message: "Failed to create lab order.", error: error.message },
      { status: 500 } // Internal Server Error
    );
  }
}

// --- GET /api/v1/lab/orders ---
// This handles the initial fetch of all lab orders for your context
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId'); // For fetching orders for a specific patient

    let query: firestore.Query = adminDb.collection('labOrders'); // Type query for better safety

    if (patientId) {
      query = query.where('patientId', '==', patientId);
    }

    // Order by 'orderDate', newest first (which is now a Firestore Timestamp)
    const snapshot = await query.orderBy('orderDate', 'desc').get();
    const labOrders: LabOrder[] = []; // Use the LabOrder interface for the array

    snapshot.forEach(doc => {
      const data = doc.data();

      // Safely convert Firestore Timestamps to ISO strings for frontend consistency
      let orderDateValue: string | undefined;
      if (data.orderDate instanceof firestore.Timestamp) {
        orderDateValue = data.orderDate.toDate().toISOString();
      } else if (typeof data.orderDate === 'string') { // Fallback for older string data if any
        orderDateValue = data.orderDate;
      }

      let createdAtValue: string | undefined;
      if (data.createdAt instanceof firestore.Timestamp) {
        createdAtValue = data.createdAt.toDate().toISOString();
      } else if (typeof data.createdAt === 'string') { // Fallback for older string data if any
        createdAtValue = data.createdAt;
      }

      let updatedAtValue: string | undefined;
      if (data.updatedAt instanceof firestore.Timestamp) {
        updatedAtValue = data.updatedAt.toDate().toISOString();
      } else if (typeof data.updatedAt === 'string') { // Fallback for older string data if any
        updatedAtValue = data.updatedAt;
      }

      labOrders.push({
        id: doc.id, // This will be the LABYYYY-NNNNN ID
        patientId: data.patientId,
        patientName: data.patientName,
        tests: data.tests || [],
        status: data.status,
        clinicalNotes: data.clinicalNotes || undefined,
        invoiceId: data.invoiceId || null,
        orderDate: orderDateValue || '', // Ensure it's a string, default to empty if unexpected
        createdAt: createdAtValue || '',
        updatedAt: updatedAtValue || '',
        // Add any other fields from your lab order document here that are part of LabOrder interface
      } as LabOrder);
    });

    return NextResponse.json(labOrders, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching lab orders:", error);
    return NextResponse.json(
      { message: "Failed to fetch lab orders.", error: error.message },
      { status: 500 }
    );
  }
}

// --- GET /api/v1/lab/orders/[orderId] ---
// You'll also need a dynamic route for fetching a single order by ID
// This would be at: app/api/v1/lab/orders/[orderId]/route.ts (or pages/api/v1/lab/[orderId].ts)
// The content would be similar to the GET handler above, but query by doc.id
/*
// For Next.js App Router, this would typically be in app/api/v1/lab/orders/[orderId]/route.ts
export async function GET(request: Request, { params }: { params: { orderId: string } }) {
  try {
    const { orderId } = params;
    const doc = await adminDb.collection('labOrders').doc(orderId).get();

    if (!doc.exists) {
      return NextResponse.json({ message: "Lab order not found." }, { status: 404 });
    }

    const data = doc.data();

    let orderDateValue: string | undefined;
    if (data.orderDate instanceof firestore.Timestamp) {
      orderDateValue = data.orderDate.toDate().toISOString();
    } else if (typeof data.orderDate === 'string') {
      orderDateValue = data.orderDate;
    }

    let createdAtValue: string | undefined;
    if (data.createdAt instanceof firestore.Timestamp) {
      createdAtValue = data.createdAt.toDate().toISOString();
    } else if (typeof data.createdAt === 'string') {
      createdAtValue = data.createdAt;
    }

    let updatedAtValue: string | undefined;
    if (data.updatedAt instanceof firestore.Timestamp) {
      updatedAtValue = data.updatedAt.toDate().toISOString();
    } else if (typeof data.updatedAt === 'string') {
      updatedAtValue = data.updatedAt;
    }

    const responseOrder: LabOrder = {
      id: doc.id,
      patientId: data.patientId,
      patientName: data.patientName,
      tests: data.tests || [],
      status: data.status,
      clinicalNotes: data.clinicalNotes || undefined,
      invoiceId: data.invoiceId || null,
      orderDate: orderDateValue || '',
      createdAt: createdAtValue || '',
      updatedAt: updatedAtValue || '',
    } as LabOrder; // Cast to ensure all fields are present as per LabOrder interface

    return NextResponse.json(responseOrder, { status: 200 });

  } catch (error: any) {
    console.error("Error fetching single lab order:", error);
    return NextResponse.json(
      { message: "Failed to fetch lab order.", error: error.message },
      { status: 500 }
    );
  }
}
*/

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Assuming you have initialized adminDb here
import { FieldValue } from 'firebase-admin/firestore'; // For server timestamps

// --- POST /api/v1/lab/orders ---
export async function POST(request: Request) {
  try {
    const newOrderData = await request.json();

    // Basic validation (you can expand this with Zod if needed)
    if (!newOrderData.patientId || !newOrderData.patientName || !newOrderData.tests || newOrderData.tests.length === 0) {
      return NextResponse.json(
        { message: "Missing required lab order data (patientId, patientName, tests)." },
        { status: 400 } // Bad Request
      );
    }

    // Add server-side timestamp for creation
    const orderToSave = {
      ...newOrderData,
      orderDate: FieldValue.serverTimestamp(), // Use server timestamp for accuracy
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      invoiceId: newOrderData.invoiceId || null,
      // Ensure other fields like status, clinicalNotes, invoiceId, etc. are handled
    };

    // Save the new lab order to Firestore
    const docRef = await adminDb.collection('labOrders').add(orderToSave);

    // Return the created order with its new ID
    const createdOrder = { id: docRef.id, ...newOrderData }; // newOrderData won't have serverTimestamp yet,
                                                             // but the client-side LabOrder type might expect it.
                                                             // For full accuracy, you might fetch the doc again:
                                                             // const fullDoc = await docRef.get();
                                                             // return NextResponse.json({ id: fullDoc.id, ...fullDoc.data() }, { status: 201 });


    return NextResponse.json(createdOrder, { status: 201 }); // 201 Created
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

    let query: any = adminDb.collection('labOrders');

    if (patientId) {
      query = query.where('patientId', '==', patientId);
    }

    const snapshot = await query.orderBy('orderDate', 'desc').get(); // Order by date, newest first
    const labOrders: any[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      // Convert Firestore Timestamps to ISO strings for consistency if needed
      const orderDate = data.orderDate ? (data.orderDate.toDate ? data.orderDate.toDate().toISOString() : data.orderDate) : null;
      labOrders.push({ id: doc.id, ...data, orderDate });
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
export async function GET(request: Request, { params }: { params: { orderId: string } }) {
  try {
    const { orderId } = params;
    const doc = await adminDb.collection('labOrders').doc(orderId).get();

    if (!doc.exists) {
      return NextResponse.json({ message: "Lab order not found." }, { status: 404 });
    }

    const data = doc.data();
    const orderDate = data?.orderDate ? (data.orderDate.toDate ? data.orderDate.toDate().toISOString() : data.orderDate) : null;
    return NextResponse.json({ id: doc.id, ...data, orderDate }, { status: 200 });

  } catch (error: any) {
    console.error("Error fetching single lab order:", error);
    return NextResponse.json(
      { message: "Failed to fetch lab order.", error: error.message },
      { status: 500 }
    );
  }
}
*/

// app/api/v1/invoices/route.ts

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Assuming your Firebase Admin SDK is initialized here
import { firestore } from 'firebase-admin'; // Import firestore to use Timestamp

// --- Interfaces for type safety ---

// Define the shape of an Invoice object as it would be received from the frontend
// or sent back after processing (with 'id' and 'createdAt' as strings for the frontend).
// You might already have a similar interface defined in your frontend project.
interface Invoice {
  id: string; // The generated INVYYYY-NNNNN ID
  patientId: string;
  patientName: string;
  totalAmount: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  status: string; // e.g., "Pending Payment", "Paid", "Cancelled"
  date: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  amountPaid: number;
  taxRate: number;
  taxAmount: number;
  createdAt: string; // ISO string for frontend
  updatedAt: string; // ISO string for frontend
  // Add any other invoice fields here
}

// Define the shape of an Invoice object as it is stored in Firestore.
// Note that createdAt and updatedAt are Firestore Timestamps here.
interface StoredInvoice extends Omit<Invoice, 'createdAt' | 'updatedAt'> {
  createdAt: firestore.Timestamp;
  updatedAt: firestore.Timestamp;
}

// --- POST /api/v1/invoices ---
// Handles creation of a new invoice with INVYYYY-NNNNN ID
export async function POST(request: Request) {
  try {
    // Data from the frontend, without 'id', 'createdAt', 'updatedAt' as they are generated server-side
    const newInvoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = await request.json();

    // Basic validation: Ensure crucial fields are present and not empty
    if (
      !newInvoiceData.patientId || typeof newInvoiceData.patientId !== 'string' || newInvoiceData.patientId.trim() === '' ||
      !newInvoiceData.patientName || typeof newInvoiceData.patientName !== 'string' || newInvoiceData.patientName.trim() === '' ||
      !newInvoiceData.totalAmount || typeof newInvoiceData.totalAmount !== 'number' || newInvoiceData.totalAmount < 0 ||
      !newInvoiceData.lineItems || !Array.isArray(newInvoiceData.lineItems) || newInvoiceData.lineItems.length === 0
    ) {
      return NextResponse.json(
        { message: "Missing or invalid required invoice data (patientId, patientName, totalAmount, lineItems)." },
        { status: 400 } // Bad Request
      );
    }

    // --- Invoice ID Generation Logic ---
    const currentYear = new Date().getFullYear();
    // Use a specific collection for invoice counters to keep them separate from patient counters
    const invoiceCounterDocRef = adminDb.collection('invoice_sequences').doc(String(currentYear));

    let generatedInvoiceId: string | undefined;
    let invoiceToStoreInFirestore: StoredInvoice | undefined;

    await adminDb.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(invoiceCounterDocRef);
      let nextNumber: number;

      if (!counterDoc.exists) {
        // If it's the very first invoice for this year, start the counter at 1
        nextNumber = 1;
        transaction.set(invoiceCounterDocRef, { lastNumber: nextNumber });
      } else {
        const data = counterDoc.data();
        if (data && typeof data.lastNumber === 'number') {
          nextNumber = data.lastNumber + 1;
          transaction.update(invoiceCounterDocRef, { lastNumber: nextNumber });
        } else {
          // This should ideally not happen if your counter document is managed correctly
          throw new Error('Invalid lastNumber found in invoice counter document. Please check Firestore "invoice_sequences" collection for year ' + currentYear);
        }
      }

      // Format the sequential number to be NNNNN (e.g., 00001, 00010, 00123)
      const formattedNumber = String(nextNumber).padStart(5, '0');
      generatedInvoiceId = `INV${currentYear}-${formattedNumber}`;

      // Prepare the invoice data for Firestore storage
      // Use firestore.Timestamp.now() directly for timestamps as we are in a transaction
      invoiceToStoreInFirestore = {
        ...newInvoiceData,
        id: generatedInvoiceId, // Assign the newly generated ID
        createdAt: firestore.Timestamp.now(), // Server-side timestamp
        updatedAt: firestore.Timestamp.now(), // Server-side timestamp
        status: newInvoiceData.status || "Pending Payment",
        date: newInvoiceData.date || new Date().toISOString().split('T')[0],
        dueDate: newInvoiceData.dueDate || new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
        amountPaid: newInvoiceData.amountPaid || 0,
        taxRate: newInvoiceData.taxRate || 0,
        taxAmount: newInvoiceData.taxAmount || 0,
      } as StoredInvoice;

      // Set the new invoice document in the 'invoices' collection using the generated ID
      const invoiceDocRef = adminDb.collection('invoices').doc(generatedInvoiceId);
      transaction.set(invoiceDocRef, invoiceToStoreInFirestore);
    });

    // --- End Invoice ID Generation Logic ---

    if (!generatedInvoiceId || !invoiceToStoreInFirestore) {
        throw new Error('Failed to generate invoice ID or prepare invoice data after transaction.');
    }

    // Prepare the response for the frontend, converting Timestamps back to ISO strings
    const responseInvoice: Invoice = {
      ...invoiceToStoreInFirestore,
      createdAt: invoiceToStoreInFirestore.createdAt.toDate().toISOString(),
      updatedAt: invoiceToStoreInFirestore.updatedAt.toDate().toISOString(),
    };

    return NextResponse.json(responseInvoice, { status: 201 }); // 201 Created
  } catch (error: any) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { message: "Failed to create invoice.", error: error.message },
      { status: 500 } // Internal Server Error
    );
  }
}

// --- GET /api/v1/invoices ---
// Handles fetching all invoices, or filtering by patientId
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');

    let query: firestore.Query = adminDb.collection('invoices');

    // Filter by patientId if provided
    if (patientId) {
      query = query.where('patientId', '==', patientId);
    }

    // Order by date, newest first
    // Note: If 'date' is stored as YYYY-MM-DD string, direct string comparison usually works for sorting.
    // If you ever change 'date' to a Timestamp, this would still work.
    const snapshot = await query.orderBy('date', 'desc').get();

    const invoices: Invoice[] = []; // Use the Invoice interface for the array
    snapshot.forEach(doc => {
      const data = doc.data();

      // Safely convert Firestore Timestamps to ISO strings for frontend consistency
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

      invoices.push({
        id: doc.id,
        patientId: data.patientId,
        patientName: data.patientName,
        totalAmount: data.totalAmount,
        lineItems: data.lineItems || [],
        status: data.status,
        date: data.date,
        dueDate: data.dueDate,
        amountPaid: data.amountPaid,
        taxRate: data.taxRate,
        taxAmount: data.taxAmount,
        createdAt: createdAtValue || '', // Ensure it's a string, default to empty if unexpected
        updatedAt: updatedAtValue || '', // Ensure it's a string, default to empty if unexpected
        // Add any other fields from your invoice document here
      } as Invoice);
    });

    return NextResponse.json(invoices, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { message: "Failed to fetch invoices.", error: error.message },
      { status: 500 } // Internal Server Error
    );
  }
}

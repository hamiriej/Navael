// app/api/v1/invoices/route.ts

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Assuming your Firebase Admin SDK is initialized here
import { FieldValue } from 'firebase-admin/firestore';

// --- POST /api/v1/invoices ---
// Handles creation of a new invoice
export async function POST(request: Request) {
  try {
    const newInvoiceData = await request.json();

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

    // Add server-side timestamps for creation and update
    const invoiceToSave = {
      ...newInvoiceData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      // Ensure default status if not provided, or convert client-side date formats if needed
      status: newInvoiceData.status || "Pending Payment", // Default status
      date: newInvoiceData.date || new Date().toISOString().split('T')[0], // Ensure date format YYYY-MM-DD
      dueDate: newInvoiceData.dueDate || new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0], // Default due date
      amountPaid: newInvoiceData.amountPaid || 0, // Default amount paid
      taxRate: newInvoiceData.taxRate || 0,
      taxAmount: newInvoiceData.taxAmount || 0,
    };

    // Save the new invoice to Firestore
    const docRef = await adminDb.collection('invoices').add(invoiceToSave);

    // Fetch the complete document from Firestore to include server-generated timestamps and ID
    const createdDoc = await docRef.get();
    const createdInvoice = { id: createdDoc.id, ...createdDoc.data() };

    return NextResponse.json(createdInvoice, { status: 201 }); // 201 Created
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

    let query: any = adminDb.collection('invoices');

    // Filter by patientId if provided
    if (patientId) {
      query = query.where('patientId', '==', patientId);
    }

    // Order by date, newest first (assuming 'date' field exists and is sortable)
    // If 'date' is a string in YYYY-MM-DD format, direct string comparison usually works for sorting.
    // Otherwise, convert to Firestore Timestamp or use createdAt.
    const snapshot = await query.orderBy('date', 'desc').get();

    const invoices: any[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Convert Firestore Timestamps to ISO strings for consistency if needed
      // (e.g., createdAt, updatedAt)
      const createdAt = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null;
      const updatedAt = data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt) : null;

      invoices.push({ id: doc.id, ...data, createdAt, updatedAt });
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


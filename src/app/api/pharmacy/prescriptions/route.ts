// This is the file: pages/api/pharmacy/prescriptions.ts

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { z } from 'zod';

const PrescriptionSchema = z.object({
  id: z.string().optional(), // `id` is for frontend interface and read operations, not for POST body validation
  patientId: z.string().min(1, "Patient ID is required"),
  patientName: z.string().min(1, "Patient name is required"),
  // REMOVE the 'medications' array wrapper
  // And move its inner properties directly into the PrescriptionSchema
  medicationName: z.string().min(1, "Medication name required"), // <-- ADDED
  dosage: z.string().min(1, "Dosage is required"),               // <-- ADDED
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"), // <-- ADDED
  instructions: z.string().optional(),                           // <-- ADDED
  // Note: medicationId is not sent by frontend in this context, only medicationName.
  // If you need medicationId in your database for this single prescription entry,
  // you'd need to add it to your frontend's `prescriptionData` object first.
  // For now, based on your frontend's `prescriptionData`, we'll include what's sent.


  prescribedBy: z.string().min(1, "Prescriber name is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/, "Invalid date format (YYYY-MM-DD or ISO)"),
  status: z.enum(["Pending", "Filled", "Cancelled", "Ready for Pickup", "Dispensed"], { message: "Invalid prescription status" }),
  isBilled: z.boolean(),
  invoiceId: z.string().optional(),
  paymentStatus: z.enum(["Pending Payment", "Paid", "N/A"]).optional(),
  refillable: z.boolean(),
  refillsRemaining: z.coerce.number().int().min(0).optional(),
});

// REMAINING PART OF YOUR API ROUTE (GET, POST etc.) is unchanged,
// but the POST handler will now successfully validate the incoming body.
// The GET handler will fetch documents with this structure.

// GET all prescriptions
export async function GET() {
  try {
    const prescriptionsRef = adminDb.collection('prescriptions');
    const snapshot = await prescriptionsRef.get();

    const prescriptions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(prescriptions);
  } catch (error: any) {
    console.error("Error fetching prescriptions:", error);
    return NextResponse.json({ message: "Failed to fetch prescriptions", error: error.message }, { status: 500 });
  }
}

// POST add new prescription
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // After changing PrescriptionSchema above, this validation should now pass for the frontend's incoming data
    const result = PrescriptionSchema.omit({ id: true }).safeParse(body);

    if (!result.success) {
      console.error("Validation error adding prescription:", result.error.flatten());
      return NextResponse.json({ message: "Invalid prescription data", errors: result.error.flatten().fieldErrors }, { status: 400 });
    }

    const newPrescriptionData = result.data;
    const docRef = await adminDb.collection('prescriptions').add(newPrescriptionData);

    return NextResponse.json({ id: docRef.id, ...newPrescriptionData }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding prescription:", error);
    return NextResponse.json({ message: "Failed to add prescription", error: error.message }, { status: 500 });
  }
}

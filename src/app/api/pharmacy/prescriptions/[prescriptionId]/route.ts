// src/app/api/pharmacy/prescriptions/[prescriptionId]/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { z } from 'zod';

// Schema for partial updates of a prescription (PATCH)
const UpdatePrescriptionSchema = z.object({
  patientId: z.string().min(1).optional(),
  patientName: z.string().min(1).optional(),
  medicationName: z.string().min(1).optional(),
  dosage: z.string().min(1).optional(),
  quantity: z.coerce.number().int().min(1).optional(),
  instructions: z.string().optional(),
  prescribedBy: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/).optional(),
  status: z.enum(["Pending", "Filled", "Cancelled", "Ready for Pickup", "Dispensed"]).optional(),
  isBilled: z.boolean().optional(),
  invoiceId: z.string().optional(),
  paymentStatus: z.enum(["Pending Payment", "Paid", "N/A"]).optional(),
  refillable: z.boolean().optional(),
  refillsRemaining: z.coerce.number().int().min(0).optional(),
});

// Helper: check if a document exists, return 404 if not
async function ensureDocExists(docRef: FirebaseFirestore.DocumentReference) {
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return null;
  }
  return docSnap;
}

// GET /api/pharmacy/prescriptions/[prescriptionId]
export async function GET(
  request: Request,
  { params }: { params: { prescriptionId: string } }
) {
  const prescriptionId = params.prescriptionId;
  try {
    const docRef = adminDb.collection('prescriptions').doc(prescriptionId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ message: "Prescription not found" }, { status: 404 });
    }

    return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error: any) {
    console.error(`Error fetching prescription ${prescriptionId}:`, error);
    return NextResponse.json({ message: "Failed to fetch prescription", error: error.message }, { status: 500 });
  }
}


// PATCH handler to update prescription
export async function PATCH(
  request: Request,
  { params }: { params: { prescriptionId: string } }
) {
  const prescriptionId = params.prescriptionId;
  try {
    const body = await request.json();
    const parsed = UpdatePrescriptionSchema.safeParse(body);

    if (!parsed.success) {
      console.error(`Validation failed for prescription update ${prescriptionId}`, parsed.error.flatten());
      return NextResponse.json(
        { message: "Invalid update data", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updates = parsed.data;
    const docRef = adminDb.collection('prescriptions').doc(prescriptionId);

    // Confirm document exists before updating
    const existingDoc = await ensureDocExists(docRef);
    if (!existingDoc) {
      return NextResponse.json({ message: "Prescription not found" }, { status: 404 });
    }

    await docRef.update(updates);

    const updatedDoc = await docRef.get();

    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error: any) {
    console.error(`Failed to update prescription ${prescriptionId}:`, error);
    return NextResponse.json({ message: "Failed to update prescription", error: error.message }, { status: 500 });
  }
}

// DELETE handler to remove prescription
export async function DELETE(
  request: Request,
  { params }: { params: { prescriptionId: string } }
) {
  const prescriptionId = params.prescriptionId;
  try {
    const docRef = adminDb.collection('prescriptions').doc(prescriptionId);

    const existingDoc = await ensureDocExists(docRef);
    if (!existingDoc) {
      return NextResponse.json({ message: "Prescription not found" }, { status: 404 });
    }

    await docRef.delete();

    return NextResponse.json(null, { status: 204 });
  } catch (error: any) {
    console.error(`Failed to delete prescription ${prescriptionId}:`, error);
    return NextResponse.json({ message: "Failed to delete prescription", error: error.message }, { status: 500 });
  }
}

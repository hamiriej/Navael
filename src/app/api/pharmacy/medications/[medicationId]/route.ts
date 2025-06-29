// src/app/api/pharmacy/medications/[medicationId]/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Your initialized Firebase Admin Firestore instance
import { z } from 'zod'; // Make sure Zod is installed and imported

// MedicationSchema is NOT needed here. It belongs in route.ts for POST.

// Define Zod schema for Medication updates (all fields optional for PATCH)
// This schema should match what you expect to receive for partial updates.
const UpdateMedicationSchema = z.object({
  name: z.string().min(1, "Medication name is required").optional(),
  dosage: z.string().min(1, "Dosage is required").optional(),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative").optional(), // Ensure 'stock' is here and optional
  category: z.string().min(1, "Category is required").optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/, "Invalid expiry date format (YYYY-MM-DD or ISO)").optional(),
  status: z.enum(["In Stock", "Low Stock", "Out of Stock"], { message: "Invalid stock status" }).optional(),
  supplier: z.string().optional(),
  pricePerUnit: z.coerce.number().min(0, "Price per unit cannot be negative").optional(), // Ensure 'pricePerUnit' is here and optional
});

// GET /api/pharmacy/medications/[medicationId]
export async function GET(
  request: Request,
  { params }: { params: { medicationId: string } } // params is expected here for dynamic route
) {
  const medicationId = params.medicationId; // Access the medicationId from params
  try {
    const docRef = adminDb.collection('medications').doc(medicationId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.warn(`Medication ${medicationId} not found.`);
      return NextResponse.json({ message: "Medication not found" }, { status: 404 });
    }

    // Return the medication data including its ID
    return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error: any) {
    console.error(`Error fetching medication ${medicationId}:`, error);
    return NextResponse.json({ message: "Failed to fetch medication", error: error.message }, { status: 500 });
  }
}

// PATCH /api/pharmacy/medications/[medicationId]
export async function PATCH(
  request: Request,
  { params }: { params: { medicationId: string } }
) {
  const medicationId = params.medicationId;
  try {
    const body = await request.json();
    const result = UpdateMedicationSchema.safeParse(body);

    if (!result.success) {
      console.error(`Validation Error updating medication ${medicationId}:`, result.error.flatten());
      return NextResponse.json({ message: "Invalid update data", errors: result.error.flatten().fieldErrors }, { status: 400 });
    }

    const updates = result.data;

    // Optional: Recalculate status based on new stock if 'stock' is being updated
    if (updates.stock !== undefined) {
        if (updates.stock <= 0) {
            updates.status = "Out of Stock";
        } else if (updates.stock < 10) { // Example threshold for 'Low Stock'
            updates.status = "Low Stock";
        } else {
            updates.status = "In Stock";
        }
    }

    const docRef = adminDb.collection('medications').doc(medicationId);
    await docRef.update(updates); // Update specific fields in Firestore

    // Fetch and return the updated document to the client
    const updatedDoc = await docRef.get();
    if (!updatedDoc.exists) {
        return NextResponse.json({ message: "Medication not found after update" }, { status: 404 });
    }

    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error: any) {
    console.error(`Error updating medication ${medicationId}:`, error);
    return NextResponse.json({ message: "Failed to update medication", error: error.message }, { status: 500 });
  }
}

// DELETE /api/pharmacy/medications/[medicationId]
export async function DELETE(
  request: Request,
  { params }: { params: { medicationId: string } }
) {
  const medicationId = params.medicationId;
  try {
    const docRef = adminDb.collection('medications').doc(medicationId);
    await docRef.delete();

    return NextResponse.json(null, { status: 204 }); // 204 No Content
  } catch (error: any) {
    console.error(`Error deleting medication ${medicationId}:`, error);
    if (error.code === 'not-found') { // Firestore specific error code for doc not found
        return NextResponse.json({ message: "Medication not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Failed to delete medication", error: error.message }, { status: 500 });
  }
}

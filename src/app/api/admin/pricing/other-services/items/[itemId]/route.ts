
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Your initialized Firebase Admin Firestore instance
import { z } from 'zod'; // For validation

// Zod schema for updating a general service (all fields optional for PATCH)
const updateOtherGeneralServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").optional(),
  price: z.coerce.number().min(0.01, "Price must be positive").optional(),
});

const OTHER_SERVICES_STORAGE_KEY = 'navael_pricing_other_services';

interface OtherServiceApi { // Keep simple interface for API routes
  id: string;
  name: string;
  price: number;
}

function getOtherServicesFromStorage(): OtherServiceApi[] {
  if (typeof localStorage === 'undefined') return [];
  const storedData = localStorage.getItem(OTHER_SERVICES_STORAGE_KEY);
  try { return storedData ? JSON.parse(storedData) : []; }
  catch (e) { return []; }
}

function saveOtherServicesToStorage(services: OtherServiceApi[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(OTHER_SERVICES_STORAGE_KEY, JSON.stringify(services));
}

// PATCH /api/admin/pricing/other-services/items/[itemId]
// Updates an existing general service in Firestore
export async function PATCH(
  request: Request,
  { params }: { params: { itemId: string } }
) {
  const itemId = params.itemId;
  try {
    const body = await request.json();
    const validationResult = updateOtherGeneralServiceSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(`Validation Error updating other general service ${itemId}:`, validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid service data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const updates = validationResult.data;

    const docRef = adminDb.collection('pricing').doc('otherServicesData').collection('items').doc(itemId);
    await docRef.update(updates);

    // Fetch and return the updated document
    const updatedDoc = await docRef.get();
    if (!updatedDoc.exists) {
        return NextResponse.json({ message: "Other general service not found after update" }, { status: 404 });
    }

    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error: any) {
    console.error(`Error updating other general service ${itemId}:`, error);
    return NextResponse.json({ message: "Failed to update service", error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/pricing/other-services/items/[itemId]
// Deletes a general service from Firestore
export async function DELETE(
  request: Request,
  { params }: { params: { itemId: string } }
) {
  const itemId = params.itemId;
  try {
    const docRef = adminDb.collection('pricing').doc('otherServicesData').collection('items').doc(itemId);
    await docRef.delete();

    return NextResponse.json(null, { status: 204 }); // 204 No Content on successful deletion
  } catch (error: any) {
    console.error(`Error deleting other general service ${itemId}:`, error);
    if (error.code === 'not-found') { // Firestore specific error code for doc not found
        return NextResponse.json({ message: "Other general service not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Failed to delete service", error: error.message }, { status: 500 });
  }
}
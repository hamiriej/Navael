
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Your initialized Firebase Admin Firestore instance
import { z } from 'zod'; // For validation

// Zod schema for updating a ward tariff (all fields optional for PATCH)
const updateWardTariffSchema = z.object({
  wardName: z.string().min(1, "Ward/Room type name is required").optional(),
  perDiemRate: z.coerce.number().min(0.01, "Per diem rate must be positive").optional(),
});

const WARD_TARIFFS_STORAGE_KEY = 'navael_pricing_ward_tariffs';

interface WardTariffApi { // Keep simple interface for API routes
  id: string;
  wardName: string;
  perDiemRate: number;
}

function getWardTariffsFromStorage(): WardTariffApi[] {
  if (typeof localStorage === 'undefined') return [];
  const storedData = localStorage.getItem(WARD_TARIFFS_STORAGE_KEY);
  try { return storedData ? JSON.parse(storedData) : []; }
  catch (e) { return []; }
}

function saveWardTariffsToStorage(tariffs: WardTariffApi[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(WARD_TARIFFS_STORAGE_KEY, JSON.stringify(tariffs));
}

// PATCH /api/admin/pricing/ward-tariffs/items/[itemId]
// Updates an existing ward tariff in Firestore
export async function PATCH(
  request: Request,
  { params }: { params: { itemId: string } }
) {
  const itemId = params.itemId;
  try {
    const body = await request.json();
    const validationResult = updateWardTariffSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(`Validation Error updating ward tariff ${itemId}:`, validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid ward tariff data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const updates = validationResult.data;

    const docRef = adminDb.collection('pricing').doc('wardTariffsData').collection('items').doc(itemId);
    await docRef.update(updates);

    // Fetch and return the updated document
    const updatedDoc = await docRef.get();
    if (!updatedDoc.exists) {
        return NextResponse.json({ message: "Ward tariff not found after update" }, { status: 404 });
    }

    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error: any) {
    console.error(`Error updating ward tariff ${itemId}:`, error);
    return NextResponse.json({ message: "Failed to update ward tariff", error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/pricing/ward-tariffs/items/[itemId]
// Deletes a ward tariff from Firestore
export async function DELETE(
  request: Request,
  { params }: { params: { itemId: string } }
) {
  const itemId = params.itemId;
  try {
    const docRef = adminDb.collection('pricing').doc('wardTariffsData').collection('items').doc(itemId);
    await docRef.delete();

    return NextResponse.json(null, { status: 204 }); // 204 No Content on successful deletion
  } catch (error: any) {
    console.error(`Error deleting ward tariff ${itemId}:`, error);
    if (error.code === 'not-found') { // Firestore specific error code for doc not found
        return NextResponse.json({ message: "Ward tariff not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Failed to delete ward tariff", error: error.message }, { status: 500 });
  }
}
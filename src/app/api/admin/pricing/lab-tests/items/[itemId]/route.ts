
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';

const LAB_TESTS_STORAGE_KEY = 'navael_pricing_lab_tests';

const updateLabTestSchema = z.object({
  name: z.string().min(1, "Test name is required").optional(),
  price: z.coerce.number().min(0.01, "Price must be positive").optional(),
});

// Base schema for what constitutes a lab test from the API's perspective
const editableLabTestApiSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Test name is required"),
  price: z.coerce.number().min(0, "Price cannot be negative"),
});
type EditableLabTestApi = z.infer<typeof editableLabTestApiSchema>;

function getLabTestsFromStorage(): EditableLabTestApi[] {
  if (typeof localStorage === 'undefined') return [];
  const storedData = localStorage.getItem(LAB_TESTS_STORAGE_KEY);
  try { return storedData ? JSON.parse(storedData) : []; }
  catch (e) { return []; }
}

function saveLabTestsToStorage(tests: EditableLabTestApi[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LAB_TESTS_STORAGE_KEY, JSON.stringify(tests));
}

// PATCH /api/admin/pricing/lab-tests/items/[itemId]
// Updates an existing lab test in Firestore
export async function PATCH(
  request: Request,
  { params }: { params: { itemId: string } }
) {
  const itemId = params.itemId;
  try {
    const body = await request.json();
    const validationResult = updateLabTestSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(`Validation Error updating lab test ${itemId}:`, validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid lab test data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const updates = validationResult.data;

    const docRef = adminDb.collection('pricing').doc('labTestsData').collection('items').doc(itemId);
    await docRef.update(updates);

    // Fetch and return the updated document
    const updatedDoc = await docRef.get();
    if (!updatedDoc.exists) {
        return NextResponse.json({ message: "Lab test not found after update" }, { status: 404 });
    }

    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error: any) {
    console.error(`Error updating lab test ${itemId}:`, error);
    return NextResponse.json({ message: "Failed to update lab test", error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/pricing/lab-tests/items/[itemId]
// Deletes a lab test from Firestore
export async function DELETE(
  request: Request,
  { params }: { params: { itemId: string } }
) {
  const itemId = params.itemId;
  try {
    const docRef = adminDb.collection('pricing').doc('labTestsData').collection('items').doc(itemId);
    await docRef.delete();

    return NextResponse.json(null, { status: 204 }); // 204 No Content on successful deletion
  } catch (error: any) {
    console.error(`Error deleting lab test ${itemId}:`, error);
    if (error.code === 'not-found') { // Firestore specific error code for doc not found
        return NextResponse.json({ message: "Lab test not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Failed to delete lab test", error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin'; // Your initialized Firebase Admin Firestore instance

const LAB_TESTS_STORAGE_KEY = 'navael_pricing_lab_tests';
const newLabTestSchema = z.object({
  name: z.string().min(1, "Test name is required"),
  price: z.coerce.number().min(0.01, "Price must be positive"),
});

// Base schema for what constitutes a lab test from the API's perspective
const editableLabTestApiSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Test name is required"),
  price: z.coerce.number().min(0, "Price cannot be negative"),
});
type EditableLabTestApi = z.infer<typeof editableLabTestApiSchema>;

// Schema for creating a new lab test (ID will be generated)
const newLabTestApiSchema = z.object({
  name: z.string().min(1, "Test name is required"),
  price: z.coerce.number().min(0.01, "Price must be positive"),
});

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



// POST /api/admin/pricing/lab-tests/items
// Adds a new lab test to Firestore
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationResult = newLabTestSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("Validation Error adding lab test:", validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid lab test data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const newLabTest = validationResult.data;

    // Add document to Firestore, letting Firestore generate the ID
    const docRef = await adminDb.collection('pricing').doc('labTestsData').collection('items').add(newLabTest);
    // You could also use .doc().set({ ...newLabTest, id: generatedId }) if you want to store the ID inside the document.

    // Return the newly created item with its Firestore-generated ID
    return NextResponse.json({ id: docRef.id, ...newLabTest }, { status: 201 }); // 201 Created
  } catch (error: any) {
    console.error("Error adding lab test:", error);
    return NextResponse.json({ message: "Failed to add lab test", error: error.message }, { status: 500 });
  }
}
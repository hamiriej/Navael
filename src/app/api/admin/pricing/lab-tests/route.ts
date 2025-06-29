
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin'; // Your initialized Firebase Admin Firestore instance

const LAB_TESTS_STORAGE_KEY = 'navael_pricing_lab_tests';

// Default if nothing in storage
const DEFAULT_LAB_TESTS: EditableLabTestApi[] = [
    {id: "LAB_CBC_API", name: "Complete Blood Count (CBC) - API Default", price: 25.00},
    {id: "LAB_LIPID_API", name: "Lipid Panel - API Default", price: 40.00},
];

const editableLabTestApiSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Test name is required"),
  price: z.coerce.number().min(0, "Price cannot be negative"),
});
type EditableLabTestApi = z.infer<typeof editableLabTestApiSchema>;

function getLabTestsFromStorage(): EditableLabTestApi[] {
  if (typeof localStorage === 'undefined') {
    console.warn("localStorage unavailable in lab-tests API route. Returning defaults.");
    return DEFAULT_LAB_TESTS;
  }
  const storedData = localStorage.getItem(LAB_TESTS_STORAGE_KEY);
  try {
    return storedData ? JSON.parse(storedData) : DEFAULT_LAB_TESTS;
  } catch (e) {
    console.error("Error parsing lab tests from storage in API:", e);
    return DEFAULT_LAB_TESTS;
  }
}

function saveLabTestsToStorage(tests: EditableLabTestApi[]) {
  if (typeof localStorage === 'undefined') {
    console.warn("localStorage unavailable in lab-tests API route. Cannot save.");
    return;
  }
  try {
    localStorage.setItem(LAB_TESTS_STORAGE_KEY, JSON.stringify(tests));
  } catch (e) {
    console.error("Error saving lab tests to storage in API:", e);
  }


}

// GET /api/admin/pricing/lab-tests
// Fetches all lab tests from Firestore
export async function GET() {
  try {
    const labTestsRef = adminDb.collection('pricing').doc('labTestsData').collection('items'); // Or directly 'lab-tests' collection
    const snapshot = await labTestsRef.get();
    
    const labTests: { id: string; name: string; price: number; }[] = [];
    snapshot.forEach(doc => {
      labTests.push({ id: doc.id, ...doc.data() } as { id: string; name: string; price: number; });
    });

    return NextResponse.json(labTests);
  } catch (error: any) {
    console.error("Error fetching lab tests:", error);
    return NextResponse.json({ message: "Failed to fetch lab tests", error: error.message }, { status: 500 });
  }
}




// This POST handler replaces the entire list of lab tests.
// For individual item additions/deletions, separate routes /items and /items/:itemId would be better.
export async function POST(request: Request) {
  // TODO: Implement real authorization
  try {
    const body = await request.json();
    // Expecting an array of lab tests
    const validationResult = z.array(editableLabTestApiSchema).safeParse(body);

    if (!validationResult.success) {
      console.error("API POST /admin/pricing/lab-tests - Validation Error:", validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid lab tests data array", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const testsData = validationResult.data;
    saveLabTestsToStorage(testsData);
    return NextResponse.json(testsData, { status: 200 });

  } catch (error: any) {
    console.error("API POST /admin/pricing/lab-tests - Unhandled Error:", error);
    return NextResponse.json({ message: error.message || "Failed to update lab tests", error: error.toString() }, { status: 500 });
  }
}

    
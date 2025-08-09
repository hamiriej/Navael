import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin'; // Your initialized Firebase Admin Firestore instance

const editableLabTestApiSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Test name is required"),
  price: z.coerce.number().min(0, "Price cannot be negative"),
});
type EditableLabTestApi = z.infer<typeof editableLabTestApiSchema>;

// GET /api/admin/pricing/lab-tests
export async function GET() {
  try {
    const labTestsRef = adminDb
      .collection('pricing')
      .doc('labTestsData')
      .collection('items');

    const snapshot = await labTestsRef.get();
    const labTests: EditableLabTestApi[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      labTests.push({ id: doc.id, name: data.name, price: data.price });
    });

    return NextResponse.json(labTests);
  } catch (error: any) {
    console.error("Error fetching lab tests:", error);
    return NextResponse.json(
      { message: "Failed to fetch lab tests", error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/admin/pricing/lab-tests
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationResult = z.array(editableLabTestApiSchema).safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          message: "Invalid lab tests data array",
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const testsData = validationResult.data;

    // Save each test to Firestore
    const batch = adminDb.batch();
    const collectionRef = adminDb
      .collection('pricing')
      .doc('labTestsData')
      .collection('items');

    // Clear existing tests first (optional)
    const existing = await collectionRef.get();
    existing.forEach(doc => batch.delete(doc.ref));

    // Add new ones
    testsData.forEach(test => {
      const docRef = collectionRef.doc(test.id);
      batch.set(docRef, { name: test.name, price: test.price });
    });

    await batch.commit();

    return NextResponse.json(testsData, { status: 200 });
  } catch (error: any) {
    console.error("API POST /admin/pricing/lab-tests - Unhandled Error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to update lab tests", error: error.toString() },
      { status: 500 }
    );
  }
}
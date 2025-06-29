
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Your initialized Firebase Admin Firestore instance
import { z } from 'zod';



const OTHER_SERVICES_STORAGE_KEY = 'navael_pricing_other_services';

// Zod schema for adding a new general service
const newOtherGeneralServiceSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  price: z.coerce.number().min(0.01, "Price must be positive"),
});

const otherServiceApiSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Service name is required"),
  price: z.coerce.number().min(0, "Price cannot be negative"),
});
type OtherServiceApi = z.infer<typeof otherServiceApiSchema>;

const newOtherServiceApiSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  price: z.coerce.number().min(0.01, "Price must be positive"),
});

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

// POST /api/admin/pricing/other-services/items
// Adds a new other general service to Firestore
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationResult = newOtherGeneralServiceSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("Validation Error adding other general service:", validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid service data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const newService = validationResult.data;

    // Add document to Firestore, letting Firestore generate the ID
    const docRef = await adminDb.collection('pricing').doc('otherServicesData').collection('items').add(newService);

    // Return the newly created item with its Firestore-generated ID
    return NextResponse.json({ id: docRef.id, ...newService }, { status: 201 }); // 201 Created
  } catch (error: any) {
    console.error("Error adding other general service:", error);
    return NextResponse.json({ message: "Failed to add service", error: error.message }, { status: 500 });
  }
}

    
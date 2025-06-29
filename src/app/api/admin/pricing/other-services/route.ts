
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin'; // Your initialized Firebase Admin Firestore instance

const OTHER_SERVICES_STORAGE_KEY = 'navael_pricing_other_services';
const DEFAULT_OTHER_SERVICES: OtherServiceApi[] = [
    {id: "SERV_DRESSING_API", name: "Wound Dressing - Small (API Default)", price: 20.00},
    {id: "SERV_INJECTION_API", name: "Injection Administration (API Default)", price: 10.00},
];

const otherServiceApiSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Service name is required"),
  price: z.coerce.number().min(0, "Price cannot be negative"),
});
type OtherServiceApi = z.infer<typeof otherServiceApiSchema>;

function getOtherServicesFromStorage(): OtherServiceApi[] {
  if (typeof localStorage === 'undefined') {
    console.warn("localStorage unavailable in other-services API route. Returning defaults.");
    return DEFAULT_OTHER_SERVICES;
  }
  const storedData = localStorage.getItem(OTHER_SERVICES_STORAGE_KEY);
  try {
    return storedData ? JSON.parse(storedData) : DEFAULT_OTHER_SERVICES;
  } catch (e) {
    console.error("Error parsing other services from storage in API:", e);
    return DEFAULT_OTHER_SERVICES;
  }
}

function saveOtherServicesToStorage(services: OtherServiceApi[]) {
  if (typeof localStorage === 'undefined') {
    console.warn("localStorage unavailable in other-services API route. Cannot save.");
    return;
  }
  localStorage.setItem(OTHER_SERVICES_STORAGE_KEY, JSON.stringify(services));
}

// GET /api/admin/pricing/other-services
// Fetches all other general services from Firestore
export async function GET() {
  try {
    const otherServicesRef = adminDb.collection('pricing').doc('otherServicesData').collection('items');
    const snapshot = await otherServicesRef.get();
    
    const otherServices: { id: string; name: string; price: number; }[] = [];
    snapshot.forEach(doc => {
      otherServices.push({ id: doc.id, ...doc.data() } as { id: string; name: string; price: number; });
    });

    return NextResponse.json(otherServices);
  } catch (error: any) {
    console.error("Error fetching other general services:", error);
    return NextResponse.json({ message: "Failed to fetch other general services", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) { // Replaces entire list
  // TODO: Implement real authorization
  try {
    const body = await request.json();
    const validationResult = z.array(otherServiceApiSchema).safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ message: "Invalid other services data array", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }
    saveOtherServicesToStorage(validationResult.data);
    return NextResponse.json(validationResult.data, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to update other services", error: error.toString() }, { status: 500 });
  }
}

    
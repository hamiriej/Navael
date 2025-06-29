
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin'; // Your initialized Firebase Admin Firestore instance

const WARD_TARIFFS_STORAGE_KEY = 'navael_pricing_ward_tariffs';
const DEFAULT_WARD_TARIFFS: WardTariffApi[] = [
    {id: "WARD_GEN_API", wardName: "General Ward (API Default)", perDiemRate: 100.00},
    {id: "WARD_PRIVATE_API", wardName: "Private Room (API Default)", perDiemRate: 250.00},
];

const wardTariffApiSchema = z.object({
  id: z.string(),
  wardName: z.string().min(1, "Ward/Room Type name is required"),
  perDiemRate: z.coerce.number().min(0, "Rate cannot be negative"),
});
type WardTariffApi = z.infer<typeof wardTariffApiSchema>;

function getWardTariffsFromStorage(): WardTariffApi[] {
  if (typeof localStorage === 'undefined') {
    console.warn("localStorage unavailable in ward-tariffs API route. Returning defaults.");
    return DEFAULT_WARD_TARIFFS;
  }
  const storedData = localStorage.getItem(WARD_TARIFFS_STORAGE_KEY);
  try {
    return storedData ? JSON.parse(storedData) : DEFAULT_WARD_TARIFFS;
  } catch (e) {
    console.error("Error parsing ward tariffs from storage in API:", e);
    return DEFAULT_WARD_TARIFFS;
  }
}

function saveWardTariffsToStorage(tariffs: WardTariffApi[]) {
  if (typeof localStorage === 'undefined') {
     console.warn("localStorage unavailable in ward-tariffs API route. Cannot save.");
    return;
  }
  localStorage.setItem(WARD_TARIFFS_STORAGE_KEY, JSON.stringify(tariffs));
}

// GET /api/admin/pricing/ward-tariffs
// Fetches all ward tariffs from Firestore
export async function GET() {
  try {
    const wardTariffsRef = adminDb.collection('pricing').doc('wardTariffsData').collection('items');
    const snapshot = await wardTariffsRef.get();
    
    const wardTariffs: { id: string; wardName: string; perDiemRate: number; }[] = [];
    snapshot.forEach(doc => {
      wardTariffs.push({ id: doc.id, ...doc.data() } as { id: string; wardName: string; perDiemRate: number; });
    });

    return NextResponse.json(wardTariffs);
  } catch (error: any) {
    console.error("Error fetching ward tariffs:", error);
    return NextResponse.json({ message: "Failed to fetch ward tariffs", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) { // Replaces entire list
  // TODO: Implement real authorization
  try {
    const body = await request.json();
    const validationResult = z.array(wardTariffApiSchema).safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ message: "Invalid ward tariffs data array", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }
    saveWardTariffsToStorage(validationResult.data);
    return NextResponse.json(validationResult.data, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to update ward tariffs", error: error.toString() }, { status: 500 });
  }
}

    
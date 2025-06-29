
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin'; // Your initialized Firebase Admin Firestore instance

const WARD_TARIFFS_STORAGE_KEY = 'navael_pricing_ward_tariffs';
// Zod schema for adding a new ward tariff
const newWardTariffSchema = z.object({
  wardName: z.string().min(1, "Ward/Room type name is required"),
  perDiemRate: z.coerce.number().min(0.01, "Per diem rate must be positive"),
});

const wardTariffApiSchema = z.object({
  id: z.string(),
  wardName: z.string().min(1, "Ward/Room Type name is required"),
  perDiemRate: z.coerce.number().min(0, "Rate cannot be negative"),
});
type WardTariffApi = z.infer<typeof wardTariffApiSchema>;

const newWardTariffApiSchema = z.object({
  wardName: z.string().min(1, "Ward/Room Type name is required"),
  perDiemRate: z.coerce.number().min(0.01, "Per diem rate must be positive"),
});

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

// POST /api/admin/pricing/ward-tariffs/items
// Adds a new ward tariff to Firestore
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationResult = newWardTariffSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("Validation Error adding ward tariff:", validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid ward tariff data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const newTariff = validationResult.data;

    // Add document to Firestore, letting Firestore generate the ID
    const docRef = await adminDb.collection('pricing').doc('wardTariffsData').collection('items').add(newTariff);

    // Return the newly created item with its Firestore-generated ID
    return NextResponse.json({ id: docRef.id, ...newTariff }, { status: 201 }); // 201 Created
  } catch (error: any) {
    console.error("Error adding ward tariff:", error);
    return NextResponse.json({ message: "Failed to add ward tariff", error: error.message }, { status: 500 });
  }
}
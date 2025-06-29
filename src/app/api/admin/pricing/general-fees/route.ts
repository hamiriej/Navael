
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin'; // Your initialized Firebase Admin Firestore instance

// Zod schema for general fees (should match your frontend's `generalFeesSchema`)
const generalFeesSchema = z.object({
  consultationFee: z.coerce.number().min(0, "Fee cannot be negative"),
  checkupFee: z.coerce.number().min(0, "Fee cannot be negative"),
});

const GENERAL_FEES_STORAGE_KEY = 'navael_pricing_general_fees';

// Default values if nothing in storage
const DEFAULT_GENERAL_FEES = { consultationFee: 75, checkupFee: 50 };

const generalFeesApiSchema = z.object({
  consultationFee: z.coerce.number().min(0, "Fee cannot be negative"),
  checkupFee: z.coerce.number().min(0, "Fee cannot be negative"),
});
type GeneralFeesApiValues = z.infer<typeof generalFeesApiSchema>;

function getGeneralFeesFromStorage(): GeneralFeesApiValues {
  if (typeof localStorage === 'undefined') {
    console.warn("localStorage unavailable in general-fees API route. Returning defaults.");
    return DEFAULT_GENERAL_FEES;
  }
  const storedData = localStorage.getItem(GENERAL_FEES_STORAGE_KEY);
  try {
    return storedData ? JSON.parse(storedData) : DEFAULT_GENERAL_FEES;
  } catch (e) {
    console.error("Error parsing general fees from storage in API:", e);
    return DEFAULT_GENERAL_FEES;
  }
}

function saveGeneralFeesToStorage(fees: GeneralFeesApiValues) {
  if (typeof localStorage === 'undefined') {
    console.warn("localStorage unavailable in general-fees API route. Cannot save.");
    return;
  }
  try {
    localStorage.setItem(GENERAL_FEES_STORAGE_KEY, JSON.stringify(fees));
  } catch (e) {
    console.error("Error saving general fees to storage in API:", e);
  }
}

// GET /api/admin/pricing/general-fees
// Fetches general service fees from Firestore
export async function GET() {
  try {
    const docRef = adminDb.collection('pricing').doc('generalFees');
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      // Return the stored fees
      return NextResponse.json(docSnap.data());
    } else {
      // If document doesn't exist, return default values or an empty object
      // Frontend (ServicePricingPage) has fallbacks for this.
      console.warn("General fees document not found in Firestore. Returning empty object.");
      return NextResponse.json({}); // Or a default structure if you want the API to provide it
    }
  } catch (error: any) {
    console.error("Error fetching general fees:", error);
    return NextResponse.json({ message: "Failed to fetch general fees", error: error.message }, { status: 500 });
  }
}

// POST /api/admin/pricing/general-fees
// Updates general service fees in Firestore
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationResult = generalFeesSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("Validation Error updating general fees:", validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid general fees data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const updatedFees = validationResult.data;

    const docRef = adminDb.collection('pricing').doc('generalFees');
    // Using `set` with `merge: true` will update specified fields without overwriting the entire document.
    // If the document doesn't exist, it will create it.
    await docRef.set(updatedFees, { merge: true });

    return NextResponse.json(updatedFees); // Return the saved data
  } catch (error: any) {
    console.error("Error updating general fees:", error);
    return NextResponse.json({ message: "Failed to update general fees", error: error.message }, { status: 500 });
  }
}
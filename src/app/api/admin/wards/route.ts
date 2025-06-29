
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Ward, Bed } from '@/app/dashboard/admin/ward-management/page'; // Use type from client page for now
import { WARDS_BEDS_STORAGE_KEY } from '@/app/dashboard/admin/ward-management/page';

// Schema for creating a new ward (server-side validation)
const newWardApiSchema = z.object({
  name: z.string().min(1, "Ward name is required").max(100, "Ward name too long"),
  description: z.string().max(500, "Description too long").optional(),
  desiredBedCount: z.coerce.number().min(0, "Bed count cannot be negative").int("Bed count must be a whole number").optional().default(0),
});

// Helper to get wards from localStorage (simulates DB access)
function getWardsFromStorage(): Ward[] {
  if (typeof localStorage === 'undefined') {
    console.warn("localStorage is not available in this API route context. Returning empty wards list.");
    return [];
   }
  const storedWards = localStorage.getItem(WARDS_BEDS_STORAGE_KEY);
  try {
    return storedWards ? JSON.parse(storedWards) : [];
  } catch (e) {
    console.error("Error parsing wards from storage in API:", e);
    return [];
  }
}

// Helper to save wards to localStorage (simulates DB write)
function saveWardsToStorage(wards: Ward[]) {
  if (typeof localStorage === 'undefined') {
    console.warn("localStorage is not available in this API route context. Cannot save wards.");
    return;
  }
  try {
    localStorage.setItem(WARDS_BEDS_STORAGE_KEY, JSON.stringify(wards));
  } catch (e) {
    console.error("Error saving wards to storage in API:", e);
  }
}

export async function GET(request: Request) {
  // TODO: Implement real authorization (e.g., check if admin)
  try {
    const wards = getWardsFromStorage();
    return NextResponse.json(wards);
  } catch (error: any) {
    console.error("API GET /admin/wards Error:", error);
    return NextResponse.json({ message: "Failed to fetch wards", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // TODO: Implement real authorization (e.g., check if admin)
  try {
    const body = await request.json();
    const validationResult = newWardApiSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API POST /admin/wards - Validation Error:", validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid ward data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const wardData = validationResult.data;
    let wards = getWardsFromStorage();

    if (wards.find(w => w.name.toLowerCase() === wardData.name.toLowerCase())) {
      console.warn(`API POST /admin/wards - Conflict: Ward name "${wardData.name}" already exists.`);
      return NextResponse.json({ message: `Ward with name "${wardData.name}" already exists` }, { status: 409 });
    }

    const newWard: Ward = {
      id: `WARD_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: wardData.name,
      description: wardData.description || "",
      beds: [],
    };

    for (let i = 0; i < wardData.desiredBedCount; i++) {
      newWard.beds.push({
        id: `BED_${newWard.id}_${Date.now()}_${i}`,
        label: `Bed ${i + 1}`,
        wardId: newWard.id,
        status: "Available",
      });
    }

    wards.unshift(newWard); // Add to beginning for easier viewing
    saveWardsToStorage(wards);

    return NextResponse.json(newWard, { status: 201 });

  } catch (error: any) {
    console.error("API POST /admin/wards - Unhandled Error:", error);
    if (error.message?.includes("localStorage")) {
        return NextResponse.json({ message: "Server-side storage error during ward creation", error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: error.message || "Failed to create ward", error: error.toString() }, { status: 500 });
  }
}
    
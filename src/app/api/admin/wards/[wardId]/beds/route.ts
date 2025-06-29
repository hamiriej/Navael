
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Ward, Bed } from '@/app/dashboard/admin/ward-management/page';
import { WARDS_BEDS_STORAGE_KEY } from '@/app/dashboard/admin/ward-management/page';

const newBedApiSchema = z.object({
  bedLabel: z.string().min(1, "Bed label is required").max(50, "Bed label too long"),
});

// Helper to get wards from localStorage
function getWardsFromStorage(): Ward[] {
  if (typeof localStorage === 'undefined') return [];
  const storedWards = localStorage.getItem(WARDS_BEDS_STORAGE_KEY);
  try {
    return storedWards ? JSON.parse(storedWards) : [];
  } catch (e) {
    console.error("Error parsing wards from storage in API (beds route):", e);
    return [];
  }
}

// Helper to save wards to localStorage
function saveWardsToStorage(wards: Ward[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(WARDS_BEDS_STORAGE_KEY, JSON.stringify(wards));
  } catch (e) {
    console.error("Error saving wards to storage in API (beds route):", e);
  }
}

export async function POST(
  request: Request,
  { params }: { params: { wardId: string } }
) {
  // TODO: Implement real authorization
  const wardId = params.wardId;
  try {
    const body = await request.json();
    const validationResult = newBedApiSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(`API POST /admin/wards/${wardId}/beds - Validation Error:`, validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid bed data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { bedLabel } = validationResult.data;
    let wards = getWardsFromStorage();
    const wardIndex = wards.findIndex(w => w.id === wardId);

    if (wardIndex === -1) {
      return NextResponse.json({ message: "Ward not found" }, { status: 404 });
    }

    const targetWard = wards[wardIndex];
    if (targetWard.beds.some(b => b.label.toLowerCase() === bedLabel.toLowerCase())) {
      return NextResponse.json({ message: `Bed with label "${bedLabel}" already exists in this ward.` }, { status: 409 });
    }

    const newBed: Bed = {
      id: `BED_${wardId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      label: bedLabel,
      wardId: wardId,
      status: "Available",
    };

    targetWard.beds.push(newBed);
    wards[wardIndex] = targetWard;
    saveWardsToStorage(wards);

    return NextResponse.json(targetWard, { status: 201 }); // Return the updated ward

  } catch (error: any) {
    console.error(`API POST /admin/wards/${wardId}/beds - Unhandled Error:`, error);
    return NextResponse.json({ message: error.message || "Failed to add bed", error: error.toString() }, { status: 500 });
  }
}
    
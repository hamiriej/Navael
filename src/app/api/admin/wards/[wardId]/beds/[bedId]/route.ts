
import { NextResponse } from 'next/server';
import type { Ward, Bed } from '@/app/dashboard/admin/ward-management/page';
import { WARDS_BEDS_STORAGE_KEY } from '@/app/dashboard/admin/ward-management/page';

// Helper to get wards from localStorage
function getWardsFromStorage(): Ward[] {
  if (typeof localStorage === 'undefined') return [];
  const storedWards = localStorage.getItem(WARDS_BEDS_STORAGE_KEY);
  try {
    return storedWards ? JSON.parse(storedWards) : [];
  } catch (e) {
    console.error("Error parsing wards from storage in API (bed detail route):", e);
    return [];
  }
}

// Helper to save wards to localStorage
function saveWardsToStorage(wards: Ward[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(WARDS_BEDS_STORAGE_KEY, JSON.stringify(wards));
  } catch (e) {
    console.error("Error saving wards to storage in API (bed detail route):", e);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { wardId: string, bedId: string } }
) {
  // TODO: Implement real authorization
  const { wardId, bedId } = params;
  try {
    let wards = getWardsFromStorage();
    const wardIndex = wards.findIndex(w => w.id === wardId);

    if (wardIndex === -1) {
      return NextResponse.json({ message: "Ward not found" }, { status: 404 });
    }

    const targetWard = wards[wardIndex];
    const bedIndex = targetWard.beds.findIndex(b => b.id === bedId);

    if (bedIndex === -1) {
      return NextResponse.json({ message: "Bed not found in this ward" }, { status: 404 });
    }

    const bedToDelete = targetWard.beds[bedIndex];
    if (bedToDelete.status === "Occupied") {
      return NextResponse.json({ message: `Bed "${bedToDelete.label}" is occupied and cannot be deleted.` }, { status: 409 });
    }

    targetWard.beds.splice(bedIndex, 1);
    wards[wardIndex] = targetWard;
    saveWardsToStorage(wards);

    // Return the updated ward, or 204 if preferred for DELETE
    return NextResponse.json(targetWard, { status: 200 }); 

  } catch (error: any) {
    console.error(`API DELETE /admin/wards/${wardId}/beds/${bedId} - Unhandled Error:`, error);
    return NextResponse.json({ message: error.message || "Failed to delete bed", error: error.toString() }, { status: 500 });
  }
}
    
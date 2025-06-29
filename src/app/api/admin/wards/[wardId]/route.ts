
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Ward, Bed } from '@/app/dashboard/admin/ward-management/page';
import { WARDS_BEDS_STORAGE_KEY } from '@/app/dashboard/admin/ward-management/page';

// Schema for updating a ward (server-side validation)
const updateWardApiSchema = z.object({
  name: z.string().min(1, "Ward name is required").max(100, "Ward name too long").optional(),
  description: z.string().max(500, "Description too long").optional(),
  desiredBedCount: z.coerce.number().min(0, "Bed count cannot be negative").int("Bed count must be a whole number").optional(),
});


// Helper to get wards from localStorage (simulates DB access)
function getWardsFromStorage(): Ward[] {
  if (typeof localStorage === 'undefined') {
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
    return;
  }
   try {
    localStorage.setItem(WARDS_BEDS_STORAGE_KEY, JSON.stringify(wards));
  } catch (e) {
    console.error("Error saving wards to storage in API:", e);
  }
}

export async function GET(
  request: Request,
  { params }: { params: { wardId: string } }
) {
  // TODO: Implement real authorization
  const wardId = params.wardId;
  try {
    const wards = getWardsFromStorage();
    const ward = wards.find(w => w.id === wardId);

    if (!ward) {
      return NextResponse.json({ message: "Ward not found" }, { status: 404 });
    }
    return NextResponse.json(ward);
  } catch (error: any) {
    console.error(`API GET /admin/wards/${wardId} - Unhandled Error:`, error);
    return NextResponse.json({ message: "Failed to fetch ward", error: error.message }, { status: 500 });
  }
}

export async function PUT( // Changed to PUT for full replacement semantics, can also be PATCH
  request: Request,
  { params }: { params: { wardId: string } }
) {
  // TODO: Implement real authorization (e.g., check if admin)
  const currentWardId = params.wardId;

  try {
    const body = await request.json();
    const validationResult = updateWardApiSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(`API PUT /admin/wards/${currentWardId} - Validation Error:`, validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid ward data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const updates = validationResult.data;
    let wards = getWardsFromStorage();
    const wardIndex = wards.findIndex(w => w.id === currentWardId);

    if (wardIndex === -1) {
      return NextResponse.json({ message: "Ward not found" }, { status: 404 });
    }

    const wardToUpdate = { ...wards[wardIndex] };

    if (updates.name && updates.name.toLowerCase() !== wardToUpdate.name.toLowerCase()) {
      if (wards.some(w => w.id !== currentWardId && w.name.toLowerCase() === updates.name!.toLowerCase())) {
        return NextResponse.json({ message: `Ward with name "${updates.name}" already exists` }, { status: 409 });
      }
      wardToUpdate.name = updates.name;
    }
    if (updates.description !== undefined) {
      wardToUpdate.description = updates.description;
    }

    if (updates.desiredBedCount !== undefined) {
      const targetBedCount = updates.desiredBedCount;
      const currentBedCount = wardToUpdate.beds.length;

      if (targetBedCount > currentBedCount) {
        // Add beds
        let nextBedNumber = currentBedCount > 0
          ? Math.max(0, ...wardToUpdate.beds.map(b => parseInt(b.label.replace(/[^0-9]/g, '')) || 0)) + 1
          : 1;
        for (let i = 0; i < (targetBedCount - currentBedCount); i++) {
          wardToUpdate.beds.push({
            id: `BED_${wardToUpdate.id}_${Date.now()}_${i}_${Math.random().toString(36).substring(2,5)}`,
            label: `Bed ${nextBedNumber++}`,
            wardId: wardToUpdate.id,
            status: "Available",
          });
        }
      } else if (targetBedCount < currentBedCount) {
        // Remove beds (prioritize non-occupied)
        const bedsToRemoveCount = currentBedCount - targetBedCount;
        let removedCount = 0;
        const bedStatusesPriority: Bed["status"][] = ["Available", "Needs Cleaning", "Maintenance"];
        
        for (const status of bedStatusesPriority) {
            while (removedCount < bedsToRemoveCount && wardToUpdate.beds.some(b => b.status === status)) {
                const bedIndexToRemove = wardToUpdate.beds.findIndex(b => b.status === status);
                if (bedIndexToRemove > -1) {
                    wardToUpdate.beds.splice(bedIndexToRemove, 1);
                    removedCount++;
                }
            }
            if (removedCount >= bedsToRemoveCount) break;
        }
        // If still need to remove more, and only occupied beds are left, this indicates an issue.
        // For this prototype, we'll stop here. A real backend might prevent this or require admin override.
        if (removedCount < bedsToRemoveCount) {
             console.warn(`API PUT /admin/wards/${currentWardId} - Could not remove ${bedsToRemoveCount - removedCount} beds as remaining ones are occupied.`);
             // Optionally return a specific message or partial success
        }
      }
    }

    wards[wardIndex] = wardToUpdate;
    saveWardsToStorage(wards);

    return NextResponse.json(wardToUpdate);

  } catch (error: any) {
    console.error(`API PUT /admin/wards/${currentWardId} - Unhandled Error:`, error);
    return NextResponse.json({ message: error.message || "Failed to update ward", error: error.toString() }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { wardId: string } }
) {
  // TODO: Implement real authorization (e.g., check if admin)
  const wardIdToDelete = params.wardId;

  try {
    let wards = getWardsFromStorage();
    const wardIndex = wards.findIndex(w => w.id === wardIdToDelete);

    if (wardIndex === -1) {
      return NextResponse.json({ message: "Ward not found" }, { status: 404 });
    }

    const wardToDelete = wards[wardIndex];
    if (wardToDelete.beds.some(bed => bed.status === "Occupied")) {
      return NextResponse.json({ message: `Ward "${wardToDelete.name}" has occupied beds and cannot be deleted.` }, { status: 409 });
    }

    wards.splice(wardIndex, 1);
    saveWardsToStorage(wards);

    return NextResponse.json(null, { status: 204 }); // No content
  } catch (error: any) {
    console.error(`API DELETE /admin/wards/${wardIdToDelete} - Unhandled Error:`, error);
    return NextResponse.json({ message: error.message || "Failed to delete ward", error: error.toString() }, { status: 500 });
  }
}
    
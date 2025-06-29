
import { NextResponse } from 'next/server';
import { STAFF_SCHEDULE_STORAGE_KEY } from '@/app/dashboard/staff-schedule/schedule.lib';
import type { Shift } from '@/app/dashboard/staff-schedule/schedule.lib';

// Helper to get shifts from localStorage
function getShiftsFromStorage(): Shift[] {
  if (typeof localStorage === 'undefined') return [];
  const storedShifts = localStorage.getItem(STAFF_SCHEDULE_STORAGE_KEY);
  try {
    return storedShifts ? JSON.parse(storedShifts) : [];
  } catch (e) {
    console.error("Error parsing shifts from storage in API (shiftId route):", e);
    return [];
  }
}

// Helper to save shifts to localStorage
function saveShiftsToStorage(shifts: Shift[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STAFF_SCHEDULE_STORAGE_KEY, JSON.stringify(shifts));
}

export async function DELETE(
  request: Request,
  { params }: { params: { shiftId: string } }
) {
  // TODO: Implement robust authorization check (e.g., ensure user is admin)
  const shiftIdToDelete = params.shiftId;

  try {
    let allShifts = getShiftsFromStorage();
    const initialLength = allShifts.length;
    allShifts = allShifts.filter(s => s.id !== shiftIdToDelete);

    if (allShifts.length === initialLength && initialLength > 0) {
      // Shift not found, but DELETE is idempotent so return 204 still, or 404 if strict.
      // For simplicity, we'll allow it and just log.
      console.warn(`API DELETE /staff-schedule/${shiftIdToDelete} - Shift not found, but proceeding as idempotent.`);
    }
    
    saveShiftsToStorage(allShifts);
    return NextResponse.json(null, { status: 204 }); // No content

  } catch (error: any) {
    console.error(`API DELETE /staff-schedule/${shiftIdToDelete} - Unhandled Error:`, error);
    return NextResponse.json({ message: error.message || "Failed to delete shift", error: error.toString() }, { status: 500 });
  }
}

// Placeholder for GET specific shift if needed
export async function GET(
  request: Request,
  { params }: { params: { shiftId: string } }
) {
  // TODO: Implement robust authorization check
  const shiftIdToGet = params.shiftId;
  try {
    const allShifts = getShiftsFromStorage();
    const shift = allShifts.find(s => s.id === shiftIdToGet);
    if (!shift) {
      return NextResponse.json({ message: "Shift not found" }, { status: 404 });
    }
    return NextResponse.json(shift);
  } catch (error: any) {
    console.error(`API GET /staff-schedule/${shiftIdToGet} - Unhandled Error:`, error);
    return NextResponse.json({ message: "Failed to fetch shift", error: error.message }, { status: 500 });
  }
}

// Placeholder for PUT/PATCH to update a whole shift if needed
// For now, only attendance is updated via a sub-route.

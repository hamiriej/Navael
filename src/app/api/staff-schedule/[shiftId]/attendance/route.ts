
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { STAFF_SCHEDULE_STORAGE_KEY } from '@/app/dashboard/staff-schedule/schedule.lib';
import type { Shift } from '@/app/dashboard/staff-schedule/schedule.lib';

// Helper to get shifts from localStorage
function getShiftsFromStorage(): Shift[] {
  if (typeof localStorage === 'undefined') return [];
  const storedShifts = localStorage.getItem(STAFF_SCHEDULE_STORAGE_KEY);
  try {
    return storedShifts ? JSON.parse(storedShifts) : [];
  } catch (e) {
    console.error("Error parsing shifts from storage in API (attendance):", e);
    return [];
  }
}

// Helper to save shifts to localStorage
function saveShiftsToStorage(shifts: Shift[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STAFF_SCHEDULE_STORAGE_KEY, JSON.stringify(shifts));
}

const attendanceUpdateSchema = z.object({
  actualStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)").optional(),
  actualEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)").optional(),
  attendanceStatus: z.enum(["Scheduled", "Clocked In", "Late", "Clocked Out", "Absent"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { shiftId: string } }
) {
  // TODO: Implement robust authorization check
  const shiftId = params.shiftId;
  try {
    const body = await request.json();
    const validationResult = attendanceUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(`API PATCH /staff-schedule/${shiftId}/attendance - Validation Error:`, validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid attendance data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const updates = validationResult.data;
    let allShifts = getShiftsFromStorage();
    const shiftIndex = allShifts.findIndex(s => s.id === shiftId);

    if (shiftIndex === -1) {
      return NextResponse.json({ message: "Shift not found" }, { status: 404 });
    }

    const updatedShift = { ...allShifts[shiftIndex], ...updates };
    allShifts[shiftIndex] = updatedShift;
    saveShiftsToStorage(allShifts);

    return NextResponse.json(updatedShift);

  } catch (error: any) {
    console.error(`API PATCH /staff-schedule/${shiftId}/attendance - Unhandled Error:`, error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ message: "Invalid JSON payload provided.", error: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "Failed to update shift attendance", error: error.toString() }, { status: 500 });
  }
}

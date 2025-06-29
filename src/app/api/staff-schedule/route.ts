
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { 
    STAFF_SCHEDULE_STORAGE_KEY, 
    getStaffNameById // Keep this utility for now, though ideally backend would resolve name
} from '@/app/dashboard/staff-schedule/schedule.lib'; // Import storage key
import type { Shift } from '@/app/dashboard/staff-schedule/schedule.lib';
import { format } from 'date-fns';

// Helper to get shifts from localStorage (simulates DB access)
function getShiftsFromStorage(): Shift[] {
  if (typeof localStorage === 'undefined') {
    console.warn("localStorage is not available in this API route context. Returning empty shifts list.");
    return [];
  }
  const storedShifts = localStorage.getItem(STAFF_SCHEDULE_STORAGE_KEY);
  try {
    return storedShifts ? JSON.parse(storedShifts) : [];
  } catch (e) {
    console.error("Error parsing shifts from storage in API:", e);
    return [];
  }
}

// Helper to save shifts to localStorage (simulates DB write)
function saveShiftsToStorage(shifts: Shift[]) {
  if (typeof localStorage === 'undefined') {
    console.warn("localStorage is not available in this API route context. Cannot save shifts.");
    return;
  }
  try {
    localStorage.setItem(STAFF_SCHEDULE_STORAGE_KEY, JSON.stringify(shifts));
  } catch (e) {
    console.error("Error saving shifts to storage in API:", e);
  }
}

// Schema for creating a new shift (from client)
const newShiftApiSchema = z.object({
  staffId: z.string().min(1, "Staff ID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  shiftType: z.enum(["Day", "Night", "Day Off", "Custom"]),
  startTime: z.string().optional(), // HH:mm
  endTime: z.string().optional(),   // HH:mm
  notes: z.string().optional(),
}).refine(data => {
  if ((data.shiftType === "Day" || data.shiftType === "Night" || data.shiftType === "Custom") && (!data.startTime || !data.endTime)) {
    return false;
  }
  return true;
}, {
  message: "Start and End time are required for Day, Night, and Custom shifts.",
  path: ["startTime"],
});


export async function GET(request: Request) {
  // TODO: Implement robust authorization check (e.g., verify JWT, check user role/permissions)
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // Expects YYYY-MM-DD
    const staffId = searchParams.get('staffId');
    const excludeDayOff = searchParams.get('excludeDayOff') === 'true';

    let shifts = getShiftsFromStorage();

    if (date) {
      shifts = shifts.filter(s => s.date === date);
    }
    if (staffId) {
      shifts = shifts.filter(s => s.staffId === staffId);
    }
    if (excludeDayOff) {
      shifts = shifts.filter(s => s.shiftType !== "Day Off");
    }
    
    // If staffId and date and excludeDayOff are provided (for fetchUserShiftForToday)
    // we expect only one or null
    if (staffId && date && excludeDayOff) {
      return NextResponse.json(shifts.length > 0 ? shifts[0] : null);
    }

    return NextResponse.json(shifts);
  } catch (error: any) {
    console.error("API GET /staff-schedule Error:", error);
    return NextResponse.json({ message: "Failed to fetch shifts", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // TODO: Implement robust authorization check
  try {
    const body = await request.json();
    const validationResult = newShiftApiSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API POST /staff-schedule - Validation Error:", validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid shift data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const shiftData = validationResult.data;
    let allShifts = getShiftsFromStorage();

    const staffName = getStaffNameById(shiftData.staffId); // Get staff name

    const newShift: Shift = {
      id: `SH${Date.now().toString(36)}${Math.random().toString(36).substring(2, 7)}`,
      staffId: shiftData.staffId,
      staffName: staffName, // Add staffName here
      date: shiftData.date,
      shiftType: shiftData.shiftType as Shift["shiftType"],
      startTime: shiftData.startTime,
      endTime: shiftData.endTime,
      notes: shiftData.notes,
      attendanceStatus: "Scheduled",
    };

    allShifts.unshift(newShift); // Add to beginning for easier viewing on simple list
    saveShiftsToStorage(allShifts);

    return NextResponse.json(newShift, { status: 201 });

  } catch (error: any) {
    console.error("API POST /staff-schedule - Unhandled Error:", error);
    if (error instanceof SyntaxError) { // Handle JSON parsing errors specifically
        return NextResponse.json({ message: "Invalid JSON payload provided.", error: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "Failed to create shift", error: error.toString() }, { status: 500 });
  }
}

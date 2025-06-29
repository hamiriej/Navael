
"use client";

import { USER_MANAGEMENT_STORAGE_KEY } from "@/contexts/auth-context";
import { getAllStaffUsers as fetchAllStaffUsersFromGlobal, type MockUser } from "../admin/user-management/page";
import type { Role } from "@/lib/constants";
import { format } from "date-fns";

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  shiftType: "Day" | "Night" | "Day Off" | "Custom";
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  notes?: string;
  actualStartTime?: string; // HH:mm
  actualEndTime?: string; // HH:mm
  attendanceStatus?: "Scheduled" | "Clocked In" | "Late" | "Clocked Out" | "Absent";
}

export const STAFF_SCHEDULE_STORAGE_KEY = "navael_staff_schedule_shifts"; // Key used by API routes now

// Helper to handle API responses from fetch calls
async function handleScheduleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `API Error: ${response.status} ${response.statusText}` }));
    console.error("API Error Response:", errorData);
    throw new Error(errorData.message || `API Error: ${response.status}`);
  }
  // For 204 No Content (like DELETE), response.json() will fail.
  if (response.status === 204) return {} as T; 
  return response.json() as Promise<T>;
}

// --- Helper functions for staff details (still reads from global user cache for simplicity) ---
const getUsersFromGlobalCache = (): MockUser[] => {
  // This function assumes that the user management page/context keeps this global cache updated
  // or that it's acceptable for this lib to read from a potentially stale but locally available cache.
  return fetchAllStaffUsersFromGlobal(); 
};

export const getStaffNameById = (staffId: string): string => {
  const users = getUsersFromGlobalCache();
  return users.find(s => s.id === staffId)?.name || "Unknown Staff";
};

export const getStaffRoleById = (staffId: string): Role | "Unknown Role" => {
  const users = getUsersFromGlobalCache();
  return users.find(s => s.id === staffId)?.role || "Unknown Role";
};

// --- API-driven Service Functions ---

export async function fetchShiftsByDate(date: string): Promise<Shift[]> {
  try {
    const response = await fetch(`/api/staff-schedule?date=${date}`);
    return await handleScheduleApiResponse<Shift[]>(response);
  } catch (error) {
    console.error(`Failed to fetch shifts for date ${date} via API:`, error);
    throw error; 
  }
}

export async function fetchUserShiftForToday(staffId: string): Promise<Shift | null> {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  try {
    const response = await fetch(`/api/staff-schedule?staffId=${staffId}&date=${todayStr}&excludeDayOff=true`);
    // The API route might return null directly if no shift is found, or an empty array.
    // handleScheduleApiResponse needs to be flexible or the API consistent.
    // Assuming API returns null for no specific shift, or an object.
    const data = await response.json(); // Directly parse JSON here
    if (!response.ok) {
        const errorData = data || { message: `API Error: ${response.status} ${response.statusText}` };
        console.error("API Error Response:", errorData);
        throw new Error(errorData.message || `API Error: ${response.status}`);
    }
    return data as Shift | null; // API should return null if not found for this specific query
  } catch (error) {
    console.error(`Failed to fetch shift for staff ${staffId} on ${todayStr} via API:`, error);
    throw error;
  }
}

export async function createShift(newShiftData: Omit<Shift, 'id' | 'staffName' | 'attendanceStatus'>): Promise<Shift> {
  try {
    const response = await fetch(`/api/staff-schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newShiftData),
    });
    return await handleScheduleApiResponse<Shift>(response);
  } catch (error) {
    console.error("Failed to create shift via API:", error);
    throw error;
  }
}

export async function updateShiftAttendanceService(shiftId: string, updates: Partial<Pick<Shift, 'actualStartTime' | 'actualEndTime' | 'attendanceStatus'>>): Promise<Shift> {
  try {
    const response = await fetch(`/api/staff-schedule/${shiftId}/attendance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await handleScheduleApiResponse<Shift>(response);
  } catch (error) {
    console.error(`Failed to update attendance for shift ${shiftId} via API:`, error);
    throw error;
  }
}

export async function deleteShiftService(shiftId: string): Promise<void> {
  try {
    const response = await fetch(`/api/staff-schedule/${shiftId}`, {
      method: 'DELETE',
    });
    await handleScheduleApiResponse<void>(response); // Expects 204 No Content
  } catch (error) {
    console.error(`Failed to delete shift ${shiftId} via API:`, error);
    throw error;
  }
}

// mockScheduleStore is no longer needed as API routes manage localStorage
export let mockScheduleStore: Shift[] = []; 

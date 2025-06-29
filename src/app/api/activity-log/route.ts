
import { NextResponse } from 'next/server';
import type { ActivityLogItem } from '@/lib/activityLog'; // Import the type

const GLOBAL_ACTIVITY_LOG_KEY = 'navael_global_activity_log';
const MAX_LOG_ENTRIES = 100; // Increased slightly for more history

// Helper function to get logs from localStorage (server-side context)
function getLogsFromStorage(): ActivityLogItem[] {
  if (typeof localStorage === 'undefined') {
    // This might happen in environments without localStorage, though Next.js API routes usually have it.
    // Consider a more robust server-side storage if localStorage is consistently unavailable.
    console.warn("localStorage is not available in activity-log API route. Activity log might not persist correctly.");
    return [];
  }
  const storedLog = localStorage.getItem(GLOBAL_ACTIVITY_LOG_KEY);
  if (storedLog) {
    try {
      const parsedLog = JSON.parse(storedLog);
      return Array.isArray(parsedLog) ? parsedLog : [];
    } catch (e) {
      console.error("Error parsing activity log from storage in API:", e);
      return [];
    }
  }
  return [];
}

// Helper function to save logs to localStorage (server-side context)
function saveLogsToStorage(logs: ActivityLogItem[]) {
  if (typeof localStorage === 'undefined') {
    console.warn("localStorage is not available in activity-log API route. Cannot save logs.");
    return;
  }
  try {
    localStorage.setItem(GLOBAL_ACTIVITY_LOG_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error("Error saving activity log to storage in API:", e);
  }
}

export async function GET(request: Request) {
  // TODO: Implement authorization (e.g., ensure user is authenticated, maybe admin for full log access)
  try {
    const logs = getLogsFromStorage();
    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("API GET /activity-log Error:", error);
    return NextResponse.json({ message: "Failed to fetch activity log", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // TODO: Implement authorization (e.g., ensure user is authenticated to log actions)
  try {
    const logEntryDetails = await request.json() as Omit<ActivityLogItem, 'id' | 'timestamp'>;

    if (!logEntryDetails || !logEntryDetails.actionDescription || !logEntryDetails.actorName) {
      return NextResponse.json({ message: "Invalid log entry data. Required fields missing." }, { status: 400 });
    }

    const newActivity: ActivityLogItem = {
      ...logEntryDetails,
      id: `ACT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    let currentLog = getLogsFromStorage();
    currentLog.unshift(newActivity); // Add to beginning

    if (currentLog.length > MAX_LOG_ENTRIES) {
      currentLog = currentLog.slice(0, MAX_LOG_ENTRIES); // Cap log size
    }

    saveLogsToStorage(currentLog);

    return NextResponse.json(newActivity, { status: 201 });
  } catch (error: any) {
    console.error("API POST /activity-log Error:", error);
    // Avoid sending detailed internal errors to client unless necessary
    if (error instanceof SyntaxError) {
        return NextResponse.json({ message: "Invalid JSON payload provided.", error: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to record activity log entry", error: error.message || "Unknown server error" }, { status: 500 });
  }
}
    
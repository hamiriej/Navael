
"use client";

import type { Role } from "./constants";

// Define the structure of an activity log item
export interface ActivityLogItem {
  id: string;
  timestamp: string; // ISO string
  actorRole: Role | string;
  actorName: string;
  actionDescription: string; // e.g., "Booked Appointment for Jane Doe"
  targetEntityType?: string; // e.g., "Patient", "Appointment"
  targetEntityId?: string;
  targetLink?: string; // e.g., /dashboard/patients/P001
  iconName?: keyof typeof import('lucide-react'); // Store the name of the Lucide icon
  details?: string; // Additional context if needed
}

const API_BASE_URL = '/api'; // Use relative path for Next.js API routes

// Function to add a new activity to the log via API
export async function logActivity(itemDetails: Omit<ActivityLogItem, 'id' | 'timestamp'>): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const response = await fetch(`${API_BASE_URL}/activity-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(itemDetails),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to log activity due to network or server error.' }));
      console.error("Failed to log activity via API:", errorData.message || response.statusText);
      // Optionally, implement a fallback or retry mechanism here
    }
  } catch (error) {
    console.error("Network error while logging activity:", error);
    // Optionally, implement a fallback or retry mechanism here
  }
}

// Function to get the activity log via API
export async function getActivityLog(): Promise<ActivityLogItem[]> {
  if (typeof window === 'undefined') return [];

  try {
    const response = await fetch(`${API_BASE_URL}/activity-log`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch activity log due to network or server error.' }));
      console.error("Failed to fetch activity log from API:", errorData.message || response.statusText);
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Network error while fetching activity log:", error);
    return [];
  }
}
    
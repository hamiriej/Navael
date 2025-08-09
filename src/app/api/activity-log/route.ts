import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { ActivityLogItem } from '@/lib/activityLog'; // Keep your type import

// Initialize Firebase Admin SDK once
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

export async function GET(request: Request) {
  try {
    const snapshot = await db
      .collection('activityLogs')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const logs: ActivityLogItem[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ActivityLogItem[];

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("API GET /activity-log Error:", error);
    return NextResponse.json(
      { message: "Failed to fetch activity log", error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const logEntryDetails = (await request.json()) as Omit<ActivityLogItem, 'id' | 'timestamp'>;

    if (!logEntryDetails || !logEntryDetails.actionDescription || !logEntryDetails.actorName) {
      return NextResponse.json(
        { message: "Invalid log entry data. Required fields missing." },
        { status: 400 }
      );
    }

    const newActivity = {
      ...logEntryDetails,
      timestamp: new Date().toISOString(),
    };

    const docRef = await db.collection('activityLogs').add(newActivity);

    return NextResponse.json({ id: docRef.id, ...newActivity }, { status: 201 });
  } catch (error: any) {
    console.error("API POST /activity-log Error:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Invalid JSON payload provided.", error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Failed to record activity log entry", error: error.message || "Unknown server error" },
      { status: 500 }
    );
  }
}

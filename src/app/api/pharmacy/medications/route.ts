// src/app/api/pharmacy/medications/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// GET: Fetch all medications
export async function GET(request: Request) {
  try {
    const snapshot = await adminDb.collection('medications').get();
    const medications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(medications); // Sends array of all medications
  } catch (error: any) {
    console.error('Error fetching medications:', error);
    return NextResponse.json({ message: 'Failed to fetch medications', error: error.message }, { status: 500 });
  }
}

// POST: Add new medication
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const docRef = await adminDb.collection('medications').add(body);
    return NextResponse.json({ id: docRef.id, ...body }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding medication:', error);
    return NextResponse.json({ message: 'Failed to add medication', error: error.message }, { status: 500 });
  }
}

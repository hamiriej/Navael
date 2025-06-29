// src/app/api/admin/users/route.ts

import { NextResponse } from 'next/server';
// Correctly imports from the NEW firebase-admin.ts file
import { adminDb, adminAuth } from '@/lib/firebase-admin';
// Corrected import path for MockUser using the alias
import { MockUser } from '@/app/dashboard/admin/user-management/page';

// Define the GET handler for fetching all users
export async function GET(request: Request) {
  try {
    const usersRef = adminDb.collection('users');
    const snapshot = await usersRef.get();

    const users: MockUser[] = [];
    snapshot.forEach(doc => {
      // Ensure that the document data matches your MockUser interface
      const data = doc.data();
      users.push({
        id: doc.id, // The Firestore document ID is the user's UID
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status,
        lastLogin: data.lastLogin,
        officeNumber: data.officeNumber,
        staffId: data.staffId,
        // Password is not stored in Firestore profile, nor should it be returned
        // password property is optional in MockUser for safety.
      });
    });

    return NextResponse.json(users, { status: 200 }); // 200 OK
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ message: 'Failed to fetch users', error: error.message }, { status: 500 });
  }
}

// Define the POST handler for creating a new user
export async function POST(request: Request) {
  try {
    const { name, email, password, role, status, officeNumber } = await request.json();

    // Basic validation to ensure required fields are present
    if (!name || !email || !password || !role || !status) {
      return NextResponse.json({ message: 'Missing required fields (name, email, password, role, status)' }, { status: 400 });
    }

    // 1. Create user in Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
      displayName: name,
      // disabled: status === 'Inactive',
    });

    // 2. Store user's detailed profile in Cloud Firestore
    const newUserProfile: MockUser = {
      id: userRecord.uid, // Use the UID from Firebase Auth as the user's ID
      name: name,
      email: email,
      role: role,
      status: status,
      lastLogin: new Date().toISOString(),
      officeNumber: officeNumber || undefined,
      staffId: undefined // Correctly typed now with MockUser update
    };

    console.log("Attempting to save to Firestore:", newUserProfile);

    // Store the user profile in the 'users' collection in Firestore
    await adminDb.collection('users').doc(userRecord.uid).set(newUserProfile);

    // 3. Return a success response to the frontend
    const responseData: Partial<MockUser> = { ...newUserProfile };

    return NextResponse.json(responseData, { status: 201 }); // 201 Created status
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      return NextResponse.json({ message: 'The email address is already in use by another account. Please use a different email.' }, { status: 409 });
    }
    console.error('Error creating user:', error);
    return NextResponse.json({ message: 'Failed to create user due to a server error.', error: error.message }, { status: 500 });
  }
}

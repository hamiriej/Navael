import { NextResponse } from 'next/server';
import { z } from 'zod';
// Removed USER_MANAGEMENT_STORAGE_KEY as localStorage is no longer used
import type { MockUser } from '@/app/dashboard/admin/user-management/page';
import { ALL_ROLES, type Role } from '@/lib/constants';
// HIGHLIGHT START: Import Firebase Admin SDK instances
import { adminDb, adminAuth } from '@/lib/firebase-admin';
// HIGHLIGHT END

// Schema for updating a user (server-side validation)
// Password fields are optional for updates.
const updateUserApiSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email address").optional(),
  role: z.custom<Role>((val) => ALL_ROLES.includes(val as Role), {
    message: "Please select a valid role.",
  }).optional(),
  status: z.enum(["Active", "Inactive", "Pending"]).optional(),
  officeNumber: z.string().optional().nullable(),
  newPassword: z.string().min(6, "New password must be at least 6 characters").optional(),
});


// GET handler to fetch a single user by ID from Firestore
export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  // TODO: Implement real authorization (e.g., check if the requester is an admin)
  const userId = params.userId;

  try {
    // HIGHLIGHT START: Fetch user from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.warn(`API GET /admin/users/${userId} - User document not found in Firestore.`);
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data() as MockUser; // Cast to your MockUser interface
    // HIGHLIGHT END

    // Exclude sensitive data like 'password' if it were stored directly in Firestore (though it shouldn't be for Firebase Auth users)
    const { password, ...userToReturn } = userData; // Safely destructure if password exists on type

    return NextResponse.json(userToReturn);
  } catch (error: any) {
    console.error(`API GET /admin/users/${userId} - Unhandled Error:`, error);
    return NextResponse.json({ message: "Failed to fetch user", error: error.message }, { status: 500 });
  }
}

// PATCH handler to update a user in Firebase Auth and Firestore
export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  // TODO: Implement real authorization (e.g., check if admin)
  const userId = params.userId;

  try {
    const body = await request.json();
    const validationResult = updateUserApiSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(`API PATCH /admin/users/${userId} - Validation Error:`, validationResult.error.flatten());
      return NextResponse.json({ message: "Invalid user data", errors: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const updates = validationResult.data;

    // HIGHLIGHT START: Prepare updates for Firebase Authentication and Firestore
    const authUpdates: { email?: string; password?: string; displayName?: string; disabled?: boolean } = {};
    const firestoreUpdates: { [key: string]: any } = {}; // For other fields to update in Firestore

    // Handle email update (Firebase Auth handles email conflicts)
    if (updates.email !== undefined) {
      authUpdates.email = updates.email;
    }

    // Handle password update (Firebase Auth)
    if (updates.newPassword !== undefined) {
      authUpdates.password = updates.newPassword;
    }

    // Map other fields to Firestore updates
    if (updates.name !== undefined) {
      firestoreUpdates.name = updates.name;
    }
    if (updates.role !== undefined) {
      firestoreUpdates.role = updates.role;
    }
    if (updates.status !== undefined) {
        // Firebase Auth user's status is 'disabled'. Your MockUser has 'status' (Active/Inactive/Pending).
        // You might map 'Active' to disabled: false and 'Inactive' to disabled: true for Firebase Auth.
        // For simplicity here, we'll just update Firestore, but consider Auth user status too.
        firestoreUpdates.status = updates.status;
        authUpdates.disabled = (updates.status === "Inactive"); // Example mapping
    }
    if (updates.officeNumber !== undefined) {
      firestoreUpdates.officeNumber = updates.officeNumber;
    }
    // You might also need to update staffId if it's dynamic
    // firestoreUpdates.staffId = updates.staffId;


    // First, update Firebase Authentication user
    if (Object.keys(authUpdates).length > 0) {
      try {
        await adminAuth.updateUser(userId, authUpdates);
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-exists') {
          return NextResponse.json({ message: "Another user with this email already exists" }, { status: 409 });
        }
        console.error(`API PATCH /admin/users/${userId} - Firebase Auth Update Error:`, authError);
        return NextResponse.json({ message: `Failed to update user in Authentication: ${authError.message}` }, { status: 500 });
      }
    }

    // Then, update the user's document in Firestore
    if (Object.keys(firestoreUpdates).length > 0) {
        await adminDb.collection('users').doc(userId).update(firestoreUpdates);
    }
    // HIGHLIGHT END

    // Fetch the updated user data to return
    const updatedUserDoc = await adminDb.collection('users').doc(userId).get();
    if (!updatedUserDoc.exists) {
        return NextResponse.json({ message: "Updated user not found after operation" }, { status: 500 });
    }
    const updatedUser = updatedUserDoc.data() as MockUser;

    // Exclude password if it exists on the type
    const { password, ...userToReturn } = updatedUser;
    return NextResponse.json(userToReturn);

  } catch (error: any) {
    console.error(`API PATCH /admin/users/${userId} - Unhandled Error:`, error);
    return NextResponse.json({ message: error.message || "Failed to update user", error: error.toString() }, { status: 500 });
  }
}

// DELETE handler to delete a user from Firebase Auth and Firestore
export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  // TODO: Implement real authorization (e.g., check if admin)
  const userId = params.userId;

  try {
    // HIGHLIGHT START: Delete user from Firebase Auth and Firestore
    // Delete from Firebase Authentication
    await adminAuth.deleteUser(userId);
    console.log(`Successfully deleted user ${userId} from Firebase Authentication.`);

    // Delete corresponding document from Firestore
    await adminDb.collection('users').doc(userId).delete();
    console.log(`Successfully deleted user document ${userId} from Firestore.`);
    // HIGHLIGHT END

    return NextResponse.json(null, { status: 204 }); // No content
  } catch (error: any) {
    console.error(`API DELETE /admin/users/${userId} - Unhandled Error:`, error);
    if (error.code === 'auth/user-not-found') {
        console.warn(`Attempted to delete non-existent user ${userId} from Auth. Proceeding with Firestore delete (if exists).`);
        // If user not found in Auth, it's already "deleted" there, proceed to delete from Firestore
        try {
            await adminDb.collection('users').doc(userId).delete();
            console.log(`Successfully deleted potentially lingering user document ${userId} from Firestore.`);
        } catch (firestoreError: any) {
             console.error(`Error deleting potentially lingering Firestore document for user ${userId}:`, firestoreError);
             return NextResponse.json({ message: `Failed to delete user document from Firestore: ${firestoreError.message}` }, { status: 500 });
        }
        return NextResponse.json(null, { status: 204 }); // Still 204 as the user is effectively gone.
    }
    return NextResponse.json({ message: error.message || "Failed to delete user", error: error.toString() }, { status: 500 });
  }
}

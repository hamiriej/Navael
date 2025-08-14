// src/app/api/patients/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Patient } from '@/contexts/patient-context';
import { firestore } from 'firebase-admin';

// Define an interface for how the Patient data is actually stored in Firestore.
interface StoredPatient extends Omit<Patient, 'createdAt'> {
  createdAt: firestore.Timestamp;
}

/**
 * Handles POST requests to create a new patient.
 * This function generates a unique PTYYYY-NNNN patient ID using a transactional counter.
 * The request body should contain data that aligns with the Omit<Patient, 'id' | 'createdAt'>
 * structure from the frontend, meaning firstName, lastName, dateOfBirth (as YYYY-MM-DD string),
 * and all other patient properties, but without 'id' or 'createdAt' as they are generated server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const patientDataFromFrontend: Omit<Patient, 'id' | 'createdAt'> = await req.json();
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const monthId = `${year}-${month}`;

    const counterDocRef = adminDb.collection('sequences').doc('patients');

    let generatedPatientId: string | undefined;
    let patientToStoreInFirestore: StoredPatient | undefined;
    let nextNumber = 1;

    await adminDb.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterDocRef);

    if (counterDoc.exists) {
        const data = counterDoc.data();
        const monthSequence = data?.[monthId] || 0;
        nextNumber = monthSequence + 1;
      }

      // This will create the document if it doesn't exist, or update the
      // specific month's counter.
      transaction.set(counterDocRef, { [monthId]: nextNumber }, { merge: true });

      const formattedNumber = String(nextNumber).padStart(4, '0');
      // ✨✨✨ THIS IS THE ONLY LINE THAT CHANGES ✨✨✨
      generatedPatientId = `PT${year}-${month}-${formattedNumber}`;

      patientToStoreInFirestore = {
        ...patientDataFromFrontend,
        id: generatedPatientId,
        createdAt: firestore.Timestamp.now(),
      } as StoredPatient;

      const patientDocRef = adminDb.collection('patients').doc(generatedPatientId);
      transaction.set(patientDocRef, patientToStoreInFirestore);
    });

    if (!generatedPatientId || !patientToStoreInFirestore) {
      throw new Error('Failed to generate patient ID or prepare patient data during transaction.');
    }

    const responsePatient: Patient = {
        ...patientToStoreInFirestore,
        createdAt: patientToStoreInFirestore.createdAt instanceof firestore.Timestamp
            ? patientToStoreInFirestore.createdAt.toDate().toISOString()
            : undefined,
    };

    return NextResponse.json(responsePatient, { status: 201 });

  } catch (error) {
    console.error('Error creating patient:', error);

    let errorMessage = 'An unexpected error occurred while creating the patient.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string') {
        errorMessage = (error as any).message;
    }

    return NextResponse.json(
      { message: 'Failed to create patient', error: errorMessage },
      { status: 500 }
    );
  }
}

// ... (Your GET function remains unchanged as the ID is just a string now)


/**
 * Handles GET requests to fetch all patients.
 * This will retrieve all patient documents from the 'patients' collection in Firestore
 * and return them as an array, matching the 'Patient' interface structure.
 * It now safely handles 'createdAt' being either a Firestore Timestamp or an ISO string.
 */
export async function GET() {
  try {
    const patientsSnapshot = await adminDb.collection('patients').get();

    const patients: Patient[] = patientsSnapshot.docs.map(doc => {
      // Get the raw data from Firestore document
      // We assume data might conform to StoredPatient or older Patient formats
      const data = doc.data();

      // Safely handle createdAt: it could be a firestore.Timestamp (new entries)
      // or a plain string (older entries), or even undefined.
      let createdAtValue: string | undefined;
      // If it's a Firestore Timestamp, convert it
      if (data.createdAt instanceof firestore.Timestamp) { // Using firestore.Timestamp for instanceof check
        createdAtValue = data.createdAt.toDate().toISOString();
      }
      // If it's already a string (from older data), use it as is
      else if (typeof data.createdAt === 'string') {
        createdAtValue = data.createdAt;
      }
      // Otherwise, it remains undefined

      // Transform it to match your 'Patient' interface.
      // Ensure all fields are present, even if some were optional when storing.
      // 'name' and 'age' are NOT returned here, as they are derived on the frontend.
      return {
        id: doc.id, // Include the Firestore document ID
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        contactNumber: data.contactNumber,
        email: data.email || '', // Ensure optional fields default to empty string if missing
        address: data.address,
        emergencyContact: data.emergencyContact,
        insurance: data.insurance || undefined, // Ensure optional nested objects are undefined if empty
        allergies: data.allergies || [],
        currentMedications: data.currentMedications || [],
        medicalHistoryNotes: data.medicalHistoryNotes || '',
        lastVisit: data.lastVisit,
        status: data.status,
        profilePictureUrl: data.profilePictureUrl || undefined,
        createdAt: createdAtValue, // Use the safely converted value
      } as Patient; // Cast to ensure type safety
    });

    return NextResponse.json(patients, { status: 200 });

  } catch (error) {
    console.error('Error fetching patients:', error);

    let errorMessage = 'An unexpected error occurred while fetching patients.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string') {
        errorMessage = (error as any).message;
    }

    return NextResponse.json(
      { message: 'Failed to fetch patients', error: errorMessage },
      { status: 500 }
    );
  }
}

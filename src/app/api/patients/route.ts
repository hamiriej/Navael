// src/app/api/patients/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Ensure this path is correct for your Firebase Admin SDK instance
import { Patient } from '@/contexts/patient-context'; // IMPORT YOUR PATIENT INTERFACE FROM HERE

/**
 * Handles POST requests to create a new patient.
 * The request body should contain data that aligns with the Omit<Patient, 'id' | 'createdAt'>
 * structure from the frontend, meaning firstName, lastName, dateOfBirth (as YYYY-MM-DD string),
 * and all other patient properties, but without 'id' or 'createdAt' as they are generated server-side.
 */
export async function POST(req: NextRequest) {
  try {
    // The request body will contain the data that your frontend `addPatient`
    // function has prepared for storage (e.g., firstName, lastName, dateOfBirth as string, etc.)
    const patientDataFromFrontend: Omit<Patient, 'id' | 'createdAt'> = await req.json();

    // Add a server-side creation timestamp.
    // This will be stored in Firestore.
    const patientToStoreInFirestore = {
      ...patientDataFromFrontend,
      createdAt: new Date().toISOString(), // Consistent ISO string for creation timestamp
    };

    // Add the patient data to the 'patients' collection in Firestore
    // Firestore will automatically generate the document ID.
    const docRef = await adminDb.collection('patients').add(patientToStoreInFirestore);

    // Prepare the response. The 'id' comes from the Firestore document.
    // The response sent back to the client should match the 'Patient' interface
    // (which now includes firstName, lastName, and createdAt from DB, but *not* derived 'name'/'age').
    const responsePatient: Patient = {
      ...patientToStoreInFirestore,
      id: docRef.id, // Add the Firestore-generated ID
    };

    return NextResponse.json(responsePatient, { status: 201 });

  } catch (error) {
    console.error('Error creating patient:', error);
    return NextResponse.json(
      { message: 'Failed to create patient', error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Handles GET requests to fetch all patients.
 * This will retrieve all patient documents from the 'patients' collection in Firestore
 * and return them as an array, matching the 'Patient' interface structure.
 */
export async function GET() {
  try {
    const patientsSnapshot = await adminDb.collection('patients').get();

    const patients: Patient[] = patientsSnapshot.docs.map(doc => {
      // Get the raw data from Firestore document
      const data = doc.data();

      // Transform it to match your 'Patient' interface.
      // Ensure all fields are present, even if some were optional when storing (like 'profilePictureUrl').
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
        createdAt: data.createdAt || undefined, // Include if present
      } as Patient; // Cast to ensure type safety
    });

    return NextResponse.json(patients, { status: 200 });

  } catch (error) {
    console.error('Error fetching patients:', error);
    return NextResponse.json(
      { message: 'Failed to fetch patients', error: (error as Error).message },
      { status: 500 }
    );
  }
}

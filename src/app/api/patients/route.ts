// src/app/api/patients/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Ensure this path is correct for your Firebase Admin SDK instance
import { FieldValue } from 'firebase-admin/firestore'; // Import FieldValue for serverTimestamp()
import { Patient, PatientCreationData } from '@/contexts/patient-context'; // Import your Patient and PatientCreationData interfaces
import { patientConverter } from '@/converters/patientConverter'; // *** NEW: Import your patientConverter ***


/**
 * Handles POST requests to create a new patient.
 * The request body should contain data that aligns with PatientCreationData
 * from the frontend, meaning properties like firstName, lastName, dateOfBirth, etc.,
 * but without 'id', 'createdAt', or 'updatedAt' as they are generated server-side.
 */
export async function POST(req: NextRequest) {
  let patientDataFromFrontend: PatientCreationData | undefined; // For logging in case of error

  try {
    patientDataFromFrontend = await req.json();

    // Log the incoming payload for better debugging context
    console.log('Incoming POST request to /api/patients, payload:', JSON.stringify(patientDataFromFrontend, null, 2));

    // Basic validation: ensure required fields are present
    if (!patientDataFromFrontend || !patientDataFromFrontend.firstName || !patientDataFromFrontend.lastName) {
      return NextResponse.json({ message: 'First name and last name are required.' }, { status: 400 });
    }

    // Prepare data to be sent to Firestore.
    // The patientConverter's toFirestore method will handle actual `FieldValue.serverTimestamp()`
    // and apply defaults for fields like 'email', 'allergies', 'status', etc.
    const patientToCreate: Omit<Patient, 'id'> = {
      ...patientDataFromFrontend,
      // Provide an initial FieldValue.serverTimestamp() for the converter to pick up
      // Casted to `any` because `FieldValue` is not strictly a `Timestamp` type
      createdAt: FieldValue.serverTimestamp() as any,
      updatedAt: FieldValue.serverTimestamp() as any,
    };

    // Add the patient data to the 'patients' collection in Firestore
    // Firestore will automatically generate the document ID.
    // Use the converter for writing to ensure consistency and correct timestamp handling.
    const docRef = await adminDb.collection('patients').withConverter(patientConverter).add(patientToCreate);

    // Fetch the newly created document to return its ID and the server-generated timestamps.
    // Using the converter ensures the returned data is correctly typed as Patient.
    const newPatientDoc = await docRef.get();

    if (!newPatientDoc.exists) {
      // This case should ideally not happen after a successful add
      return NextResponse.json({ message: 'Patient not found after creation.' }, { status: 404 });
    }

    // The converter's fromFirestore method is automatically called, returning a typed Patient object
    const createdPatient: Patient = newPatientDoc.data() as Patient;

    return NextResponse.json(createdPatient, { status: 201 }); // 201 Created

  } catch (error) {
    console.error('Error creating patient:', error);
    // Log the request body that caused the error for better debugging
    console.error('Request body that caused POST error:', patientDataFromFrontend ? JSON.stringify(patientDataFromFrontend, null, 2) : 'N/A');
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
    // Use the converter when fetching documents to ensure proper type mapping
    const patientsSnapshot = await adminDb.collection('patients').withConverter(patientConverter).get();

    // Map the documents; the converter's fromFirestore method is automatically called for each.
    // This provides a correctly typed Patient object for each document.
    const patients: Patient[] = patientsSnapshot.docs.map(doc => doc.data());

    return NextResponse.json(patients, { status: 200 });

  } catch (error) {
    console.error('Error fetching patients:', error);
    return NextResponse.json(
      { message: 'Failed to fetch patients', error: (error as Error).message },
      { status: 500 }
    );
  }
}

// src/app/api/patients/[patientId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Your Firebase Admin SDK instance
import { Patient } from '@/contexts/patient-context'; // Import your Patient interface

// Define the shape of the parameters for the dynamic route
interface PatientApiParams {
  params: {
    patientId: string;
  };
}

/**
 * Handles GET requests to fetch a single patient by ID.
 * @param req The NextRequest object.
 * @param params The dynamic route parameters, containing patientId.
 * @returns NextResponse with the patient data or an error message.
 */
export async function GET(req: NextRequest, { params }: PatientApiParams) {
  try {
    const { patientId } = params;

    const patientDoc = await adminDb.collection('patients').doc(patientId).get();

    if (!patientDoc.exists) {
      return NextResponse.json({ message: 'Patient not found' }, { status: 404 });
    }

    // Cast the data to your Patient interface and include the document ID
    const patientData: Patient = {
      id: patientDoc.id,
      ...(patientDoc.data() as Omit<Patient, 'id'>) // Exclude 'id' from the casted data as we're adding it manually
    };

    return NextResponse.json(patientData, { status: 200 });

  } catch (error) {
    console.error('Error fetching patient:', error);
    return NextResponse.json(
      { message: 'Failed to fetch patient', error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Handles PATCH requests to update a single patient by ID.
 * @param req The NextRequest object containing the updated patient data.
 * @param params The dynamic route parameters, containing patientId.
 * @returns NextResponse with the updated patient data or an error message.
 */
export async function PATCH(req: NextRequest, { params }: PatientApiParams) {
  try {
    const { patientId } = params;
    // The request body will contain a partial Patient object with updated fields
    const updatedData: Partial<Patient> = await req.json();

    // --- DIAGNOSTIC CONSOLE.LOGS START ---
    console.log('Incoming PATCH request to /api/patients/', patientId);
    console.log('Received updatedData from frontend:', JSON.stringify(updatedData, null, 2)); // Stringify for readable JSON output
    console.log('Does updatedData contain status property?', 'status' in updatedData);
    if ('status' in updatedData) {
        console.log('Value of status in updatedData:', updatedData.status);
    } else {
        console.log('Status property is NOT present in updatedData.');
    }
    // --- DIAGNOSTIC CONSOLE.LOGS END ---

    // Use object destructuring to exclude 'id' and 'createdAt'
    // These properties should not be updated directly from the client.
    const { id, createdAt, ...dataToUpdate } = updatedData;

    // Perform the update in Firestore with the filtered data
    await adminDb.collection('patients').doc(patientId).update(dataToUpdate);

    // Fetch the updated document to return the complete, current state
    const updatedPatientDoc = await adminDb.collection('patients').doc(patientId).get();

    if (!updatedPatientDoc.exists) {
        // This case should ideally not happen if update was successful
        return NextResponse.json({ message: 'Updated patient not found after update' }, { status: 404 });
    }

    const patientResponse: Patient = {
        id: updatedPatientDoc.id,
        ...(updatedPatientDoc.data() as Omit<Patient, 'id'>)
    };

    return NextResponse.json(patientResponse, { status: 200 });

  } catch (error) {
    console.error('Error updating patient:', error);
    // Add more specific error handling if needed (e.g., Firestore validation errors)
    return NextResponse.json(
      { message: 'Failed to update patient', error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Handles DELETE requests to delete a single patient by ID.
 * @param req The NextRequest object.
 * @param params The dynamic route parameters, containing patientId.
 * @returns NextResponse with a success message or an error message.
 */
export async function DELETE(req: NextRequest, { params }: PatientApiParams) {
  try {
    const { patientId } = params;

    await adminDb.collection('patients').doc(patientId).delete();

    return NextResponse.json({ message: 'Patient deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error deleting patient:', error);
    return NextResponse.json(
      { message: 'Failed to delete patient', error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Handles POST requests to create a new patient.
 * Note: This is added here but ideally should be in /api/patients (without patientId param).
 * For now, adding it here to handle POST requests without breaking.
 */
export async function POST(req: NextRequest) {
  try {
    const newPatientData: Partial<Patient> = await req.json();

    // Add validation here if needed (e.g., required fields)

    const docRef = await adminDb.collection('patients').add(newPatientData);

    const createdPatientDoc = await docRef.get();

    const createdPatient: Patient = {
      id: createdPatientDoc.id,
      ...(createdPatientDoc.data() as Omit<Patient, 'id'>),
    };

    return NextResponse.json(createdPatient, { status: 201 });
  } catch (error) {
    console.error('Error creating patient:', error);
    return NextResponse.json(
      { message: 'Failed to create patient', error: (error as Error).message },
      { status: 500 }
    );
  }
}

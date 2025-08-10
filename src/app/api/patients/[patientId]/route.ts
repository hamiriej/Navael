// src/app/api/patients/[patientId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Your Firebase Admin SDK instance
import { Timestamp, FieldValue } from 'firebase-admin/firestore'; // Import Timestamp and FieldValue
import { Patient } from '@/contexts/patient-context'; // Import your Patient interface

// Import AI client library. Assuming Google Generative AI for this example.
import { GoogleGenerativeAI } from '@google/generative-ai'; // Make sure you have installed: npm install @google/generative-ai


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

    // Cast the data to your Patient interface.
    // Ensure `createdAt` and `updatedAt` are correctly cast to Timestamp if your interface expects them.
    // Apply safer defaults for optional fields if they might be missing in Firestore.
    const patientData: Patient = {
      id: patientDoc.id,
      // Assuming all fields are present or handled by your Patient interface directly
      // If any fields are optional and you want strict defaults:
      // email: (patientDoc.data()?.email || '') as string,
      // allergies: (patientDoc.data()?.allergies || []) as string[],
      ...(patientDoc.data() as Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>), // Cast other common fields
      createdAt: patientDoc.data()?.createdAt as Timestamp, // Explicitly cast to Timestamp
      updatedAt: patientDoc.data()?.updatedAt as Timestamp, // Explicitly cast to Timestamp
    };

    return NextResponse.json(patientData, { status: 200 });

  } catch (error) {
    console.error(`Error fetching patient ${params.patientId}:`, error);
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
  let updatedData: Partial<Patient> | undefined; // Declare outside try for error logging

  try {
    const { patientId } = params;
    updatedData = await req.json(); // The request body will contain a partial Patient object

    console.log(`Incoming PATCH request to /api/patients/${patientId}, payload:`, JSON.stringify(updatedData, null, 2));

    // Exclude 'id' and 'createdAt' from direct update
    const { id, createdAt, ...dataToUpdate } = updatedData;

    // Add server-side 'updatedAt' timestamp using FieldValue.serverTimestamp()
    const finalDataToUpdate = {
      ...dataToUpdate,
      updatedAt: FieldValue.serverTimestamp(), // Consistent timestamp for updates
    };

    await adminDb.collection('patients').doc(patientId).update(finalDataToUpdate);

    // Fetch the updated document to return the complete, current state
    const updatedPatientDoc = await adminDb.collection('patients').doc(patientId).get();

    if (!updatedPatientDoc.exists) {
        return NextResponse.json({ message: 'Updated patient not found after update' }, { status: 404 });
    }

    const patientResponse: Patient = {
        id: updatedPatientDoc.id,
        // Apply safer defaults and type casting when constructing the response
        ...(updatedPatientDoc.data() as Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>),
        createdAt: updatedPatientDoc.data()?.createdAt as Timestamp,
        updatedAt: updatedPatientDoc.data()?.updatedAt as Timestamp,
    };

    return NextResponse.json(patientResponse, { status: 200 });

  } catch (error) {
    console.error(`Error updating patient ${params.patientId}:`, error);
    // Log the payload if the update failed for better debugging
    console.error('Payload that caused PATCH error:', updatedData ? JSON.stringify(updatedData, null, 2) : 'N/A');
    return NextResponse.json(
      { message: 'Failed to update patient', error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Handles POST requests to generate and potentially save an AI summary for a patient.
 * THIS IS THE NEW HANDLER FOR YOUR AI FEATURE!
 * @param req The NextRequest object containing data for AI summary generation (e.g., consultation notes).
 * @param params The dynamic route parameters, containing patientId.
 * @returns NextResponse with the generated summary or an error message.
 */
export async function POST(req: NextRequest, { params }: PatientApiParams) {
  const { patientId } = params;
  let requestBody: { notesToSummarize?: string } | undefined; // Declare for error logging

  try {
    // 1. Get data from the request body
    requestBody = await req.json();
    const { notesToSummarize } = requestBody;

    console.log(`Incoming POST request to generate AI summary for patient ${patientId}, payload:`, JSON.stringify(requestBody, null, 2));

    if (!notesToSummarize || typeof notesToSummarize !== 'string' || notesToSummarize.trim() === '') {
      return NextResponse.json({ message: 'Consultation notes are required for AI summary.' }, { status: 400 });
    }

    // 2. Initialize your AI client (e.g., Google Generative AI)
    // Make sure process.env.google_api_key is set correctly in apphosting.yaml and Secret Manager.
    // The '!' asserts that the environment variable will exist at runtime.
    const genAI = new GoogleGenerativeAI(process.env.google_api_key!);

    // 3. Make the AI API call
    // Select your generative model (e.g., "gemini-pro", "gemini-1.5-pro-latest")
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Please provide a concise summary of the following patient consultation notes. Focus on key symptoms, diagnosis, treatment plan, and next steps:\n\n${notesToSummarize}`;

    console.log(`Sending prompt to AI for patient ${patientId}...`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiSummaryContent = response.text();
    console.log(`AI summary generated for patient ${patientId}.`);

    // 4. Optionally, save the summary to Firestore
    // Creating a subcollection 'aiSummaries' under the patient's document is a good pattern.
    const summaryData = {
      content: aiSummaryContent,
      notesUsed: notesToSummarize, // You might or might not want to save the original notes
      createdAt: FieldValue.serverTimestamp(), // Use serverTimestamp for accuracy
      patientId: patientId, // Redundant but useful for queries
      // Add other metadata like 'modelUsed', 'userId' if available from request context
    };

    const summaryRef = await adminDb
      .collection('patients')
      .doc(patientId)
      .collection('aiSummaries')
      .add(summaryData);

    console.log(`AI summary saved to Firestore with ID: ${summaryRef.id}`);

    // 5. Return the summary to the frontend
    return NextResponse.json(
      {
        message: 'AI summary generated successfully',
        summary: aiSummaryContent,
        summaryId: summaryRef.id // Return the ID of the new summary document
      },
      { status: 201 } // 201 Created is appropriate as a new resource (the summary) is created
    );

  } catch (error) {
    console.error(`Error generating AI summary for patient ${patientId}:`, error);
    // Log the request body that led to the error
    console.error('Payload that caused AI summary error:', requestBody ? JSON.stringify(requestBody, null, 2) : 'N/A');

    // Provide more specific error messages if certain common issues are detected (e.g., API key, permissions)
    let errorMessage = 'Failed to generate AI summary.';
    if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('API key')) {
            errorMessage = 'AI API key issue. Please check your google_api_key.';
        } else if (error.message.includes('permission denied')) {
            errorMessage = 'AI service permission issue. Check IAM roles for firebase-app-hosting-compute.';
        }
    }

    return NextResponse.json(
      { message: errorMessage, error: errorMessage },
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
    console.error(`Error deleting patient ${params.patientId}:`, error);
    return NextResponse.json(
      { message: 'Failed to delete patient', error: (error as Error).message },
      { status: 500 }
    );
  }
}

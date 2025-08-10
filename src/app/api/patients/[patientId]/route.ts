// src/app/api/patients/[patientId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Your Firebase Admin SDK instance
import { Patient } from '@/contexts/patient-context'; // Import your Patient interface
import { Timestamp } from 'firebase-admin/firestore'; // Import Timestamp for Firestore dates

// Import any necessary AI client libraries or utility functions here
// For example, if you're using Google's GenAI SDK:
// import { GoogleGenerativeAI } from '@google/generative-ai';


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
 * Handles POST requests to generate and potentially save an AI summary for a patient.
 * This is the handler you need to add for your AI feature!
 * @param req The NextRequest object containing data for AI summary generation (e.g., consultation notes).
 * @param params The dynamic route parameters, containing patientId.
 * @returns NextResponse with the generated summary or an error message.
 */
export async function POST(req: NextRequest, { params }: PatientApiParams) {
  const { patientId } = params;

  try {
    // 1. Get data from the request body
    // The frontend should send the notes/data needed for the AI summary
    const { notesToSummarize } = await req.json();

    if (!notesToSummarize || typeof notesToSummarize !== 'string') {
      return NextResponse.json({ message: 'Notes for AI summary are required.' }, { status: 400 });
    }

    console.log(`Generating AI summary for patient ${patientId}...`);
    // console.log('Notes:', notesToSummarize); // Be cautious logging sensitive patient data in production!

    // 2. Initialize your AI client (e.g., Google Generative AI)
    // You'll need to install the SDK if you haven't already: npm install @google/generative-ai
    // const genAI = new GoogleGenerativeAI(process.env.google_api_key!); // Use your environment variable

    // 3. Make the AI API call
    // const model = genAI.getGenerativeModel({ model: "gemini-pro" }); // Or your chosen model
    // const prompt = `Summarize the following patient consultation notes in a concise manner: ${notesToSummarize}`;
    // const result = await model.generateContent(prompt);
    // const response = await result.response;
    // const aiSummaryContent = response.text();

    // --- MOCK AI RESPONSE FOR DEVELOPMENT/TESTING ---
    // Remove this block once your actual AI integration is ready
    const aiSummaryContent = `AI Summary for Patient ${patientId}: The patient presented with [key symptom] and was advised [treatment/next steps]. This summary is derived from ${notesToSummarize.length} characters of notes.`;
    // --- END MOCK AI RESPONSE ---


    // 4. Optionally, save the summary to Firestore
    // You might create a subcollection of 'summaries' under the patient's document
    const summaryRef = adminDb
      .collection('patients')
      .doc(patientId)
      .collection('aiSummaries')
      .add({
        content: aiSummaryContent,
        notesUsed: notesToSummarize, // You might or might not want to save the original notes
        createdAt: Timestamp.now(), // Use Firestore Timestamp
        // Add any other relevant metadata like 'modelUsed', 'userId' etc.
      });

    console.log(`AI summary generated and saved for patient ${patientId}`);

    // 5. Return the summary to the frontend
    return NextResponse.json(
      { message: 'AI summary generated successfully', summary: aiSummaryContent, summaryId: (await summaryRef).id },
      { status: 201 } // 201 Created is appropriate if you're creating a new summary record
    );

  } catch (error) {
    console.error(`Error generating AI summary for patient ${patientId}:`, error);

    // This is where potential errors from the AI API call or Firestore write would be caught.
    // Ensure `process.env.google_api_key` is correctly fetched, and the service account
    // has roles like `Vertex AI User` or `aiplatform.user` if using Google AI services.
    // Also, ensure it has `Secret Manager Secret Accessor` to get the key.

    return NextResponse.json(
      { message: 'Failed to generate AI summary', error: (error as Error).message },
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

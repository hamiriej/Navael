// src/ai/flows/summarize-patient-history-flow.ts

'use server'; // Keep this!
/**
 * @fileOverview An AI flow to summarize patient medical history.
 *
 * - summarizePatientHistory - A function that generates a concise summary of patient's health.
 * - SummarizePatientHistoryInput - The input type for the summarizePatientHistory function.
 * - SummarizePatientHistoryOutput - The return type for the summarizePatientHistory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MedicationSchema = z.object({
  name: z.string(),
  dosage: z.string(),
  frequency: z.string(),
});

// This is the strict schema that Genkit's flow will validate against.
const SummarizePatientHistoryInputSchema = z.object({
  patientId: z.string().describe("The unique identifier for the patient."),
  medicalHistoryNotes: z.string().optional().describe("Detailed notes on the patient's past medical history, conditions, and surgeries."),
  allergies: z.array(z.string()).optional().describe("A list of known allergies for the patient."), // Expects an array here!
  currentMedications: z.array(MedicationSchema).optional().describe("A list of current medications the patient is taking, including name, dosage, and frequency."),
});
export type SummarizePatientHistoryInput = z.infer<typeof SummarizePatientHistoryInputSchema>;

const SummarizePatientHistoryOutputSchema = z.object({
  summary: z.string().describe("A concise, easy-to-read summary of the patient's key medical history points."),
});
export type SummarizePatientHistoryOutput = z.infer<typeof SummarizePatientHistoryOutputSchema>;

// Define a more flexible input type for the entry function,
// to handle cases where 'allergies' might come as a string from a database or other source.
type SummarizePatientHistoryRawInput = Omit<SummarizePatientHistoryInput, 'allergies' | 'currentMedications'> & {
  allergies?: string | string[]; // Allow string or string[]
  currentMedications?: Array<{ name: string; dosage: string; frequency: string }> | string; // Allow string for medications if needed
};

export async function summarizePatientHistory(rawInput: SummarizePatientHistoryRawInput): Promise<SummarizePatientHistoryOutput> {
  console.log('--- summarizePatientHistory: Function started ---');
  console.log('--- summarizePatientHistory: Received rawInput:', JSON.stringify(rawInput));

  const processedInput: SummarizePatientHistoryInput = {
    patientId: rawInput.patientId,
    medicalHistoryNotes: rawInput.medicalHistoryNotes || undefined, // Ensure optional fields are undefined if empty
  };

  // --- CRITICAL FIX FOR ALLERGIES ---
  if (typeof rawInput.allergies === 'string') {
    processedInput.allergies = rawInput.allergies.split(',').map(a => a.trim()).filter(Boolean);
  } else if (Array.isArray(rawInput.allergies)) {
    processedInput.allergies = rawInput.allergies.filter(a => typeof a === 'string' && a.trim() !== '');
  } else {
    processedInput.allergies = [];
  }

  // --- FIX FOR currentMedications (similar issue often happens here) ---
  if (typeof rawInput.currentMedications === 'string') {
    processedInput.currentMedications = rawInput.currentMedications.split('\n').map(line => {
      const parts = line.split(' ');
      return { name: parts[0] || "Unknown", dosage: parts[1] || "", frequency: parts.slice(2).join(' ') || "" };
    }).filter(m => m.name !== "Unknown" || m.dosage !== "" || m.frequency !== "");
  } else if (Array.isArray(rawInput.currentMedications)) {
    processedInput.currentMedications = rawInput.currentMedications.filter(m =>
      typeof m === 'object' && m !== null && 'name' in m && 'dosage' in m && 'frequency' in m
    );
  } else {
    processedInput.currentMedications = [];
  }
  // --- END FIX FOR currentMedications ---

  console.log('--- summarizePatientHistory: Processed Input for Genkit:', JSON.stringify(processedInput));

  try {
    const result = await summarizePatientHistoryFlow(processedInput); // This is where the error likely originates
    console.log('--- summarizePatientHistory: Genkit flow completed successfully. ---');
    console.log('--- summarizePatientHistory: Function ending successfully. ---');
    return result;
  } catch (error) {
    // *** THIS IS THE CRUCIAL PART - Log the error details ***
    console.error('--- summarizePatientHistory: ERROR encountered during Genkit flow ---');
    console.error('--- summarizePatientHistory: Error message:', (error as Error).message);
    console.error('--- summarizePatientHistory: Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('--- summarizePatientHistory: Error stack trace:', (error as Error).stack);
    console.error('--- summarizePatientHistory: Function ending with error. ---');
    throw error; // Re-throw the error so the 500 still happens, but we've captured the details
  }
}

const prompt = ai.definePrompt({
  name: 'summarizePatientHistoryPrompt',
  input: {schema: SummarizePatientHistoryInputSchema}, // This schema will be validated against processedInput
  output: {schema: SummarizePatientHistoryOutputSchema},
  prompt: `You are a helpful medical assistant AI. Your task is to generate a concise and clinically relevant summary of a patient's medical history.
Focus on chronic conditions, significant past events or surgeries, active major issues, important allergies, and critical or long-term medications.
Be brief but informative. Use bullet points for lists where appropriate.

Patient ID: {{{patientId}}}

Medical History Notes:
{{#if medicalHistoryNotes}}
{{{medicalHistoryNotes}}}
{{else}}
No specific history notes provided.
{{/if}}

Allergies:
{{#if allergies.length}}
  {{#each allergies}}
- {{{this}}}
  {{/each}}
{{else}}
None reported.
{{/if}}

Current Medications:
{{#if currentMedications.length}}
  {{#each currentMedications}}
- {{{this.name}}} ({{{this.dosage}}}, {{{this.frequency}}})
  {{/each}}
{{else}}
None reported.
{{/if}}

Based on the information above, provide the summary in the 'summary' field.
Example of a good summary:
"Patient has a history of hypertension, well-controlled on Lisinopril. Allergic to Penicillin (rash). Appendix removed in 2010. Currently stable."
`,
});

const summarizePatientHistoryFlow = ai.defineFlow(
  {
    name: 'summarizePatientHistoryFlow',
    inputSchema: SummarizePatientHistoryInputSchema, // This schema will also be validated against processedInput
    outputSchema: SummarizePatientHistoryOutputSchema,
  },
  async (input: SummarizePatientHistoryInput) => {
    console.log('--- summarizePatientHistoryFlow: Executing AI prompt ---');
    const {output} = await prompt(input);
    console.log('--- summarizePatientHistoryFlow: AI prompt returned. Output present:', !!output);
    if (!output) {
        console.error('--- summarizePatientHistoryFlow: AI prompt did not return an output. ---');
        throw new Error("AI failed to generate a patient history summary.");
    }
    return output;
  }
);

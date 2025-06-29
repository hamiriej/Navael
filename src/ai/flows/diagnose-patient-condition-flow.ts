'use server';
/**
 * @fileOverview An AI flow to assist clinicians by suggesting potential diagnoses based on patient data.
 *
 * - diagnosePatientCondition - A function that analyzes patient history and symptoms to provide diagnostic suggestions.
 * - DiagnosePatientConditionInput - The input type for the diagnosePatientCondition function.
 * - DiagnosePatientConditionOutput - The return type for the diagnosePatientCondition function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MedicationSchema = z.object({
  name: z.string(),
  dosage: z.string(),
  frequency: z.string(),
});

const DiagnosePatientConditionInputSchema = z.object({
  patientId: z.string().describe("The unique identifier for the patient."),
  medicalHistoryNotes: z.string().optional().describe("Detailed notes on the patient's past medical history, conditions, and surgeries."),
  currentSymptoms: z.string().describe("A description of the patient's current symptoms or reason for visit."),
  allergies: z.array(z.string()).optional().describe("A list of known allergies for the patient."),
  currentMedications: z.array(MedicationSchema).optional().describe("A list of current medications the patient is taking."),
  age: z.number().optional().describe("The patient's age in years."),
  gender: z.string().optional().describe("The patient's gender (e.g., Male, Female, Other)."),
});
export type DiagnosePatientConditionInput = z.infer<typeof DiagnosePatientConditionInputSchema>;

const PossibleConditionSchema = z.object({
    name: z.string().describe("The name of the possible medical condition."),
    likelihood: z.enum(['High', 'Medium', 'Low']).describe("The assessed likelihood of this condition."),
    reasoning: z.string().describe("The reasoning behind suggesting this condition based on the provided data."),
});

const DiagnosePatientConditionOutputSchema = z.object({
  possibleConditions: z.array(PossibleConditionSchema).describe("A list of possible medical conditions with their likelihood and reasoning."),
  suggestedNextSteps: z.array(z.string()).optional().describe("Suggested next steps for the clinician, such as further tests or referrals."),
  urgency: z.enum(['Low', 'Medium', 'High']).optional().describe("The AI's assessment of the potential urgency based on symptoms and history."),
  disclaimer: z.string().describe("A mandatory disclaimer stating that AI suggestions are not a substitute for professional medical advice."),
});
export type DiagnosePatientConditionOutput = z.infer<typeof DiagnosePatientConditionOutputSchema>;

export async function diagnosePatientCondition(input: DiagnosePatientConditionInput): Promise<DiagnosePatientConditionOutput> {
  return diagnosePatientConditionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'diagnosePatientConditionPrompt',
  input: {schema: DiagnosePatientConditionInputSchema},
  output: {schema: DiagnosePatientConditionOutputSchema},
  prompt: `You are an AI medical diagnostic assistant. Your role is to analyze the provided patient information and suggest potential medical conditions, their likelihood, reasoning, and possible next steps for the clinician.
You MUST ALWAYS include a disclaimer that your output is for informational purposes only and not a substitute for professional medical diagnosis.

Patient Information:
- ID: {{{patientId}}}
- Age: {{#if age}}{{{age}}}{{else}}Not provided{{/if}}
- Gender: {{#if gender}}{{{gender}}}{{else}}Not provided{{/if}}

Current Symptoms/Reason for Visit:
{{{currentSymptoms}}}

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

Based on all the information above, provide:
1.  A list of possible medical conditions. For each condition, specify its name, likelihood (High, Medium, or Low), and a brief reasoning.
2.  Suggest potential next steps for the clinician (e.g., specific tests, specialist referrals, monitoring advice).
3.  Assess the potential urgency (Low, Medium, High) based on the symptoms and history.
4.  Crucially, you MUST include the following disclaimer in the 'disclaimer' field: "This AI-generated information is for suggestive purposes only and not a substitute for professional medical diagnosis and judgment. Always consult with a qualified healthcare provider."

Structure your response according to the output schema.
`,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  }
});

const diagnosePatientConditionFlow = ai.defineFlow(
  {
    name: 'diagnosePatientConditionFlow',
    inputSchema: DiagnosePatientConditionInputSchema,
    outputSchema: DiagnosePatientConditionOutputSchema,
  },
  async (input: DiagnosePatientConditionInput) => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("AI failed to generate diagnostic suggestions.");
    }
    // Ensure disclaimer is always present, even if AI somehow forgets
    if (!output.disclaimer) {
        output.disclaimer = "This AI-generated information is for suggestive purposes only and not a substitute for professional medical diagnosis and judgment. Always consult with a qualified healthcare provider.";
    }
    return output;
  }
);

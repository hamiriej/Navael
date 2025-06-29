'use server';
/**
 * @fileOverview An AI flow to suggest medical codes (ICD-10, CPT) based on clinical notes.
 *
 * - suggestMedicalCodes - A function that analyzes clinical text and suggests relevant medical codes.
 * - SuggestMedicalCodesInput - The input type for the suggestMedicalCodes function.
 * - SuggestMedicalCodesOutput - The return type for the suggestMedicalCodes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const SuggestMedicalCodesInputSchema = z.object({
  clinicalText: z.string().describe("The clinical text to analyze, typically including diagnosis, assessment, and plan sections from a consultation note."),
  // We could add a patientAge or gender here if coding rules differ significantly,
  // but for now, we'll keep it simple and focus on the text.
});
export type SuggestMedicalCodesInput = z.infer<typeof SuggestMedicalCodesInputSchema>;

const MedicalCodeSuggestionSchema = z.object({
  codeType: z.string().describe("The type of medical code suggested (e.g., 'ICD-10-CM', 'CPT')."),
  code: z.string().describe("The medical code itself (e.g., 'J02.9', '99213')."),
  description: z.string().describe("A brief description of the medical code."),
  reasoning: z.string().optional().describe("The AI's reasoning for suggesting this specific code based on the provided text."),
});

const SuggestMedicalCodesOutputSchema = z.object({
  suggestedCodes: z.array(MedicalCodeSuggestionSchema).describe("A list of suggested medical codes."),
  confidenceNotes: z.string().optional().describe("Any notes from the AI about its confidence in the suggestions or limitations."),
  disclaimer: z.string().default("AI-generated coding suggestions are for informational purposes only and require review and verification by a qualified medical coder or clinician. Final coding decisions are the responsibility of the healthcare provider.").describe("Standard disclaimer for AI coding suggestions."),
});
export type SuggestMedicalCodesOutput = z.infer<typeof SuggestMedicalCodesOutputSchema>;

export async function suggestMedicalCodes(input: SuggestMedicalCodesInput): Promise<SuggestMedicalCodesOutput> {
  return suggestMedicalCodesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestMedicalCodesPrompt',
  input: {schema: SuggestMedicalCodesInputSchema},
  output: {schema: SuggestMedicalCodesOutputSchema},
  prompt: `You are an AI Medical Coding Assistant. Your task is to analyze the provided clinical text and suggest relevant medical codes, primarily ICD-10-CM for diagnoses and CPT codes for procedures or services if inferable.

Clinical Text to Analyze:
"{{{clinicalText}}}"

Based on this text:
1.  Identify potential diagnoses and suggest appropriate ICD-10-CM codes.
2.  If procedures or specific evaluation and management services are described or clearly implied, suggest appropriate CPT codes.
3.  For each suggested code, provide the 'codeType', 'code', 'description', and a brief 'reasoning' connecting it to the text.
4.  Provide overall 'confidenceNotes' regarding your suggestions.
5.  ALWAYS include the standard 'disclaimer' in your output.

Focus on the most salient conditions and services. Do not infer codes for very minor or vaguely mentioned items unless they are central to the assessment or plan.
Be specific if possible (e.g., prefer a specific pharyngitis code over a general URI code if details support it).
Aim for accuracy based on typical coding practices.

Example of good suggestions for "Patient seen for follow-up of hypertension. BP 130/80. Continue Lisinopril.":
{
  "suggestedCodes": [
    { "codeType": "ICD-10-CM", "code": "I10", "description": "Essential (primary) hypertension", "reasoning": "Hypertension is explicitly mentioned as the reason for follow-up." },
    { "codeType": "CPT", "code": "99213", "description": "Office or other outpatient visit for the evaluation and management of an established patient", "reasoning": "Implied by 'follow-up' visit context." }
  ],
  "confidenceNotes": "High confidence for ICD-10 code. CPT code is a common E/M code for outpatient follow-ups.",
  "disclaimer": "AI-generated coding suggestions are for informational purposes only and require review and verification by a qualified medical coder or clinician. Final coding decisions are the responsibility of the healthcare provider."
}
`,
});

const suggestMedicalCodesFlow = ai.defineFlow(
  {
    name: 'suggestMedicalCodesFlow',
    inputSchema: SuggestMedicalCodesInputSchema,
    outputSchema: SuggestMedicalCodesOutputSchema,
  },
  async (input: SuggestMedicalCodesInput) => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("AI failed to generate medical coding suggestions.");
    }
    // Ensure disclaimer is always present
    if (!output.disclaimer) {
        output.disclaimer = "AI-generated coding suggestions are for informational purposes only and require review and verification by a qualified medical coder or clinician. Final coding decisions are the responsibility of the healthcare provider.";
    }
    return output;
  }
);

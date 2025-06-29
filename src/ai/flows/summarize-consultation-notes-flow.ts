'use server';
/**
 * @fileOverview An AI flow to summarize clinical notes from a consultation.
 *
 * - summarizeConsultationNotes - A function that generates a concise summary of provided clinical notes.
 * - SummarizeConsultationNotesInput - The input type for the summarizeConsultationNotes function.
 * - SummarizeConsultationNotesOutput - The return type for the summarizeConsultationNotes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeConsultationNotesInputSchema = z.object({
  notesToSummarize: z.string().describe("The combined clinical notes from the current consultation to be summarized."),
});
export type SummarizeConsultationNotesInput = z.infer<typeof SummarizeConsultationNotesInputSchema>;

const SummarizeConsultationNotesOutputSchema = z.object({
  summary: z.string().describe("A concise summary of the provided clinical notes, highlighting key points relevant for the consultation record."),
});
export type SummarizeConsultationNotesOutput = z.infer<typeof SummarizeConsultationNotesOutputSchema>;

export async function summarizeConsultationNotes(input: SummarizeConsultationNotesInput): Promise<SummarizeConsultationNotesOutput> {
  return summarizeConsultationNotesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeConsultationNotesPrompt',
  input: {schema: SummarizeConsultationNotesInputSchema},
  output: {schema: SummarizeConsultationNotesOutputSchema},
  prompt: `You are a helpful medical assistant AI. Your task is to generate a concise and clinically relevant summary of the provided consultation notes.
Focus on the main complaints, key findings, and any immediate conclusions or primary assessments mentioned.
Be brief but informative. Aim for 2-4 sentences.

Consultation Notes to Summarize:
{{{notesToSummarize}}}

Based on the notes above, provide a short summary in the 'summary' field.
Example of a good summary:
"Patient presented with sore throat and fever. Examination revealed pharyngeal erythema. Likely viral pharyngitis. Advised rest and hydration."
`,
});

const summarizeConsultationNotesFlow = ai.defineFlow(
  {
    name: 'summarizeConsultationNotesFlow',
    inputSchema: SummarizeConsultationNotesInputSchema,
    outputSchema: SummarizeConsultationNotesOutputSchema,
  },
  async (input: SummarizeConsultationNotesInput) => {
    const {output} = await prompt(input);
    if (!output) {
        console.error('AI prompt did not return an output for summarizeConsultationNotesFlow.');
        throw new Error("AI failed to generate a summary for the consultation notes.");
    }
    return output;
  }
);

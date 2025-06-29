'use server';
/**
 * @fileOverview An AI flow to generate patient education material.
 *
 * - generatePatientEducation - A function that creates educational content about a medical condition.
 * - GeneratePatientEducationInput - The input type for the generatePatientEducation function.
 * - GeneratePatientEducationOutput - The return type for the generatePatientEducation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePatientEducationInputSchema = z.object({
  condition: z.string().describe("The medical condition or diagnosis for which to generate educational material."),
  patientAge: z.number().optional().describe("The age of the patient, to help tailor the language style."),
  languageLevel: z.enum(["Simple", "Standard", "Detailed"]).default("Standard").optional().describe("The desired complexity of the language used in the material."),
});
export type GeneratePatientEducationInput = z.infer<typeof GeneratePatientEducationInputSchema>;

const GeneratePatientEducationOutputSchema = z.object({
  title: z.string().describe("A suitable title for the patient education material."),
  explanation: z.string().describe("A patient-friendly explanation of the condition: what it is, common causes, and general outlook."),
  symptomsToWatch: z.array(z.string()).optional().describe("Key symptoms patients should be aware of, monitor, or that might indicate worsening of the condition."),
  careTips: z.array(z.string()).optional().describe("Actionable self-care tips, lifestyle advice, or home treatments that can help manage the condition."),
  whenToSeekHelp: z.array(z.string()).optional().describe("Clear indications of when the patient should seek further medical attention or emergency care."),
  disclaimer: z.string().default("This information is for educational purposes only and should not replace advice from your healthcare provider. Always consult your doctor for any health concerns.").describe("A standard medical disclaimer."),
});
export type GeneratePatientEducationOutput = z.infer<typeof GeneratePatientEducationOutputSchema>;

export async function generatePatientEducation(input: GeneratePatientEducationInput): Promise<GeneratePatientEducationOutput> {
  return generatePatientEducationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePatientEducationPrompt',
  input: {schema: GeneratePatientEducationInputSchema},
  output: {schema: GeneratePatientEducationOutputSchema},
  prompt: `You are a helpful medical communication AI. Your task is to generate clear, concise, and easy-to-understand educational material for a patient about the medical condition: "{{{condition}}}".

{{#if patientAge}}
Tailor the language appropriately for a patient approximately {{{patientAge}}} years old. For younger patients (e.g., under 16), use simpler language and analogies if helpful. For older patients, maintain clarity and directness.
{{/if}}

Use a "{{#if languageLevel}}{{languageLevel}}{{else}}Standard{{/if}}" language complexity.
- "Simple" means very basic terms, short sentences, and straightforward explanations.
- "Standard" is for general adult understanding, clear and informative without being overly technical.
- "Detailed" can include more medical terms if appropriate but ensure they are well-explained.

The material should include:
1.  A 'title' for the material (e.g., "Understanding Your Diagnosis: [Condition]").
2.  An 'explanation' of what the condition is, what typically causes it, and a general outlook or prognosis if appropriate and commonly discussed.
3.  A list of common or important 'symptomsToWatch' for, or that might indicate the condition is worsening.
4.  A list of practical 'careTips' the patient can follow (e.g., "Drink plenty of fluids," "Rest as much as possible," "Avoid [specific triggers]").
5.  A list of 'whenToSeekHelp' describing specific signs or situations when they should contact a doctor or go to an emergency room (e.g., "If you experience shortness of breath," "If symptoms do not improve in 3 days," "High fever unresponsive to medication").
6.  A standard 'disclaimer': "This information is for educational purposes only and should not replace advice from your healthcare provider. Always consult your doctor for any health concerns." Ensure this disclaimer is always part of the output.

Be empathetic and supportive in your tone.
Focus on providing actionable and reassuring information for the patient.
Organize the information logically.
`,
});

const generatePatientEducationFlow = ai.defineFlow(
  {
    name: 'generatePatientEducationFlow',
    inputSchema: GeneratePatientEducationInputSchema,
    outputSchema: GeneratePatientEducationOutputSchema,
  },
  async (input: GeneratePatientEducationInput) => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("AI failed to generate patient education material.");
    }
     // Ensure disclaimer is always present, even if AI somehow forgets
    if (!output.disclaimer) {
        output.disclaimer = "This information is for educational purposes only and should not replace advice from your healthcare provider. Always consult your doctor for any health concerns.";
    }
    return output;
  }
);

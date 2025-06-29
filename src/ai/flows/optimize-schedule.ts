'use server';

/**
 * @fileOverview AI-powered schedule optimization flow for receptionists.
 *
 * - optimizeSchedule - A function that analyzes the schedule and suggests optimal appointment times and resource allocation.
 * - OptimizeScheduleInput - The input type for the optimizeSchedule function.
 * - OptimizeScheduleOutput - The return type for the optimizeSchedule function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OptimizeScheduleInputSchema = z.object({
  scheduleData: z
    .string()
    .describe('A JSON string containing the current schedule data, including appointments, staff availability, and resource allocation.'),
  constraints: z
    .string()
    .optional()
    .describe('Optional JSON string containing constraints such as staff preferences, room availability, and equipment limitations.'),
});
export type OptimizeScheduleInput = z.infer<typeof OptimizeScheduleInputSchema>;

const OptimizeScheduleOutputSchema = z.object({
  optimizedSchedule: z
    .string()
    .describe('A JSON string containing the optimized schedule suggestions, including adjusted appointment times and resource allocations.'),
  rationale: z
    .string()
    .describe('A human-readable explanation of the changes made to the schedule and the reasoning behind them.'),
});
export type OptimizeScheduleOutput = z.infer<typeof OptimizeScheduleOutputSchema>;

export async function optimizeSchedule(input: OptimizeScheduleInput): Promise<OptimizeScheduleOutput> {
  return optimizeScheduleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'optimizeSchedulePrompt',
  input: {schema: OptimizeScheduleInputSchema},
  output: {schema: OptimizeScheduleOutputSchema},
  prompt: `You are an AI assistant designed to optimize healthcare schedules. Analyze the provided schedule data and suggest optimal appointment times and resource allocation to minimize conflicts and maximize efficiency.

Consider the following schedule data:

{{{scheduleData}}}

Consider also the following constraints:

{{#if constraints}}
{{{constraints}}}
{{else}}
There are no specific constraints.
{{/if}}

Provide the optimized schedule as a JSON string in the optimizedSchedule field and a human-readable explanation of the changes in the rationale field. Ensure the JSON is valid and parsable.
`,
});

const optimizeScheduleFlow = ai.defineFlow(
  {
    name: 'optimizeScheduleFlow',
    inputSchema: OptimizeScheduleInputSchema,
    outputSchema: OptimizeScheduleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      console.error('AI prompt did not return an output for optimizeScheduleFlow.');
      throw new Error("AI failed to generate an optimized schedule. The output was empty.");
    }
    return output;
  }
);

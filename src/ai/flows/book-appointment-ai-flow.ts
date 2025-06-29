'use server';
/**
 * @fileOverview An AI flow to parse natural language appointment requests.
 *
 * - bookAppointmentWithAI - A function that takes a natural language instruction and suggests structured appointment details.
 * - BookAppointmentAIInput - The input type for the bookAppointmentWithAI function.
 * - BookAppointmentAIOutput - The return type for the bookAppointmentWithAI function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { format } from 'date-fns'; // To provide current date context to AI

const BookAppointmentAIInputSchema = z.object({
  instruction: z.string().describe("The natural language instruction from the receptionist regarding the appointment to book."),
  currentDate: z.string().describe("The current date in YYYY-MM-DD format to help AI resolve relative dates like 'today' or 'next Tuesday'."),
  // We could add providerList and patientList here if we want the AI to try and match against known entities.
  // For now, we'll let it extract names as strings.
});
export type BookAppointmentAIInput = z.infer<typeof BookAppointmentAIInputSchema>;

const BookAppointmentAIOutputSchema = z.object({
  patientName: z.string().optional().describe("The identified name of the patient."),
  providerName: z.string().optional().describe("The identified name of the healthcare provider."),
  appointmentDateString: z.string().optional().describe("The interpreted appointment date. Try to format as YYYY-MM-DD if possible, otherwise describe (e.g., 'next Monday')."),
  timeSlotString: z.string().optional().describe("The interpreted appointment time (e.g., '3:00 PM', 'afternoon', 'morning')."),
  appointmentType: z.string().optional().describe("The type of appointment (e.g., 'Check-up', 'Consultation', 'Follow-up', 'Procedure'). Match to one of these if possible."),
  parsedSuccessfully: z.boolean().describe("True if the AI believes it has extracted the core information needed for an appointment, false otherwise."),
  aiConfidenceNotes: z.string().optional().describe("Brief notes from the AI about its interpretation, any uncertainties, or if it needs clarification."),
  errorMessage: z.string().optional().describe("Any error message if the AI failed to process the request."),
});
export type BookAppointmentAIOutput = z.infer<typeof BookAppointmentAIOutputSchema>;

export async function bookAppointmentWithAI(input: BookAppointmentAIInput): Promise<BookAppointmentAIOutput> {
  return bookAppointmentAIFlow(input);
}

const prompt = ai.definePrompt({
  name: 'bookAppointmentAIPrompt',
  input: {schema: BookAppointmentAIInputSchema},
  output: {schema: BookAppointmentAIOutputSchema},
  prompt: `You are an expert medical receptionist AI assistant. Your task is to parse a natural language instruction and extract key details for booking a medical appointment.
The current date is: {{currentDate}}. Use this to resolve relative date mentions like "tomorrow", "next Friday", etc.

Instruction from receptionist:
"{{{instruction}}}"

Based on this instruction, identify:
1.  **Patient Name**: The full name of the patient.
2.  **Provider Name**: The full name of the doctor or nurse.
3.  **Appointment Date**: Interpret any date mentions (e.g., "July 20th", "next Monday", "tomorrow"). If possible, convert to YYYY-MM-DD format. If exact date is unclear, describe it (e.g., "sometime next week").
4.  **Time Slot**: Interpret any time mentions (e.g., "3 PM", "afternoon", "morning").
5.  **Appointment Type**: Determine the type of appointment. Common types are "Check-up", "Consultation", "Follow-up", "Procedure". If the instruction implies one of these, use it. Otherwise, use the term mentioned.

If you are confident you have extracted the necessary details (at least patient name, provider name, and some indication of date/time), set 'parsedSuccessfully' to true.
Otherwise, set 'parsedSuccessfully' to false and use 'aiConfidenceNotes' to explain what information is missing or unclear.
If you are unable to process the request at all, provide an 'errorMessage'.

Example Output for "Book Alice Wonderland with Dr. Smith for a check-up tomorrow morning.":
{
  "patientName": "Alice Wonderland",
  "providerName": "Dr. Smith",
  "appointmentDateString": "YYYY-MM-DD (resolved date for tomorrow)",
  "timeSlotString": "morning",
  "appointmentType": "Check-up",
  "parsedSuccessfully": true,
  "aiConfidenceNotes": "Interpreted 'tomorrow morning' based on current date."
}

Example Output for "Need an appointment for Bob.":
{
  "patientName": "Bob",
  "parsedSuccessfully": false,
  "aiConfidenceNotes": "Missing provider name, desired date, time, and appointment type."
}
`,
});

const bookAppointmentAIFlow = ai.defineFlow(
  {
    name: 'bookAppointmentAIFlow',
    inputSchema: BookAppointmentAIInputSchema,
    outputSchema: BookAppointmentAIOutputSchema,
  },
  async (input: BookAppointmentAIInput) => {
    const {output} = await prompt(input);
    if (!output) {
        // This case should ideally be handled by the AI returning parsedSuccessfully: false and an error message.
        // But as a fallback:
        return {
            parsedSuccessfully: false,
            aiConfidenceNotes: "AI failed to generate a response. The request might be too complex or unclear.",
            errorMessage: "AI processing error."
        };
    }
    return output;
  }
);

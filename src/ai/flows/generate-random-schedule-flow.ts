
'use server';
/**
 * @fileOverview An AI flow to generate a random staff schedule, grouped by role.
 *
 * - generateRandomSchedule - A function that creates a schedule for staff members.
 */

import {ai} from '@/ai/genkit';
import { 
    GenerateScheduleInputSchema, 
    GenerateScheduleOutputSchema, 
    type GenerateScheduleInput, 
    type GenerateScheduleOutput 
} from '@/ai/schemas/schedule-schemas';

export async function generateRandomSchedule(input: GenerateScheduleInput): Promise<GenerateScheduleOutput> {
  return generateRandomScheduleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRandomSchedulePrompt',
  input: {schema: GenerateScheduleInputSchema},
  output: {schema: GenerateScheduleOutputSchema},
  prompt: `You are an AI assistant. Your primary task is to generate a staff schedule, **thinking role by role**, for a healthcare facility covering a {{numberOfDays}}-day period starting on {{startDate}}.
You will receive a 'staffList' containing staff members and their assigned roles.

The scheduling process should be as follows:
1.  For each distinct role found in the 'staffList':
    a.  Identify all staff members belonging to this role.
    b.  For each of these staff members, and for each of the {{numberOfDays}} days, assign exactly one shift type ("Day", "Night", or "Day Off").
    c.  When assigning shifts, strictly adhere to the "Role-Based Scheduling Rules" provided below.
    d.  Use the "Default Shift Times" for "Day" and "Night" shifts. "Day Off" shifts do not have times.
2.  Your final output must be a JSON object structured according to the "Output Format" instruction.
3.  Ensure all generated 'staffName' and 'staffId' values in the output shifts match exactly with the provided input 'staffList'.
4.  Ensure all dates are in YYYY-MM-DD format, incrementing correctly from the 'startDate'.
5.  Optionally, if you have any brief, high-level suggestions about the generated schedule (e.g., "Dr. X is sole Doctor, covering all shifts" or "Consider role balance for critical shifts"), include them in the 'suggestions' field.


Staff Members Input:
{{#each staffList}}
- Name: {{this.name}}, ID: {{this.id}}, Role: {{this.role}}
{{/each}}

Default Shift Times Input (use these for "Day", "Night" shifts; omit for "Day Off"):
- Day: {{{defaultShiftTimes.Day.startTime}}} - {{{defaultShiftTimes.Day.endTime}}}
- Night: {{{defaultShiftTimes.Night.startTime}}} - {{{defaultShiftTimes.Night.endTime}}}

Role-Based Scheduling Rules:
*   **Critical Single-Staff Coverage:** If a role is filled by only ONE staff member in the provided 'staffList':
    *   This staff member is critical for their role's coverage.
    *   You MUST assign them a mix of "Day" and "Night" shifts across the {{numberOfDays}}-day period.
    *   They should NOT be assigned "Day Off" during this period, as they are the sole cover for their role.
    *   Distribute their "Day" and "Night" shifts to provide varied coverage throughout the week.
*   **Multi-Staff Roles:** For roles with multiple staff members:
    *   When randomly assigning shifts, consider the staff member's role (e.g., Doctor, Nurse, Lab Tech, Admin, Receptionist, Pharmacist).
    *   While this is a random schedule, aim for a distribution that seems plausible. For instance, try to ensure that critical roles like 'Doctor' and 'Nurse' have some presence across different shift types (Day, Night) rather than being concentrated on one shift type or all having a 'Day Off' simultaneously, if possible within the randomness.
    *   Distribute 'Day Off' shifts reasonably across these staff members.
    *   You do not have specific minimum staffing levels to meet per role for this *random* generation, but use the role information to make the random assignment appear more sensible for a healthcare facility.

Output Format:
The output must be a JSON object with a 'schedulesByRole' field. This field must be an array. Each element in this array represents a distinct staff role from the input 'staffList'.
Each role object must contain:
*   A 'role' field (string, e.g., "Doctor", "Nurse").
*   A 'shifts' field, which is an array of shift objects (GeneratedShiftSchema) for all staff members belonging to that role, covering all {{numberOfDays}} days.

Example of one output shift object within a role group:
{ "staffId": "S001", "staffName": "Dr. Evelyn Reed", "date": "2024-08-01", "shiftType": "Day", "startTime": "08:00", "endTime": "20:00" }

Example of the overall output structure:
{
  "schedulesByRole": [
    {
      "role": "Doctor",
      "shifts": [
        { "staffId": "S001", "staffName": "Dr. Evelyn Reed", "date": "2024-08-01", "shiftType": "Day", "startTime": "08:00", "endTime": "20:00" }
        // ... more doctor shifts
      ]
    },
    {
      "role": "Nurse",
      "shifts": [
        { "staffId": "S002", "staffName": "Nurse Ben Carter", "date": "2024-08-01", "shiftType": "Day Off" }
        // ... more nurse shifts
      ]
    }
    // ... etc. for other roles
  ],
  "suggestions": "Consider role balance for critical shifts."
}
`,
});

const generateRandomScheduleFlow = ai.defineFlow(
  {
    name: 'generateRandomScheduleFlow',
    inputSchema: GenerateScheduleInputSchema,
    outputSchema: GenerateScheduleOutputSchema,
  },
  async (rawInput: GenerateScheduleInput) => { 
    const inputForProcessing = {
        ...rawInput,
        defaultShiftTimes: { // Ensure defaultShiftTimes structure for the prompt
            Day: {
                startTime: rawInput.defaultShiftTimes?.Day?.startTime || "08:00",
                endTime: rawInput.defaultShiftTimes?.Day?.endTime || "20:00",
            },
            Night: {
                startTime: rawInput.defaultShiftTimes?.Night?.startTime || "20:00",
                endTime: rawInput.defaultShiftTimes?.Night?.endTime || "08:00",
            },
        },
    };

    const {output} = await prompt(inputForProcessing);

    if (!output || !output.schedulesByRole) {
        console.error('AI prompt did not return a valid output for generateRandomScheduleFlow.');
        throw new Error("AI failed to generate a schedule. The output was empty, malformed, or did not contain 'schedulesByRole'.");
    }
    
    const validStaffIds = new Set(inputForProcessing.staffList.map(s => s.id));
    
    for (const roleSchedule of output.schedulesByRole) {
        if (!roleSchedule.shifts) continue; 

        for (const shift of roleSchedule.shifts) {
            if (!validStaffIds.has(shift.staffId)) {
                throw new Error(`AI generated a shift for an unknown staffId: ${shift.staffId} (Name: ${shift.staffName}). Please ensure staffId and staffName match the input list.`);
            }

            if (shift.shiftType !== "Day Off") {
                let assignedStartTime = shift.startTime;
                let assignedEndTime = shift.endTime;

                if (!assignedStartTime || !assignedEndTime) {
                    const shiftTypeKey = shift.shiftType as 'Day' | 'Night'; // Updated type
                    const typeDefaults = inputForProcessing.defaultShiftTimes[shiftTypeKey]; 

                    if (typeDefaults) {
                        if (!assignedStartTime) {
                            shift.startTime = typeDefaults.startTime;
                        }
                        if (!assignedEndTime) {
                            shift.endTime = typeDefaults.endTime;
                        }
                    }
                }
                
                if (!shift.startTime || !shift.endTime) {
                     throw new Error(`Shift type '${shift.shiftType}' for ${shift.staffName} on ${shift.date} is missing startTime or endTime, and defaults could not be applied.`);
                }
            }
        }
    }
    return output;
  }
);

    

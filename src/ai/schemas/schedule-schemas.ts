
import { z } from 'zod';

export const StaffMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
});

export const GeneratedShiftSchema = z.object({
  staffId: z.string().describe("The ID of the staff member assigned to this shift."),
  staffName: z.string().describe("The name of the staff member. This should match a name from the input staffList."),
  date: z.string().describe("The date of the shift in YYYY-MM-DD format."),
  shiftType: z.enum(["Day", "Night", "Day Off"]).describe("The type of shift."),
  startTime: z.string().optional().describe("The start time of the shift in HH:mm format (required if not Day Off)."),
  endTime: z.string().optional().describe("The end time of the shift in HH:mm format (required if not Day Off)."),
  notes: z.string().optional().describe("Any notes for this specific shift assignment (e.g., 'Covers Dr. X'). Keep brief."),
});

export const GenerateScheduleInputSchema = z.object({
  staffList: z.array(StaffMemberSchema).describe("A list of staff members available for scheduling."),
  startDate: z.string().describe("The start date for the schedule period in YYYY-MM-DD format."),
  numberOfDays: z.number().min(1).max(14).default(7).describe("The number of days to generate the schedule for (e.g., 7 for a week)."),
  defaultShiftTimes: z.object({
    Day: z.object({ startTime: z.string(), endTime: z.string() }).default({ startTime: "08:00", endTime: "20:00" }),
    Night: z.object({ startTime: z.string(), endTime: z.string() }).default({ startTime: "20:00", endTime: "08:00" }),
  }).default({ // Default for the entire defaultShiftTimes object
    Day: { startTime: "08:00", endTime: "20:00" },
    Night: { startTime: "20:00", endTime: "08:00" },
  }).describe("Default start and end times for standard shifts. This structure, including Day and Night times, is defaulted if not provided in the input."),
});
export type GenerateScheduleInput = z.infer<typeof GenerateScheduleInputSchema>;

const RoleScheduleSchema = z.object({
  role: z.string().describe("The role of the staff members in this schedule group (e.g., 'Doctor', 'Nurse')."),
  shifts: z.array(GeneratedShiftSchema).describe("An array of generated shifts for all staff members belonging to this role.")
});

export const GenerateScheduleOutputSchema = z.object({
  schedulesByRole: z.array(RoleScheduleSchema).describe("An array of schedule objects, each grouped by staff role."),
  suggestions: z.string().optional().describe("Any suggestions or notes from the AI about the generated schedule (e.g., coverage concerns, or if a staff member was consistently off).")
});
export type GenerateScheduleOutput = z.infer<typeof GenerateScheduleOutputSchema>;

    
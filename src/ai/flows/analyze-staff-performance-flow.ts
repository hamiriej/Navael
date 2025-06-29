'use server';
/**
 * @fileOverview An AI flow to analyze staff performance based on schedule and attendance data.
 *
 * - analyzeStaffPerformance - A function that takes staff schedule/attendance and provides a performance summary.
 * - AnalyzeStaffPerformanceInput - The input type for the analyzeStaffPerformance function.
 * - AnalyzeStaffPerformanceOutput - The return type for the analyzeStaffPerformance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ShiftAttendanceSchema = z.object({
    date: z.string().describe("Date of the shift (YYYY-MM-DD)."),
    scheduledShiftType: z.string().describe("e.g., Day, Night, Day Off"),
    scheduledStartTime: z.string().optional().describe("Scheduled start time (HH:mm)."),
    scheduledEndTime: z.string().optional().describe("Scheduled end time (HH:mm)."),
    actualStartTime: z.string().optional().describe("Actual clock-in time (HH:mm)."),
    actualEndTime: z.string().optional().describe("Actual clock-out time (HH:mm)."),
    attendanceStatus: z.string().optional().describe("e.g., Scheduled, Clocked In, Late, Clocked Out, Absent."),
    notes: z.string().optional().describe("Any notes associated with the shift or attendance."),
});

const AnalyzeStaffPerformanceInputSchema = z.object({
  staffId: z.string().describe("The unique identifier for the staff member."),
  staffName: z.string().describe("The name of the staff member."),
  staffRole: z.string().describe("The role of the staff member (e.g., Doctor, Nurse, Receptionist)."),
  dateRangeStart: z.string().describe("The start date of the analysis period (YYYY-MM-DD)."),
  dateRangeEnd: z.string().describe("The end date of the analysis period (YYYY-MM-DD)."),
  shifts: z.array(ShiftAttendanceSchema).describe("An array of the staff member's shifts and attendance records for the period."),
  // Consider adding: performanceExpectations (e.g., "Expected to handle 10 appointments per day")
  // Consider adding: peerReviewSummary (if available)
  // Consider adding: patientFeedbackSummary (if available)
});
export type AnalyzeStaffPerformanceInput = z.infer<typeof AnalyzeStaffPerformanceInputSchema>;

const AnalyzeStaffPerformanceOutputSchema = z.object({
  overallSummary: z.string().describe("A concise overall summary of the staff member's performance based on the provided data."),
  strengths: z.array(z.string()).optional().describe("Identified strengths or positive performance aspects."),
  areasForImprovement: z.array(z.string()).optional().describe("Identified areas needing improvement or potential concerns."),
  punctualityRating: z.enum(["Excellent", "Good", "Fair", "Poor", "N/A"]).optional().describe("A rating of their punctuality."),
  scheduleAdherenceNotes: z.string().optional().describe("Specific notes on schedule adherence, absences, or deviations."),
  positivePatterns: z.array(z.string()).optional().describe("Observed positive patterns in attendance or scheduling."),
  negativePatterns: z.array(z.string()).optional().describe("Observed negative patterns (e.g., frequent lateness on Mondays)."),
  // Consider adding: specificRecommendations: z.array(z.string()).optional()
});
export type AnalyzeStaffPerformanceOutput = z.infer<typeof AnalyzeStaffPerformanceOutputSchema>;

export async function analyzeStaffPerformance(input: AnalyzeStaffPerformanceInput): Promise<AnalyzeStaffPerformanceOutput> {
  return analyzeStaffPerformanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeStaffPerformancePrompt',
  input: {schema: AnalyzeStaffPerformanceInputSchema},
  output: {schema: AnalyzeStaffPerformanceOutputSchema},
  prompt: `You are an HR Performance Analyst AI for a healthcare facility.
Your task is to analyze the provided attendance and schedule data for a staff member and generate a performance summary.
Focus ONLY on punctuality, attendance, and adherence to the scheduled shifts. Do NOT infer or comment on clinical skills or patient care quality.

Staff Member: {{{staffName}}} (ID: {{{staffId}}})
Role: {{{staffRole}}}
Analysis Period: {{{dateRangeStart}}} to {{{dateRangeEnd}}}

Shift & Attendance Data:
{{#each shifts}}
- Date: {{this.date}}
  Scheduled: {{this.scheduledShiftType}} ({{this.scheduledStartTime_fmt}}{{#if this.scheduledEndTime_fmt}} - {{this.scheduledEndTime_fmt}}{{/if}})
  Actual: {{#if this.actualStartTime}}{{this.actualStartTime_fmt}}{{else}}N/A{{/if}}{{#if this.actualEndTime}} - {{this.actualEndTime_fmt}}{{else}}{{#if this.actualStartTime}} - N/A{{/if}}{{/if}}
  Status: {{this.attendanceStatus_fmt}}
  {{#if this.notes}}Notes: {{this.notes}}{{/if}}
{{else}}
No shift data provided for this period.
{{/each}}

Based on the data above:
1.  Provide an 'overallSummary' of their attendance and schedule adherence.
2.  Identify any 'strengths' (e.g., "Consistently punctual", "Perfect attendance").
3.  Identify 'areasForImprovement' (e.g., "Occasional lateness", "One unexplained absence").
4.  Give a 'punctualityRating' (Excellent, Good, Fair, Poor, N/A). Consider 'Late' statuses.
5.  Provide 'scheduleAdherenceNotes', summarizing patterns of absences, or significant deviations.
6.  List any 'positivePatterns' (e.g., "Always clocks in early for night shifts").
7.  List any 'negativePatterns' (e.g., "Tends to be late on Mondays", "Several short unexplained absences").

If no shift data is available, state that in the summary and mark ratings/patterns as N/A or empty.
Be objective and stick to the provided data.
`,
  // Custom Handlebars helpers to format optional fields nicely
  templateHelpers: [
    {
      name: 'scheduledStartTime_fmt',
      helper: (context: any) => context.data.root.scheduledStartTime || 'N/A',
    },
    {
      name: 'scheduledEndTime_fmt',
      helper: (context: any) => context.data.root.scheduledEndTime || 'N/A',
    },
     {
      name: 'actualStartTime_fmt',
      helper: (context: any) => context.data.root.actualStartTime || 'N/A',
    },
    {
      name: 'actualEndTime_fmt',
      helper: (context: any) => context.data.root.actualEndTime || 'N/A',
    },
    {
      name: 'attendanceStatus_fmt',
      helper: (context: any) => context.data.root.attendanceStatus || 'Scheduled',
    },
  ],
});

const analyzeStaffPerformanceFlow = ai.defineFlow(
  {
    name: 'analyzeStaffPerformanceFlow',
    inputSchema: AnalyzeStaffPerformanceInputSchema,
    outputSchema: AnalyzeStaffPerformanceOutputSchema,
  },
  async (input: AnalyzeStaffPerformanceInput) => {
    if (input.shifts.length === 0) {
        return {
            overallSummary: `No shift or attendance data available for ${input.staffName} during the period ${input.dateRangeStart} to ${input.dateRangeEnd}. Unable to perform attendance analysis.`,
            punctualityRating: "N/A",
            strengths: [],
            areasForImprovement: [],
            scheduleAdherenceNotes: "No data to analyze.",
            positivePatterns: [],
            negativePatterns: [],
        };
    }

    const {output} = await prompt(input);
    if (!output) {
        throw new Error("AI failed to generate a performance analysis.");
    }
    return output;
  }
);

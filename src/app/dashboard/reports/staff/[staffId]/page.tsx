"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, User, Loader2, CalendarRange, Activity, FileText, Pill, FlaskConical, BriefcaseMedical, Edit, Sparkles, Send } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { ROLES, type Role } from "@/lib/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format, parseISO, isWithinInterval } from "date-fns";
import { type Appointment, APPOINTMENTS_STORAGE_KEY } from "../../../appointments/page";
import { type LabOrder, LAB_ORDERS_STORAGE_KEY } from "../../../lab/page";
import { type Consultation, CONSULTATIONS_STORAGE_KEY } from "../../../consultations/page";
import { type Prescription, PHARMACY_PRESCRIPTIONS_STORAGE_KEY } from "../../../pharmacy/page";
import { type MockUser, USER_MANAGEMENT_STORAGE_KEY, getAllStaffUsers } from "../../../admin/user-management/page";
import { DatePickerWithRange } from "@/components/shared/date-range-picker";
import type { DateRange } from "react-day-picker";
import { triggerTxtDownload } from "@/lib/utils";
import { getActivityLog, type ActivityLogItem } from "@/lib/activityLog";
import { IconRenderer } from "../../../page"; 
import { analyzeStaffPerformance, type AnalyzeStaffPerformanceInput, type AnalyzeStaffPerformanceOutput } from "@/ai/flows/analyze-staff-performance-flow";
import { type Shift, STAFF_SCHEDULE_STORAGE_KEY, mockScheduleStore } from "../../../staff-schedule/schedule.lib";


interface StaffActivityData {
  appointments: number;
  consultations: number;
  labOrdersVerified: number;
  prescriptionsDispensed: number;
  activityLogEntries: ActivityLogItem[];
}

export default function StaffReportPage() {
  const router = useRouter();
  const params = useParams();
  const staffId = params.staffId as string;
  const { toast } = useToast();

  const [staffMember, setStaffMember] = useState<MockUser | null>(null);
  const [activityData, setActivityData] = useState<StaffActivityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });

  const [aiPerformanceAnalysis, setAiPerformanceAnalysis] = useState<AnalyzeStaffPerformanceOutput | null>(null);
  const [isAnalyzingPerformance, setIsAnalyzingPerformance] = useState(false);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);

  useEffect(() => {
    const storedShifts = localStorage.getItem(STAFF_SCHEDULE_STORAGE_KEY);
    if (storedShifts) {
      try {
        setAllShifts(JSON.parse(storedShifts));
      } catch (e) {
        console.error("Error parsing shifts for staff report", e);
        setAllShifts([]);
      }
    } else {
      setAllShifts([]); // Initialize if no data
    }
  }, []);


  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      if (staffId) {
        const users = getAllStaffUsers();
        const member = users.find(u => u.id === staffId);
        setStaffMember(member || null);

        if (member) {
          const appointments: Appointment[] = JSON.parse(localStorage.getItem(APPOINTMENTS_STORAGE_KEY) || '[]');
          const consultations: Consultation[] = JSON.parse(localStorage.getItem(CONSULTATIONS_STORAGE_KEY) || '[]');
          const labOrders: LabOrder[] = JSON.parse(localStorage.getItem(LAB_ORDERS_STORAGE_KEY) || '[]');
          const prescriptions: Prescription[] = JSON.parse(localStorage.getItem(PHARMACY_PRESCRIPTIONS_STORAGE_KEY) || '[]');
          
          let systemActivityLog: ActivityLogItem[] = [];
          try {
            systemActivityLog = await getActivityLog();
          } catch (error) {
            console.error("Failed to fetch activity log for staff report:", error);
          }
          
          const filterByDateRange = (itemDate: string) => {
            if (!dateRange || !dateRange.from || !dateRange.to) return true; // No range, include all
            const itemParsedDate = parseISO(itemDate);
            return isWithinInterval(itemParsedDate, {
              start: dateRange.from,
              end: dateRange.to,
            });
          };

          const data: StaffActivityData = {
            appointments: appointments.filter(app => app.providerName === member.name && filterByDateRange(app.date)).length,
            consultations: consultations.filter(con => con.doctorName === member.name && filterByDateRange(con.consultationDate)).length,
            labOrdersVerified: member.role === ROLES.LAB_TECH ? labOrders.filter(order => order.verifiedBy === member.name && order.verificationDate && filterByDateRange(order.verificationDate)).length : 0,
            prescriptionsDispensed: member.role === ROLES.PHARMACIST ? prescriptions.filter(rx => rx.status === "Dispensed" && filterByDateRange(rx.date)).length : 0, 
            activityLogEntries: systemActivityLog.filter(log => log.actorName === member.name && filterByDateRange(log.timestamp)).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10),
          };
          setActivityData(data);
        }
      }
      setIsLoading(false);
    };
    loadData();
  }, [staffId, dateRange]);

  const handleAnalyzePerformance = async () => {
    if (!staffMember || !dateRange?.from || !dateRange?.to) {
        toast({ title: "Missing Information", description: "Staff member or date range not selected.", variant: "destructive" });
        return;
    }
    setIsAnalyzingPerformance(true);
    setAiPerformanceAnalysis(null);

    const staffShiftsInRange = allShifts.filter(shift => 
        shift.staffId === staffMember.id &&
        isWithinInterval(parseISO(shift.date), { start: dateRange.from!, end: dateRange.to! })
    );

    if (staffShiftsInRange.length === 0 && (staffMember.role === ROLES.DOCTOR || staffMember.role === ROLES.NURSE || staffMember.role === ROLES.RECEPTIONIST)) {
        toast({ title: "No Shift Data", description: `No shift data found for ${staffMember.name} in the selected period to analyze attendance.`, variant: "default"});
        setAiPerformanceAnalysis({
            overallSummary: `No shift or attendance data available for ${staffMember.name} during the period ${format(dateRange.from, "PPP")} to ${format(dateRange.to, "PPP")}. Unable to perform attendance analysis.`,
            punctualityRating: "N/A",
        } as AnalyzeStaffPerformanceOutput);
        setIsAnalyzingPerformance(false);
        return;
    }

    const input: AnalyzeStaffPerformanceInput = {
        staffId: staffMember.id,
        staffName: staffMember.name,
        staffRole: staffMember.role,
        dateRangeStart: format(dateRange.from, "yyyy-MM-dd"),
        dateRangeEnd: format(dateRange.to, "yyyy-MM-dd"),
        shifts: staffShiftsInRange.map(s => ({
            date: s.date,
            scheduledShiftType: s.shiftType,
            scheduledStartTime: s.startTime,
            scheduledEndTime: s.endTime,
            actualStartTime: s.actualStartTime,
            actualEndTime: s.actualEndTime,
            attendanceStatus: s.attendanceStatus,
            notes: s.notes,
        })),
    };

    try {
      const response = await fetch('/api/ai/analyze-staff-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown API error" }));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }
      const result: AnalyzeStaffPerformanceOutput = await response.json();
      setAiPerformanceAnalysis(result);
      toast({ title: "Performance Analysis Complete", description: "AI analysis results are now available below."});
    } catch (error: any) {
        toast({ title: "AI Analysis Failed", description: error.message || "Could not perform AI performance analysis.", variant: "destructive"});
        setAiPerformanceAnalysis({
            overallSummary: `AI analysis failed: ${error.message}`,
            punctualityRating: "N/A",
        } as AnalyzeStaffPerformanceOutput);
    } finally {
        setIsAnalyzingPerformance(false);
    }
  };


  const handleDownloadReport = () => {
    if (!staffMember || !activityData) {
      toast({ title: "Error", description: "No data to download.", variant: "destructive" });
      return;
    }
    let reportContent = `Staff Activity Report for: ${staffMember.name} (${staffMember.role})\n`;
    reportContent += `Period: ${dateRange?.from ? format(dateRange.from, "PPP") : 'Start'} to ${dateRange?.to ? format(dateRange.to, "PPP") : 'End'}\n\n`;
    reportContent += `Summary:\n`;
    if (staffMember.role === ROLES.DOCTOR || staffMember.role === ROLES.NURSE) {
      reportContent += `- Appointments Handled: ${activityData.appointments}\n`;
      reportContent += `- Consultations Performed: ${activityData.consultations}\n`;
    }
    if (staffMember.role === ROLES.LAB_TECH) {
      reportContent += `- Lab Orders Verified: ${activityData.labOrdersVerified}\n`;
    }
    if (staffMember.role === ROLES.PHARMACIST) {
      reportContent += `- Prescriptions Dispensed (System Wide): ${activityData.prescriptionsDispensed}\n`;
    }
    reportContent += `\nRecent Activity Log Entries (${activityData.activityLogEntries.length}):\n`;
    if (activityData.activityLogEntries.length > 0) {
      activityData.activityLogEntries.forEach(log => {
        reportContent += `- ${format(parseISO(log.timestamp), "Pp")}: ${log.actionDescription}${log.details ? ` (${log.details})` : ''}\n`;
      });
    } else {
      reportContent += "No activity log entries found for this period.\n";
    }

    if (aiPerformanceAnalysis?.overallSummary) {
      reportContent += "\n\nAI Performance Analysis (Attendance & Schedule Adherence):\n";
      reportContent += `Overall Summary: ${aiPerformanceAnalysis.overallSummary}\n`;
      if (aiPerformanceAnalysis.punctualityRating) reportContent += `Punctuality: ${aiPerformanceAnalysis.punctualityRating}\n`;
      if (aiPerformanceAnalysis.strengths?.length) reportContent += `Strengths: ${aiPerformanceAnalysis.strengths.join(', ')}\n`;
      if (aiPerformanceAnalysis.areasForImprovement?.length) reportContent += `Areas for Improvement: ${aiPerformanceAnalysis.areasForImprovement.join(', ')}\n`;
      if (aiPerformanceAnalysis.scheduleAdherenceNotes) reportContent += `Adherence Notes: ${aiPerformanceAnalysis.scheduleAdherenceNotes}\n`;
      if (aiPerformanceAnalysis.positivePatterns?.length) reportContent += `Positive Patterns: ${aiPerformanceAnalysis.positivePatterns.join(', ')}\n`;
      if (aiPerformanceAnalysis.negativePatterns?.length) reportContent += `Negative Patterns: ${aiPerformanceAnalysis.negativePatterns.join(', ')}\n`;
    }

    triggerTxtDownload(reportContent, `staff_report_${staffMember.name.replace(/\s+/g, '_')}_${format(new Date(), "yyyyMMdd")}.txt`);
    toast({ title: "Report Downloaded", description: "Staff activity summary downloaded." });
  };


  if (isLoading && !activityData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-muted-foreground">Loading staff report data...</p>
      </div>
    );
  }

  if (!staffMember) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-destructive text-lg">Staff member not found.</p>
        <Button onClick={() => router.push("/dashboard/admin/user-management")} variant="outline" className="mt-4">
          Back to User Management
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="font-headline text-3xl flex items-center">
                <User className="mr-3 h-8 w-8 text-primary" /> Staff Activity Report: {staffMember.name}
              </CardTitle>
              <CardDescription>Role: {staffMember.role} (ID: {staffMember.id})</CardDescription>
            </div>
            <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading && !activityData ? (
             <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Fetching data for period...</p>
             </div>
          ) : !activityData ? (
              <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/30 rounded-md p-6 text-center">
                  <Activity className="h-20 w-20 text-muted-foreground/50 mb-4" />
                  <p className="text-lg text-muted-foreground">No activity data found for {staffMember.name} in the selected period.</p>
              </div>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="font-headline text-xl flex items-center"><Activity className="mr-2"/>Activity Summary</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {(staffMember.role === ROLES.DOCTOR || staffMember.role === ROLES.NURSE) && (
                      <>
                        <p><strong className="text-foreground">Appointments Handled:</strong> {activityData?.appointments ?? 0}</p>
                        <p><strong className="text-foreground">Consultations Performed:</strong> {activityData?.consultations ?? 0}</p>
                      </>
                    )}
                    {staffMember.role === ROLES.LAB_TECH && (
                      <p><strong className="text-foreground">Lab Orders Verified:</strong> {activityData?.labOrdersVerified ?? 0}</p>
                    )}
                    {staffMember.role === ROLES.PHARMACIST && (
                      <p><strong className="text-foreground">Prescriptions Dispensed (System Wide):</strong> {activityData?.prescriptionsDispensed ?? 0}</p>
                    )}
                    { (staffMember.role !== ROLES.DOCTOR && staffMember.role !== ROLES.NURSE && staffMember.role !== ROLES.LAB_TECH && staffMember.role !== ROLES.PHARMACIST) && (
                        <p className="text-muted-foreground md:col-span-2">No role-specific activity metrics tracked for {staffMember.role}.</p>
                    )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader><CardTitle className="font-headline text-xl flex items-center"><FileText className="mr-2"/>Recent Activity Log</CardTitle></CardHeader>
                <CardContent>
                  {activityData?.activityLogEntries && activityData.activityLogEntries.length > 0 ? (
                    <ul className="space-y-3 max-h-80 overflow-y-auto pr-2">
                      {activityData.activityLogEntries.map(log => (
                        <li key={log.id} className="p-3 border rounded-md bg-muted/20 flex items-start space-x-3">
                          <IconRenderer iconName={log.iconName} className="mt-1 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-foreground">{log.actionDescription}</p>
                            <p className="text-xs text-muted-foreground">{format(parseISO(log.timestamp), "PPP p")}</p>
                            {log.details && <p className="text-xs text-muted-foreground/80">{log.details}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No activity log entries found for this staff member in the selected period.</p>
                  )}
                </CardContent>
              </Card>

              <Accordion type="single" collapsible className="w-full shadow-md rounded-lg border bg-card">
                <AccordionItem value="ai-performance-analysis">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-center">
                            <Sparkles className="mr-3 h-6 w-6 text-primary" />
                            <span className="font-headline text-lg">AI Performance Analysis (Attendance & Schedule)</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-0">
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                This AI analysis focuses on punctuality and adherence to scheduled shifts based on clock-in/out data.
                                Date range for analysis: {dateRange?.from ? format(dateRange.from, "PPP") : 'Start'} to {dateRange?.to ? format(dateRange.to, "PPP") : 'End'}.
                            </p>
                            <Button onClick={handleAnalyzePerformance} disabled={isAnalyzingPerformance || !staffMember || !dateRange?.from || !dateRange?.to} className="w-full">
                                {isAnalyzingPerformance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Analyze Performance for Selected Period
                            </Button>
                            {isAnalyzingPerformance && (
                                <div className="flex items-center justify-center p-4 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Generating AI analysis...
                                </div>
                            )}
                            {aiPerformanceAnalysis && (
                                <Card className="mt-4 bg-muted/50">
                                    <CardHeader><CardTitle className="text-md">AI Analysis Results:</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <p><strong>Overall Summary:</strong> {aiPerformanceAnalysis.overallSummary}</p>
                                        {aiPerformanceAnalysis.punctualityRating && (
                                          <div className="flex items-center">
                                            <strong className="mr-2">Punctuality Rating:</strong>
                                            <Badge variant={aiPerformanceAnalysis.punctualityRating === "Poor" ? "destructive" : "secondary"}>
                                              {aiPerformanceAnalysis.punctualityRating}
                                            </Badge>
                                          </div>
                                        )}
                                        {aiPerformanceAnalysis.strengths?.length && <p><strong>Strengths:</strong> {aiPerformanceAnalysis.strengths.join(', ')}</p>}
                                        {aiPerformanceAnalysis.areasForImprovement?.length && <p><strong>Areas for Improvement:</strong> {aiPerformanceAnalysis.areasForImprovement.join(', ')}</p>}
                                        {aiPerformanceAnalysis.scheduleAdherenceNotes && <p><strong>Schedule Adherence Notes:</strong> {aiPerformanceAnalysis.scheduleAdherenceNotes}</p>}
                                        {aiPerformanceAnalysis.positivePatterns?.length && <p><strong>Positive Patterns:</strong> {aiPerformanceAnalysis.positivePatterns.join(', ')}</p>}
                                        {aiPerformanceAnalysis.negativePatterns?.length && <p><strong>Negative Patterns:</strong> {aiPerformanceAnalysis.negativePatterns.join(', ')}</p>}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )}
        </CardContent>
        <CardFooter>
            <Button variant="outline" onClick={handleDownloadReport} className="w-full" disabled={!activityData || isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Download Full Activity Summary
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

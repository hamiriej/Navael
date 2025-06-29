
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ListChecks, CalendarClock, User, Clock, Sun, Moon, Settings, MessageCircleWarning, Edit, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context"; 
import { ROLES } from "@/lib/constants"; 
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isToday as checkIsToday } from 'date-fns';
import { 
    type Shift, 
    getStaffRoleById,
    fetchShiftsByDate, // Using new API-driven function
    updateShiftAttendanceService // Using new API-driven function
} from "./schedule.lib"; 

const STAFF_COMPLAINTS_STORAGE_KEY = "navael_staff_schedule_complaints"; 

const shiftIcons: Record<Shift["shiftType"], JSX.Element> = {
  "Day": <Sun className="h-4 w-4 text-yellow-500" />,
  "Night": <Moon className="h-4 w-4 text-indigo-500" />,
  "Day Off": <User className="h-4 w-4 text-gray-500" />,
  "Custom": <Settings className="h-4 w-4 text-blue-500" />
};

const attendanceStatusVariant = (status?: Shift["attendanceStatus"]): "default" | "secondary" | "destructive" | "outline" => {
    switch(status) {
        case "Clocked In": return "default";
        case "Late": return "secondary"; 
        case "Clocked Out": return "outline";
        case "Absent": return "destructive";
        case "Scheduled": return "secondary";
        default: return "secondary";
    }
}

const formatShiftTimeDisplay = (time?: string): string => {
  if (!time || typeof time !== 'string') return ""; 
  if (time.length > 10) {
    const match = time.match(/\d{1,2}:\d{2}(\s*(AM|PM))?/i); 
    if (match && match[0]) return match[0];
    return time.substring(0, 8) + "..."; 
  }
  return time;
};

export default function StaffSchedulePage() {
  const [schedule, setSchedule] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [complaintText, setComplaintText] = useState("");
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({}); // For clock-in/out
  const { toast } = useToast();
  const { userRole, staffId: loggedInUserStaffId } = useAuth(); 

  const today = new Date();
  const todayISO = format(today, "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);

  const loadScheduleForDate = useCallback(async (dateToLoad: string) => {
    setIsLoading(true);
    setActionLoading({}); // Reset action loading states
    try {
      const fetchedSchedule = await fetchShiftsByDate(dateToLoad);
      setSchedule(fetchedSchedule);
    } catch (error: any) {
      console.error("Error fetching schedule:", error);
      toast({ title: "Error", description: error.message || "Could not load schedule.", variant: "destructive" });
      setSchedule([]);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadScheduleForDate(selectedDate);
  }, [selectedDate, loadScheduleForDate]);

  const uniqueDates = useMemo(() => {
    // In a real app, this might come from an API endpoint providing available schedule dates.
    // For now, generating a few days around today for demo.
    const dates = [];
    for (let i = -7; i <= 14; i++) {
      dates.push(format(new Date(today.setDate(today.getDate() + i)), "yyyy-MM-dd"));
      today.setDate(today.getDate() - i); // Reset date
    }
    return [...new Set(dates)].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [today]);

  const handleComplaintSubmit = () => {
    if (!complaintText.trim()) {
      toast({ title: "Error", description: "Complaint text cannot be empty.", variant: "destructive" });
      return; 
    }
    setIsSubmittingComplaint(true);
    try {
      let complaints = [];
      const storedComplaints = localStorage.getItem(STAFF_COMPLAINTS_STORAGE_KEY);
      if (storedComplaints) complaints = JSON.parse(storedComplaints);
      complaints.push({ 
        date: selectedDate, 
        complaint: complaintText, 
        userRole: userRole, 
        staffId: loggedInUserStaffId, 
        submittedAt: new Date().toISOString() 
      });
      localStorage.setItem(STAFF_COMPLAINTS_STORAGE_KEY, JSON.stringify(complaints));
      toast({ title: "Complaint Submitted", description: "Your schedule concern has been noted." });
      setComplaintText(""); 
    } catch (error) {
      console.error("Failed to submit complaint:", error);
      toast({ title: "Submission Error", description: "Could not submit your complaint.", variant: "destructive"});
    } finally {
      setIsSubmittingComplaint(false); 
    }
  };

  const handleClockAction = async (shift: Shift, action: "clockIn" | "clockOut") => {
    setActionLoading(prev => ({...prev, [shift.id]: true}));
    const now = new Date();
    let updates: Partial<Pick<Shift, 'actualStartTime' | 'actualEndTime' | 'attendanceStatus'>> = {};
    let toastMessage = "";

    if (action === "clockIn") {
      updates.actualStartTime = format(now, "HH:mm");
      updates.attendanceStatus = "Clocked In";
      toastMessage = "Clocked In";
      if (shift.startTime) {
        const scheduledDateTime = parseISO(`${selectedDate}T${shift.startTime}:00`);
        const gracePeriodMilliseconds = 5 * 60 * 1000;
        if (now.getTime() > scheduledDateTime.getTime() + gracePeriodMilliseconds) {
          updates.attendanceStatus = "Late";
          toastMessage = "Clocked In (Late)";
        }
      }
    } else if (action === "clockOut") {
      updates.actualEndTime = format(now, "HH:mm");
      updates.attendanceStatus = "Clocked Out";
      toastMessage = "Clocked Out";
    }

    try {
      await updateShiftAttendanceService(shift.id, updates);
      loadScheduleForDate(selectedDate); // Refresh schedule
      toast({ title: toastMessage, description: `Status updated for ${shift.staffName}.`});
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not update shift status.", variant: "destructive" });
    } finally {
      setActionLoading(prev => ({...prev, [shift.id]: false}));
    }
  };

  const displayScheduledTime = (shift: Shift): string => {
    if (shift.shiftType === 'Day Off') return 'Day Off';
    const start = formatShiftTimeDisplay(shift.startTime);
    const end = formatShiftTimeDisplay(shift.endTime);
    if (start && end) return `${start} - ${end}`;
    if (start) return `${start} - (No End Time)`;
    if (end) return `(No Start Time) - ${end}`;
    return "N/A";
  };

  const isSelectedDateToday = checkIsToday(parseISO(selectedDate));
  const canManageShifts = userRole === ROLES.ADMIN;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold flex items-center">
          <ListChecks className="mr-3 h-8 w-8 text-primary" /> Staff Schedule
        </h1>
        <p className="text-muted-foreground">View staff rotas, shifts, and availability.</p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="font-headline">Staff Rota & Availability</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder="Select date" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueDates.map(date => (
                    <SelectItem key={date} value={date}>{format(parseISO(date), "EEE, MMM d, yyyy")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canManageShifts && (
                <Button variant="outline" asChild>
                  <Link href="/dashboard/staff-schedule/manage">
                    <Edit className="mr-2 h-4 w-4" /> Manage Shifts
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <CardDescription className="mt-2">
            Displaying schedule for {format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}.
            {isLoading && <Loader2 className="inline-block ml-2 h-4 w-4 animate-spin" />}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && schedule.length === 0 ? (
             <div className="min-h-[300px] flex flex-col items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
             </div>
          ) : !isLoading && schedule.length === 0 ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center bg-muted/30 rounded-md">
              <CalendarClock className="h-24 w-24 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">No Schedule Found for Selected Date</p>
              <p className="text-sm text-muted-foreground">
                {canManageShifts ? "Use 'Manage Shifts' to add new entries." : "Please check with your administrator."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                  <TableHead>Staff Member</TableHead><TableHead>Role</TableHead><TableHead>Shift Type</TableHead>
                  <TableHead>Scheduled Time</TableHead><TableHead>Actual In</TableHead><TableHead>Actual Out</TableHead>
                  <TableHead>Attendance</TableHead><TableHead>Notes</TableHead>
                  {isSelectedDateToday && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {schedule.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium">{shift.staffName}</TableCell>
                    <TableCell>{getStaffRoleById(shift.staffId)}</TableCell>
                    <TableCell className="flex items-center gap-2">{shiftIcons[shift.shiftType]} {shift.shiftType}</TableCell>
                    <TableCell>{displayScheduledTime(shift)}</TableCell>
                    <TableCell>{shift.actualStartTime || "---"}</TableCell>
                    <TableCell>{shift.actualEndTime || "---"}</TableCell>
                    <TableCell><Badge variant={attendanceStatusVariant(shift.attendanceStatus)}>{shift.attendanceStatus || "Scheduled"}</Badge></TableCell>
                    <TableCell>{shift.notes || "---"}</TableCell>
                    {isSelectedDateToday && (
                        <TableCell className="text-right">
                            {shift.staffId === loggedInUserStaffId && shift.shiftType !== "Day Off" && (
                                <>
                                    {shift.attendanceStatus === "Scheduled" && (
                                        <Button size="sm" onClick={() => handleClockAction(shift, "clockIn")} disabled={actionLoading[shift.id]}>
                                          {actionLoading[shift.id] ? <Loader2 className="h-4 w-4 animate-spin"/> : "Clock In"}
                                        </Button>
                                    )}
                                    {(shift.attendanceStatus === "Clocked In" || shift.attendanceStatus === "Late") && !shift.actualEndTime && (
                                        <Button size="sm" variant="outline" onClick={() => handleClockAction(shift, "clockOut")} disabled={actionLoading[shift.id]}>
                                          {actionLoading[shift.id] ? <Loader2 className="h-4 w-4 animate-spin"/> : "Clock Out"}
                                        </Button>
                                    )}
                                </>
                            )}
                        </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {!canManageShifts && schedule.length > 0 && (
          <CardFooter className="border-t pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline"><MessageCircleWarning className="mr-2 h-4 w-4"/> Report Issue</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Report Issue with Schedule</AlertDialogTitle>
                  <AlertDialogDescription>Describe concerns for {format(parseISO(selectedDate), "PPP")}.</AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea placeholder="Type comments..." value={complaintText} onChange={(e) => setComplaintText(e.target.value)} rows={4}/>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => { setComplaintText(""); setIsSubmittingComplaint(false); }}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleComplaintSubmit} disabled={isSubmittingComplaint || !complaintText.trim()}>
                    {isSubmittingComplaint && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Submit Issue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

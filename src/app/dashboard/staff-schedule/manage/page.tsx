
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, ArrowLeft, CalendarPlus, Loader2, User, Clock, Sun, Moon, CalendarClock, Sparkles, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { generateRandomSchedule } from "@/ai/flows/generate-random-schedule-flow";
import type { GenerateScheduleInput, GenerateScheduleOutput } from "@/ai/schemas/schedule-schemas";
import { getAllStaffUsers, type MockUser } from "../../admin/user-management/page";
import { 
    type Shift, 
    createShift,
    deleteShiftService,
    fetchShiftsByDate
} from "../schedule.lib";
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
import { useAuth } from "@/contexts/auth-context";
import { ROLES } from "@/lib/constants";
import { logActivity } from "@/lib/activityLog";

const shiftTypes = ["Day", "Night", "Day Off", "Custom"] as const;

const shiftSchema = z.object({
  staffId: z.string().min(1, "Staff member is required"),
  date: z.date({ required_error: "Shift date is required" }),
  shiftType: z.enum(shiftTypes, { required_error: "Shift type is required" }),
  startTime: z.string().optional(), // HH:mm
  endTime: z.string().optional(),   // HH:mm
  notes: z.string().max(200, "Notes cannot exceed 200 characters.").optional(),
}).refine(data => {
  if ((data.shiftType === "Day" || data.shiftType === "Night" || data.shiftType === "Custom") && (!data.startTime || !data.endTime)) {
    return false;
  }
  return true;
}, {
  message: "Start and End time are required for Day, Night, and Custom shifts.",
  path: ["startTime"],
});

type ShiftFormValues = z.infer<typeof shiftSchema>;

const formatShiftTimeDisplay = (time?: string): string => {
  if (!time || typeof time !== 'string') return "";
  if (time.length > 10) {
    const match = time.match(/\d{1,2}:\d{2}(\s*(AM|PM))?/i);
    if (match && match[0]) return match[0];
    return time.substring(0, 8) + "...";
  }
  return time;
};

const displayScheduledTimeInManageView = (shift: Pick<Shift, 'shiftType' | 'startTime' | 'endTime'>): string => {
    if (shift.shiftType === 'Day Off') return '';
    const start = formatShiftTimeDisplay(shift.startTime);
    const end = formatShiftTimeDisplay(shift.endTime);

    if (start && end) return `(${start} - ${end})`;
    if (start) return `(${start} - ???)`;
    if (end) return `(??? - ${end})`;
    return "(Time N/A)";
};

export default function ManageShiftsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userRole, username: actorName } = useAuth();
  const [isSubmittingManualShift, setIsSubmittingManualShift] = useState(false);
  const [isGeneratingAISchedule, setIsGeneratingAISchedule] = useState(false);
  const [shiftsForSelectedDate, setShiftsForSelectedDate] = useState<Shift[]>([]);
  const [availableStaff, setAvailableStaff] = useState<MockUser[]>([]);
  const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null);
  const [isLoadingShiftsForDate, setIsLoadingShiftsForDate] = useState(false);

  useEffect(() => {
    setAvailableStaff(getAllStaffUsers().filter(user => user.status === 'Active'));
  }, []);

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      date: new Date(),
      shiftType: "Day", 
      startTime: "08:00",
      endTime: "20:00",
      notes: "",
    },
  });

  const selectedDateForFiltering = form.watch("date");
  const currentShiftType = form.watch("shiftType");

  const loadShiftsForDate = useCallback(async (date: Date) => {
    setIsLoadingShiftsForDate(true);
    const dateString = format(date, "yyyy-MM-dd");
    try {
      const fetchedShifts = await fetchShiftsByDate(dateString);
      setShiftsForSelectedDate(fetchedShifts);
    } catch (error: any) {
      console.error("Failed to fetch shifts:", error);
      toast({ title: "Error", description: error.message || "Could not load shifts for the selected date.", variant: "destructive" });
      setShiftsForSelectedDate([]);
    }
    setIsLoadingShiftsForDate(false);
  }, [toast]);

  useEffect(() => {
    if (selectedDateForFiltering) {
      loadShiftsForDate(selectedDateForFiltering);
    } else {
      setShiftsForSelectedDate([]);
    }
  }, [selectedDateForFiltering, loadShiftsForDate]);

   useEffect(() => {
    switch (currentShiftType) {
      case "Day":
        form.setValue("startTime", "08:00");
        form.setValue("endTime", "20:00");
        break;
      case "Night":
        form.setValue("startTime", "20:00");
        form.setValue("endTime", "08:00");
        break;
      case "Day Off":
        form.setValue("startTime", undefined);
        form.setValue("endTime", undefined);
        break;
      case "Custom": // Do not reset for custom, allow user input
        break;
      default:
        break;
    }
  }, [currentShiftType, form]);

  const onManualShiftSubmit = async (values: ShiftFormValues) => {
    setIsSubmittingManualShift(true);
    const staffMember = availableStaff.find(s => s.id === values.staffId);

    const shiftDataPayload = {
      staffId: values.staffId,
      date: format(values.date, "yyyy-MM-dd"),
      shiftType: values.shiftType,
      startTime: values.shiftType === "Day Off" ? undefined : values.startTime,
      endTime: values.shiftType === "Day Off" ? undefined : values.endTime,
      notes: values.notes,
    };

    try {
      const newShift = await createShift(shiftDataPayload); // API call
      logActivity({
          actorRole: userRole || ROLES.ADMIN,
          actorName: actorName || "Admin",
          actionDescription: `Manually Added ${newShift.shiftType} shift for ${newShift.staffName} on ${newShift.date}`,
          targetEntityType: "Staff Shift",
          targetEntityId: newShift.id,
          iconName: "CalendarPlus",
      });
      toast({ title: "Shift Added", description: `Shift for ${staffMember?.name} on ${format(values.date, "PPP")} has been added.` });
      if (selectedDateForFiltering) loadShiftsForDate(selectedDateForFiltering);
      form.reset({ ...form.getValues(), staffId: undefined, notes: "", shiftType: "Day", startTime: "08:00", endTime: "20:00" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not add the shift.", variant: "destructive" });
    }
    setIsSubmittingManualShift(false);
  };

  const handleGenerateAISchedule = async () => {
    setIsGeneratingAISchedule(true);
    const startDate = form.getValues("date") || new Date();
    const activeStaffForAI = availableStaff.map(s => ({ id: s.id, name: s.name, role: s.role }));

    if (activeStaffForAI.length === 0) {
        toast({ title: "AI Schedule Error", description: "No active staff members found.", variant: "destructive"});
        setIsGeneratingAISchedule(false);
        return;
    }

    const aiInput: GenerateScheduleInput = {
        staffList: activeStaffForAI,
        startDate: format(startDate, "yyyy-MM-dd"),
        numberOfDays: 7, // Default to 7 days for this AI generation
        defaultShiftTimes: { // Provide default times if not already in schema or make configurable
            Day: { startTime: "08:00", endTime: "20:00" },
            Night: { startTime: "20:00", endTime: "08:00" },
        },
    };

    try {
        const response = await fetch('/api/ai/generate-random-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aiInput),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown API error" }));
            throw new Error(errorData.error || `API request failed with status ${response.status}`);
        }
        const result: GenerateScheduleOutput = await response.json();
        
        let totalShiftsAdded = 0;
        if (result.schedulesByRole && result.schedulesByRole.length > 0) {
            for (const roleSchedule of result.schedulesByRole) {
                if (roleSchedule.shifts && roleSchedule.shifts.length > 0) {
                    for (const aiShift of roleSchedule.shifts) {
                        await createShift({ // Using the API-driven createShift
                            staffId: aiShift.staffId,
                            date: aiShift.date,
                            shiftType: aiShift.shiftType,
                            startTime: aiShift.startTime,
                            endTime: aiShift.endTime,
                            notes: aiShift.notes || `AI Generated`,
                        });
                        totalShiftsAdded++;
                    }
                }
            }
            toast({ title: "AI Schedule Generated", description: `Generated and added ${totalShiftsAdded} shifts. ${result.suggestions || ''}` });
            if (selectedDateForFiltering) loadShiftsForDate(selectedDateForFiltering); // Refresh view
        } else {
            toast({ title: "AI Schedule", description: "AI did not generate any shifts. Check input or try again.", variant: "default" });
        }
    } catch (error: any) {
        toast({ title: "AI Generation Failed", description: error.message || "Could not generate schedule with AI.", variant: "destructive" });
    } finally {
        setIsGeneratingAISchedule(false);
    }
  };

  const handleDeleteShift = async () => {
    if (shiftToDelete) {
      try {
        await deleteShiftService(shiftToDelete.id); // API call
        logActivity({ actorRole: userRole || ROLES.ADMIN, actorName: actorName || "Admin", actionDescription: `Deleted shift for ${shiftToDelete.staffName}`, targetEntityType: "Staff Shift", targetEntityId: shiftToDelete.id, iconName: "Trash2" });
        toast({ title: "Shift Deleted", description: `Shift for ${shiftToDelete.staffName} removed.`, variant: "destructive" });
        if (selectedDateForFiltering) loadShiftsForDate(selectedDateForFiltering);
      } catch (error: any) {
        toast({ title: "Error", description: error.message || "Could not delete shift.", variant: "destructive" });
      }
      setShiftToDelete(null);
    }
  };

  const isAdmin = userRole === ROLES.ADMIN;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center"><Settings className="mr-3 h-8 w-8 text-primary" /> Manage Staff Shifts</h1>
          <p className="text-muted-foreground">Create, edit, and assign shifts to staff members.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Schedule</Button>
      </div>

      {isAdmin && (
        <Button onClick={handleGenerateAISchedule} disabled={isGeneratingAISchedule || availableStaff.length === 0} variant="outline" className="w-full md:w-auto">
          {isGeneratingAISchedule ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generate Random Weekly Schedule with AI (from selected date)
        </Button>
      )}
      {availableStaff.length === 0 && <p className="text-sm text-destructive">No active staff found. Please add staff in User Management.</p>}

      <div className="grid md:grid-cols-2 gap-6">
        {isAdmin && (
        <Card className="shadow-lg">
          <CardHeader><CardTitle className="font-headline flex items-center"><CalendarPlus className="mr-2 h-5 w-5"/>Add New Shift Manually</CardTitle><CardDescription>Select staff, date, and shift details.</CardDescription></CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onManualShiftSubmit)} className="space-y-6">
                <FormField control={form.control} name="staffId" render={({ field }) => (
                    <FormItem><FormLabel>Staff Member</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger></FormControl><SelectContent>{availableStaff.map(s => (<SelectItem key={s.id} value={s.id}>{s.name} ({s.role})</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Shift Date</FormLabel><DatePicker selected={field.value} onSelect={(date) => {if (date) field.onChange(date);}} /><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="shiftType" render={({ field }) => (
                    <FormItem><FormLabel>Shift Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{shiftTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                {(currentShiftType !== "Day Off") && (<div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="startTime" render={({ field }) => (<FormItem><FormLabel>Start Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="endTime" render={({ field }) => (<FormItem><FormLabel>End Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>)}
                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Opt.)</FormLabel><FormControl><Textarea placeholder="Shift notes..." {...field} rows={3}/></FormControl><FormMessage /></FormItem>)} />
                <Button type="submit" disabled={isSubmittingManualShift || availableStaff.length === 0} className="w-full">{isSubmittingManualShift && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Shift</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        )}

        <Card className={`shadow-lg ${!isAdmin ? 'md:col-span-2' : ''}`}>
            <CardHeader><CardTitle className="font-headline">Shifts for {selectedDateForFiltering ? format(selectedDateForFiltering, "PPP") : "Selected Date"}</CardTitle><CardDescription>Overview of scheduled shifts.</CardDescription></CardHeader>
            <CardContent>
                {isLoadingShiftsForDate ? (<div className="flex justify-center items-center h-[200px]"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                ) : shiftsForSelectedDate.length > 0 ? (
                     <ul className="space-y-3 max-h-[400px] overflow-y-auto pr-2">{shiftsForSelectedDate.map((shift) => (
                        <li key={shift.id} className="p-3 border rounded-md bg-muted/50 flex justify-between items-center">
                            <div>
                                <div className="font-semibold">{shift.staffName} <span className="text-xs text-muted-foreground">({availableStaff.find(s => s.id === shift.staffId)?.role || 'N/A'})</span></div>
                                <div className="text-sm text-primary">{shift.shiftType} {displayScheduledTimeInManageView(shift)}</div>
                                {shift.notes && <p className="text-xs text-muted-foreground mt-1">Notes: {shift.notes}</p>}
                            </div>
                            {isAdmin && (
                              <AlertDialog open={shiftToDelete?.id === shift.id} onOpenChange={(isOpen) => !isOpen && setShiftToDelete(null)}>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" onClick={() => setShiftToDelete(shift)}><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Confirm Delete</AlertDialogTitle><AlertDialogDescription>Delete shift for {shiftToDelete?.staffName} on {shiftToDelete ? format(parseISO(shiftToDelete.date), "PPP") : ""}? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteShift} className={buttonVariants({variant: "destructive"})}>Delete</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                        </li>))}</ul>
                ) : (<div className="min-h-[200px] flex flex-col items-center justify-center"><CalendarClock className="h-16 w-16 text-muted-foreground/50 mb-3"/><p className="text-muted-foreground">No shifts found for this date.</p></div>)}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

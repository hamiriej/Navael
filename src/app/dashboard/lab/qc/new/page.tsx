
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { logActivity } from "@/lib/activityLog";
import { format } from "date-fns";
import { useState } from "react";

const QC_LOG_STORAGE_KEY = 'navael_lab_qc_logs';

export interface QCEntry {
  id: string;
  instrumentName: string;
  qcLotNumber: string;
  testName: string;
  qcLevel: string;
  valueObtained: string;
  expectedValueOrRange: string;
  status: "Pass" | "Fail" | "Action Required";
  runDate: string; // ISO string
  recordedBy: string;
  notes?: string;
}

const qcLevels = ["Level 1", "Level 2", "Level 3", "Normal", "Pathological Low", "Pathological High", "Other"] as const;
const qcStatuses = ["Pass", "Fail", "Action Required"] as const;

const qcEntrySchema = z.object({
  instrumentName: z.string().min(1, "Instrument name is required"),
  qcLotNumber: z.string().min(1, "QC Lot number is required"),
  testName: z.string().min(1, "Test/Analyte name is required"),
  qcLevel: z.enum(qcLevels, { required_error: "QC Level is required" }),
  valueObtained: z.string().min(1, "Value obtained is required"),
  expectedValueOrRange: z.string().min(1, "Expected value/range is required"),
  status: z.enum(qcStatuses, { required_error: "Status is required" }),
  runDate: z.date({ required_error: "Run date is required" }),
  notes: z.string().max(500, "Notes are too long").optional(),
});

type QCEntryFormValues = z.infer<typeof qcEntrySchema>;

// Service-like function to save QC entry
async function saveQCEntryService(entryData: QCEntry): Promise<QCEntry> {
  console.log("API_CALL_PLACEHOLDER: Saving QC Entry...", entryData);
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API delay

  try {
    const storedQCLogs = localStorage.getItem(QC_LOG_STORAGE_KEY);
    let qcLogs: QCEntry[] = storedQCLogs ? JSON.parse(storedQCLogs) : [];
    qcLogs.unshift(entryData); // Add to the beginning for recent first
    localStorage.setItem(QC_LOG_STORAGE_KEY, JSON.stringify(qcLogs));
    return entryData;
  } catch (error) {
    console.error("Failed to save QC entry to localStorage", error);
    throw new Error("Could not save QC log due to storage issue.");
  }
}


export default function LogQCResultsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { username: staffName, userRole } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<QCEntryFormValues>({
    resolver: zodResolver(qcEntrySchema),
    defaultValues: {
      runDate: new Date(),
      instrumentName: "",
      qcLotNumber: "",
      testName: "",
      qcLevel: undefined,
      valueObtained: "",
      expectedValueOrRange: "",
      status: undefined,
      notes: "",
    },
  });

  const onSubmit = async (values: QCEntryFormValues) => {
    if (!staffName) {
        toast({ title: "Error", description: "User not identified. Cannot log QC.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);

    const newQCEntryData: QCEntry = {
      id: `QC-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
      instrumentName: values.instrumentName,
      qcLotNumber: values.qcLotNumber,
      testName: values.testName,
      qcLevel: values.qcLevel,
      valueObtained: values.valueObtained,
      expectedValueOrRange: values.expectedValueOrRange,
      status: values.status,
      runDate: format(values.runDate, "yyyy-MM-dd"),
      recordedBy: staffName,
      notes: values.notes,
    };

    try {
        await saveQCEntryService(newQCEntryData);

        logActivity({
            actorRole: userRole || "Lab Staff",
            actorName: staffName,
            actionDescription: `Logged QC result for ${values.instrumentName} - ${values.testName} (${values.qcLevel}). Status: ${values.status}`,
            targetEntityType: "Lab QC Log",
            targetEntityId: newQCEntryData.id,
            iconName: "ClipboardCheck",
        });

        toast({ title: "QC Result Logged", description: `QC for ${values.testName} on ${values.instrumentName} saved successfully.` });
        form.reset({
            runDate: new Date(),
            instrumentName: "",
            qcLotNumber: "",
            testName: "",
            qcLevel: undefined,
            valueObtained: "",
            expectedValueOrRange: "",
            status: undefined,
            notes: "",
        });
        // Optionally, navigate back or to a QC log list page
        // router.push("/dashboard/lab/qc"); 
    } catch (e: any) {
        console.error("Error saving QC log:", e);
        toast({ title: "Save Error", description: e.message || "Could not save QC log.", variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <ClipboardCheck className="mr-3 h-8 w-8 text-primary" /> Log Quality Control Results
          </h1>
          <p className="text-muted-foreground">Enter and manage QC results for laboratory instruments.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      <Card className="shadow-lg max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="font-headline">New QC Result Entry</CardTitle>
          <CardDescription>
            Fill in the details for the quality control run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="instrumentName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Instrument Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Analyzer X, MicroScope Y" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="testName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Test / Analyte Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Glucose, Hemoglobin A1c" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="qcLotNumber" render={({ field }) => (
                    <FormItem>
                    <FormLabel>QC Lot Number</FormLabel>
                    <FormControl><Input placeholder="Enter Lot Number" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="qcLevel" render={({ field }) => (
                    <FormItem>
                    <FormLabel>QC Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select QC level" /></SelectTrigger></FormControl>
                        <SelectContent>
                        {qcLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="valueObtained" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Value Obtained</FormLabel>
                    <FormControl><Input placeholder="e.g., 5.0" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="expectedValueOrRange" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Expected Value/Range</FormLabel>
                    <FormControl><Input placeholder="e.g., 4.5 - 5.5" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                        <SelectContent>
                        {qcStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="runDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Run Date</FormLabel>
                    <DatePicker selected={field.value} onSelect={field.onChange} />
                    <FormMessage />
                    </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl><Textarea placeholder="Any relevant notes about this QC run, calibration, or corrective actions taken." {...field} rows={3} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="text-sm text-muted-foreground">
                Recorded by: {staffName || "Current User"} on {format(new Date(), "PPP p")}
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Log QC Result
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import { optimizeSchedule, type OptimizeScheduleInput } from "@/ai/flows/optimize-schedule";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lightbulb, Loader2, Sparkles, Info, Save, MonitorSmartphone, ArrowLeft } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation"; // Import useRouter

const scheduleOptimizerSchema = z.object({
  scheduleData: z.string().min(10, "Schedule data is required (must be valid JSON).").refine(
    (data) => {
      try {
        JSON.parse(data);
        return true;
      } catch (e) {
        return false;
      }
    },
    { message: "Schedule data must be a valid JSON string." }
  ),
  constraints: z.string().optional().refine(
    (data) => {
      if (!data || data.trim() === "") return true; // Optional field can be empty
      try {
        JSON.parse(data);
        return true;
      } catch (e) {
        return false;
      }
    },
    { message: "Constraints must be a valid JSON string if provided." }
  ),
});

type ScheduleOptimizerFormValues = z.infer<typeof scheduleOptimizerSchema>;

const exampleScheduleData = JSON.stringify(
  {
    appointments: [
      { id: "A001", patientId: "P001", providerId: "D001", startTime: "2024-07-20T09:00:00", durationMinutes: 30, type: "Check-up" },
      { id: "A002", patientId: "P002", providerId: "D002", startTime: "2024-07-20T09:30:00", durationMinutes: 45, type: "Consultation" },
      { id: "A003", patientId: "P003", providerId: "D001", startTime: "2024-07-20T10:00:00", durationMinutes: 30, type: "Follow-up" },
    ],
    staffAvailability: [
      { providerId: "D001", availableFrom: "2024-07-20T08:00:00", availableTo: "2024-07-20T17:00:00" },
      { providerId: "D002", availableFrom: "2024-07-20T09:00:00", availableTo: "2024-07-20T13:00:00" },
    ],
    resources: [
      { resourceId: "Room101", type: "Exam Room", available: true },
      { resourceId: "Room102", type: "Exam Room", available: false, unavailableUntil: "2024-07-20T12:00:00"},
    ]
  }, null, 2
);

const exampleConstraints = JSON.stringify(
  {
    providerPreferences: [
      { providerId: "D001", prefersNoAppointmentsBefore: "09:00", prefersNoAppointmentsAfter: "16:00" }
    ],
    lunchBreak: { start: "12:00", end: "13:00", forAllProviders: true },
    maxConsecutiveAppointments: 3
  }, null, 2
);

const LOCAL_STORAGE_SCHEDULE_KEY = "navael_scheduleOptimizer_scheduleData";
const LOCAL_STORAGE_CONSTRAINTS_KEY = "navael_scheduleOptimizer_constraints";

export default function ScheduleOptimizerPage() {
  const { toast } = useToast();
  const router = useRouter(); // Initialize useRouter
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedResult, setOptimizedResult] = useState<{ schedule: any; rationale: string } | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingFromStorageEvent = useRef(false); // Flag to prevent loops

  const form = useForm<ScheduleOptimizerFormValues>({
    resolver: zodResolver(scheduleOptimizerSchema),
    defaultValues: {
      scheduleData: exampleScheduleData,
      constraints: exampleConstraints,
    },
  });

  // Load data from localStorage on initial mount
  useEffect(() => {
    try {
      const storedSchedule = localStorage.getItem(LOCAL_STORAGE_SCHEDULE_KEY);
      const storedConstraints = localStorage.getItem(LOCAL_STORAGE_CONSTRAINTS_KEY);

      const initialValues: Partial<ScheduleOptimizerFormValues> = {};
      if (storedSchedule) initialValues.scheduleData = storedSchedule;
      if (storedConstraints) initialValues.constraints = storedConstraints;
      
      form.reset({
        scheduleData: storedSchedule || exampleScheduleData,
        constraints: storedConstraints || exampleConstraints,
      });
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      toast({
        title: "Load Error",
        description: "Could not load saved data from local storage.",
        variant: "destructive",
      });
    }
  }, [form, toast]);

  // Watch for local form changes and write to localStorage (debounced)
  const scheduleDataValue = form.watch("scheduleData");
  const constraintsValue = form.watch("constraints");

  useEffect(() => {
    if (isUpdatingFromStorageEvent.current) {
      return; // Don't write back if change came from storage event
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      form.trigger(["scheduleData", "constraints"]).then(isValid => {
        if (isValid) {
          try {
            if (scheduleDataValue !== undefined) {
                localStorage.setItem(LOCAL_STORAGE_SCHEDULE_KEY, scheduleDataValue);
            }
            if (constraintsValue !== undefined) {
                localStorage.setItem(LOCAL_STORAGE_CONSTRAINTS_KEY, constraintsValue);
            }
          } catch (error) {
            console.error("Error saving to localStorage:", error);
            toast({
              title: "Save Error",
              description: "Could not save changes to local storage. Storage might be full.",
              variant: "destructive",
            });
          }
        } else {
          console.log("Local data is invalid, not saving to localStorage.");
        }
      });
    }, 1000); // Debounce for 1 second

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [scheduleDataValue, constraintsValue, form, toast]);


  // Listen for storage events to sync across tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_SCHEDULE_KEY || event.key === LOCAL_STORAGE_CONSTRAINTS_KEY) {
        if (event.newValue === null) return; // Should not happen if we always set strings

        isUpdatingFromStorageEvent.current = true; // Set flag
        
        if (event.key === LOCAL_STORAGE_SCHEDULE_KEY && event.newValue !== form.getValues("scheduleData")) {
          form.setValue("scheduleData", event.newValue, { shouldValidate: true, shouldDirty: true });
        }
        if (event.key === LOCAL_STORAGE_CONSTRAINTS_KEY && event.newValue !== form.getValues("constraints")) {
          form.setValue("constraints", event.newValue, { shouldValidate: true, shouldDirty: true });
        }
        
        // Reset flag after form processes update
        requestAnimationFrame(() => {
            isUpdatingFromStorageEvent.current = false;
        });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [form]);


  const onSubmit = async (values: OptimizeScheduleInput) => {
    setIsOptimizing(true);
    setOptimizedResult(null);
    try {
      // Ensure values are valid JSON before sending to AI flow (already validated by schema)
      const result = await optimizeSchedule(values);
      let parsedSchedule;
      try {
        parsedSchedule = JSON.parse(result.optimizedSchedule);
      } catch (e) {
        console.error("Failed to parse optimized schedule JSON from AI:", e);
        toast({
          title: "Optimization Error",
          description: "The AI returned an invalid schedule format. Please check the rationale.",
          variant: "destructive",
        });
        parsedSchedule = { error: "Invalid JSON format from AI", raw: result.optimizedSchedule };
      }
      setOptimizedResult({ schedule: parsedSchedule, rationale: result.rationale });
      toast({
        title: "Schedule Optimized",
        description: "AI has provided optimization suggestions.",
      });
    } catch (error: any) {
      console.error("Error optimizing schedule:", error);
      let errorMessage = "An error occurred during optimization. Please try again.";
      if (error.message.includes("JSON")) { // Should be caught by zod resolver mostly
        errorMessage = "The provided data is not valid JSON. Please correct it and try again.";
      }
      toast({
        title: "Optimization Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
    setIsOptimizing(false);
  };

  return (
    <div className="space-y-8">
        <div className="flex items-center justify-between">
            <div className="flex items-start space-x-3 p-4 bg-accent/20 border border-accent/30 rounded-lg shadow flex-grow">
                <Lightbulb className="h-10 w-10 text-primary mt-1 flex-shrink-0" />
                <div>
                <h1 className="text-2xl font-headline font-bold text-primary flex items-center">
                    <MonitorSmartphone className="mr-2 h-6 w-6" /> AI Schedule Optimizer (Local Sync)
                </h1>
                <p className="text-muted-foreground mt-1">
                    This tool uses AI to analyze your current schedule and suggest improvements.
                    The input fields below are saved to your browser's local storage.
                    Changes are synced in **real-time across different tabs/windows of this browser**.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                    <strong>Note:</strong> Data is stored locally and not shared with other users or devices.
                    The examples are pre-filled.
                </p>
                </div>
            </div>
             <Button variant="outline" onClick={() => router.back()} className="ml-4 self-start">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
        </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Input Data (Stored Locally)</CardTitle>
            <CardDescription>Provide current schedule and constraints in JSON. Changes are saved to local storage and synced across your browser tabs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="scheduleData"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Schedule Data (JSON)</FormLabel>
                       <Accordion type="single" collapsible className="w-full" defaultValue="schedule-data-item">
                        <AccordionItem value="schedule-data-item">
                          <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline justify-start [&[data-state=open]>svg]:ml-auto">
                            <Info className="h-4 w-4 mr-2 text-primary/70" /> View/Edit Schedule Data
                          </AccordionTrigger>
                          <AccordionContent>
                            <FormControl>
                              <Textarea placeholder="Enter schedule JSON..." {...field} rows={15} className="font-code text-xs mt-2 border-primary/30 focus-visible:ring-primary/50" />
                            </FormControl>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                      <FormDescription className="mt-1">
                        Include appointments, staff availability, and resource allocation.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="constraints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Constraints (JSON, Optional)</FormLabel>
                      <Accordion type="single" collapsible className="w-full" defaultValue="constraints-data-item">
                        <AccordionItem value="constraints-data-item">
                          <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline justify-start [&[data-state=open]>svg]:ml-auto">
                             <Info className="h-4 w-4 mr-2 text-primary/70" /> View/Edit Constraints
                          </AccordionTrigger>
                          <AccordionContent>
                            <FormControl>
                              <Textarea placeholder="Enter constraints JSON..." {...field} rows={8} className="font-code text-xs mt-2 border-primary/30 focus-visible:ring-primary/50" />
                            </FormControl>
                           </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                      <FormDescription className="mt-1">
                        e.g., Staff preferences, room availability, equipment limitations.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isOptimizing || form.formState.isSubmitting} className="w-full">
                  {isOptimizing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Optimize Schedule (Using Current Data)
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Optimization Results</CardTitle>
            <CardDescription>The AI's suggested schedule and rationale will appear here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isOptimizing && (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p>AI is optimizing the schedule...</p>
              </div>
            )}
            {!isOptimizing && !optimizedResult && (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                 <Sparkles className="h-12 w-12 text-primary/50 mb-4" />
                <p>Results will be displayed here after optimization.</p>
              </div>
            )}
            {optimizedResult && (
              <>
                <div>
                  <h3 className="text-lg font-semibold font-headline mb-2">Optimized Schedule:</h3>
                  <Textarea
                    readOnly
                    value={typeof optimizedResult.schedule === 'string' ? optimizedResult.schedule : JSON.stringify(optimizedResult.schedule, null, 2)}
                    rows={15}
                    className="font-code text-xs bg-muted/50"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold font-headline mb-2">Rationale:</h3>
                  <Textarea
                    readOnly
                    value={optimizedResult.rationale}
                    rows={8}
                    className="bg-muted/50"
                  />
                </div>
              </>
            )}
          </CardContent>
          {optimizedResult && (
             <CardFooter>
                <p className="text-xs text-muted-foreground">Note: Review AI suggestions carefully before implementing changes.</p>
             </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}

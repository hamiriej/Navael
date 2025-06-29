
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Thermometer, HeartPulse, Waves, Gauge, Droplet, NotebookPen, ArrowLeft } from "lucide-react"; // Changed Lung to Waves
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import type { Admission } from "../../../../admissions/page";
import { useAuth } from "@/contexts/auth-context";
import { logActivity } from "@/lib/activityLog";

const ADMISSIONS_STORAGE_KEY = 'navael_admissions';
const VITAL_SIGNS_STORAGE_KEY = 'navael_vital_signs';

export interface VitalSignRecord {
  id: string;
  patientId: string;
  admissionId: string;
  timestamp: string;
  temperature: number;
  heartRate: number;
  respiratoryRate: number;
  systolicBP: number;
  diastolicBP: number;
  oxygenSaturation: number;
  recordedBy: string;
  notes?: string;
}

const vitalSignsSchema = z.object({
  temperature: z.coerce.number().min(30, "Too low").max(45, "Too high").optional().or(z.literal('')),
  heartRate: z.coerce.number().min(20, "Too low").max(250, "Too high").optional().or(z.literal('')),
  respiratoryRate: z.coerce.number().min(5, "Too low").max(60, "Too high").optional().or(z.literal('')),
  systolicBP: z.coerce.number().min(50, "Too low").max(300, "Too high").optional().or(z.literal('')),
  diastolicBP: z.coerce.number().min(30, "Too low").max(200, "Too high").optional().or(z.literal('')),
  oxygenSaturation: z.coerce.number().min(70, "Too low").max(100, "Too high").optional().or(z.literal('')),
  notes: z.string().max(500).optional(),
}).refine(data => {
    // At least one vital sign must be entered
    return data.temperature || data.heartRate || data.respiratoryRate || data.systolicBP || data.diastolicBP || data.oxygenSaturation;
}, {
    message: "At least one vital sign measurement is required.",
    path: ["temperature"], // Show error near first field
});

type VitalSignsFormValues = z.infer<typeof vitalSignsSchema>;

export default function RecordVitalSignsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const admissionId = params.admissionId as string;
  const { username: staffName, userRole } = useAuth();

  const [isLoadingAdmission, setIsLoadingAdmission] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [admission, setAdmission] = useState<Admission | null>(null);

  const form = useForm<VitalSignsFormValues>({
    resolver: zodResolver(vitalSignsSchema),
    defaultValues: {
        notes: "",
    }
  });

  useEffect(() => {
    if (admissionId) {
      try {
        const storedAdmissions = localStorage.getItem(ADMISSIONS_STORAGE_KEY);
        const admissions: Admission[] = storedAdmissions ? JSON.parse(storedAdmissions) : [];
        const foundAdmission = admissions.find(a => a.id === admissionId);
        
        if (foundAdmission) {
          setAdmission(foundAdmission);
        } else {
          toast({ title: "Error", description: "Admission record not found.", variant: "destructive" });
          router.replace("/dashboard/admissions");
        }
      } catch (e) {
        console.error("Error loading admission data for vital signs:", e);
        toast({ title: "Load Error", description: "Could not load admission data.", variant: "destructive"});
      }
    }
    setIsLoadingAdmission(false);
  }, [admissionId, router, toast]);

  const onSubmit = async (values: VitalSignsFormValues) => {
    if (!admission || !staffName) {
        toast({ title: "Error", description: "Admission details or staff information missing.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    const newVitalRecord: VitalSignRecord = {
      id: `VS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      patientId: admission.patientId,
      admissionId: admission.id,
      timestamp: new Date().toISOString(),
      temperature: values.temperature ? Number(values.temperature) : 0, // Default to 0 or handle as undefined if schema allows
      heartRate: values.heartRate ? Number(values.heartRate) : 0,
      respiratoryRate: values.respiratoryRate ? Number(values.respiratoryRate) : 0,
      systolicBP: values.systolicBP ? Number(values.systolicBP) : 0,
      diastolicBP: values.diastolicBP ? Number(values.diastolicBP) : 0,
      oxygenSaturation: values.oxygenSaturation ? Number(values.oxygenSaturation) : 0,
      recordedBy: staffName,
      notes: values.notes,
    };
    
    try {
      const storedVitals = localStorage.getItem(VITAL_SIGNS_STORAGE_KEY);
      let vitals: VitalSignRecord[] = storedVitals ? JSON.parse(storedVitals) : [];
      vitals.unshift(newVitalRecord); // Add to the beginning
      localStorage.setItem(VITAL_SIGNS_STORAGE_KEY, JSON.stringify(vitals));

      logActivity({
        actorRole: userRole || "System",
        actorName: staffName,
        actionDescription: `Recorded vital signs for patient ${admission.patientName} (Admission: ${admission.id})`,
        targetEntityType: "Vital Signs",
        targetEntityId: newVitalRecord.id,
        targetLink: `/dashboard/patients/${admission.patientId}?view=vitals`, // Link to patient's activity or vitals tab
        iconName: "HeartPulse",
      });

      toast({ title: "Vital Signs Recorded", description: `Vitals for ${admission.patientName} have been saved.` });
      form.reset({ notes: "" }); // Clear form but keep values for other fields if desired, or full reset
      router.push(`/dashboard/patients/${admission.patientId}?view=vitals`); // Go to patient profile, vitals tab
    } catch (e) {
      console.error("Error saving vital signs:", e);
      toast({ title: "Save Error", description: "Could not save vital signs.", variant: "destructive"});
    }
    setIsSubmitting(false);
  };

  if (isLoadingAdmission) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
  }

  if (!admission) {
    return <div className="text-center py-10">Admission record not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
        <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <Card className="shadow-lg">
            <CardHeader>
                <div className="flex items-center space-x-3">
                    <HeartPulse className="h-7 w-7 text-primary" />
                    <CardTitle className="font-headline text-2xl">Record Vital Signs</CardTitle>
                </div>
                <CardDescription>
                    For: <span className="font-semibold">{admission.patientName}</span> (Admission ID: {admission.id}) <br />
                    Admission Date: {format(new Date(admission.admissionDate + 'T00:00:00'), "PPP")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <FormField control={form.control} name="temperature" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center"><Thermometer className="mr-2 h-4 w-4 text-red-500"/>Temperature (°C)</FormLabel>
                                <FormControl><Input type="number" step="0.1" placeholder="e.g., 36.5" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="heartRate" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center"><HeartPulse className="mr-2 h-4 w-4 text-red-500"/>Heart Rate (bpm)</FormLabel>
                                <FormControl><Input type="number" placeholder="e.g., 70" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="respiratoryRate" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center"><Waves className="mr-2 h-4 w-4 text-blue-500"/>Respiratory Rate (breaths/min)</FormLabel> {/* Changed Icon Here */}
                                <FormControl><Input type="number" placeholder="e.g., 16" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="oxygenSaturation" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center"><Droplet className="mr-2 h-4 w-4 text-blue-500"/>Oxygen Saturation (SpO₂ %)</FormLabel>
                                <FormControl><Input type="number" placeholder="e.g., 98" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="systolicBP" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center"><Gauge className="mr-2 h-4 w-4 text-purple-500"/>Systolic BP (mmHg)</FormLabel>
                                <FormControl><Input type="number" placeholder="e.g., 120" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="diastolicBP" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center"><Gauge className="mr-2 h-4 w-4 text-purple-500"/>Diastolic BP (mmHg)</FormLabel>
                                <FormControl><Input type="number" placeholder="e.g., 80" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    
                    <FormField control={form.control} name="notes" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center"><NotebookPen className="mr-2 h-4 w-4 text-gray-500"/>Notes (Optional)</FormLabel>
                            <FormControl><Textarea placeholder="Any additional notes about the patient's condition or vital signs measurement..." {...field} rows={3} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    
                    <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isSubmitting} size="lg">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HeartPulse className="mr-2 h-4 w-4" />}
                        Record Vitals
                    </Button>
                    </div>
                </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}


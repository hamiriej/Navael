
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, FileText, ArrowLeft, Save, CheckCircle, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon as CalendarLucideIcon } from "lucide-react";
import type { Admission } from "../../../admissions/page"; 
import { type Ward, WARDS_BEDS_STORAGE_KEY, type Bed } from "../../bed-management/page";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/contexts/auth-context";
import { Alert, AlertTitle } from "@/components/ui/alert"; // Use Shadcn Alert

const ADMISSIONS_STORAGE_KEY = 'navael_admissions';
export const NAVAEL_DISCHARGE_SUMMARIES_STORAGE_KEY = 'navael_discharge_summaries';

export interface DischargeSummary {
  id: string; // Unique summary ID, can be same as admissionId for simplicity
  admissionId: string;
  patientId: string;
  patientName: string;
  admissionDate: string;
  dischargeDate: string;
  dischargeDiagnosis: string;
  hospitalCourse?: string;
  conditionAtDischarge?: string;
  dischargeMedicationsText?: string;
  followUpInstructions?: string;
  physicianResponsible?: string;
  status: "Draft" | "Finalized";
}

const dischargeSummarySchema = z.object({
  dischargeDate: z.date({ required_error: "Discharge date is required" }),
  dischargeDiagnosis: z.string().min(1, "Discharge diagnosis is required").max(500),
  hospitalCourse: z.string().max(2000).optional(),
  conditionAtDischarge: z.string().max(1000).optional(),
  dischargeMedicationsText: z.string().max(2000).optional(),
  followUpInstructions: z.string().max(2000).optional(),
  physicianResponsible: z.string().min(1, "Physician name is required"),
});

type DischargeSummaryFormValues = z.infer<typeof dischargeSummarySchema>;

export default function DischargePlanningPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const admissionId = params.admissionId as string;
  const { userRole, username: actorName } = useAuth();

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [existingSummary, setExistingSummary] = useState<DischargeSummary | null>(null);

  const form = useForm<DischargeSummaryFormValues>({
    resolver: zodResolver(dischargeSummarySchema),
    defaultValues: {
        dischargeDate: new Date(),
        dischargeDiagnosis: "",
        hospitalCourse: "",
        conditionAtDischarge: "",
        dischargeMedicationsText: "",
        followUpInstructions: "",
        physicianResponsible: "",
    }
  });

  useEffect(() => {
    setIsLoadingData(true);
    if (admissionId) {
      try {
        const storedAdmissions = localStorage.getItem(ADMISSIONS_STORAGE_KEY);
        const admissions: Admission[] = storedAdmissions ? JSON.parse(storedAdmissions) : [];
        const foundAdmission = admissions.find(a => a.id === admissionId);
        
        if (foundAdmission) {
          setAdmission(foundAdmission);
          form.setValue("physicianResponsible", foundAdmission.primaryDoctor || "");
          form.setValue("hospitalCourse", foundAdmission.reasonForAdmission || "");

          const storedSummaries = localStorage.getItem(NAVAEL_DISCHARGE_SUMMARIES_STORAGE_KEY);
          const summaries: DischargeSummary[] = storedSummaries ? JSON.parse(storedSummaries) : [];
          const foundSummary = summaries.find(s => s.admissionId === admissionId);
          
          if (foundSummary) {
            setExistingSummary(foundSummary);
            form.reset({
                dischargeDate: isValid(parseISO(foundSummary.dischargeDate)) ? parseISO(foundSummary.dischargeDate) : new Date(),
                dischargeDiagnosis: foundSummary.dischargeDiagnosis || "",
                hospitalCourse: foundSummary.hospitalCourse || foundAdmission.reasonForAdmission || "",
                conditionAtDischarge: foundSummary.conditionAtDischarge || "",
                dischargeMedicationsText: foundSummary.dischargeMedicationsText || "",
                followUpInstructions: foundSummary.followUpInstructions || "",
                physicianResponsible: foundSummary.physicianResponsible || foundAdmission.primaryDoctor || "",
            });
          }
        } else {
          toast({ title: "Error", description: "Admission record not found.", variant: "destructive" });
          router.replace("/dashboard/admissions");
        }
      } catch (e) {
        console.error("Error loading data for discharge planning:", e);
        toast({ title: "Load Error", description: "Could not load necessary data.", variant: "destructive"});
      }
    }
    setIsLoadingData(false);
  }, [admissionId, form, router, toast]);

  const handleSaveDraft = async (values: DischargeSummaryFormValues) => {
    if (!admission) return;
    setIsSubmittingDraft(true);

    const summaryData: DischargeSummary = {
      id: existingSummary?.id || `DSUM-${admission.id}`,
      admissionId: admission.id,
      patientId: admission.patientId,
      patientName: admission.patientName,
      admissionDate: admission.admissionDate,
      dischargeDate: format(values.dischargeDate, "yyyy-MM-dd"),
      dischargeDiagnosis: values.dischargeDiagnosis,
      hospitalCourse: values.hospitalCourse,
      conditionAtDischarge: values.conditionAtDischarge,
      dischargeMedicationsText: values.dischargeMedicationsText,
      followUpInstructions: values.followUpInstructions,
      physicianResponsible: values.physicianResponsible,
      status: "Draft",
    };
    
    try {
      const storedSummaries = localStorage.getItem(NAVAEL_DISCHARGE_SUMMARIES_STORAGE_KEY);
      let summaries: DischargeSummary[] = storedSummaries ? JSON.parse(storedSummaries) : [];
      const existingIndex = summaries.findIndex(s => s.id === summaryData.id);
      if (existingIndex > -1) {
        summaries[existingIndex] = summaryData;
      } else {
        summaries.unshift(summaryData);
      }
      localStorage.setItem(NAVAEL_DISCHARGE_SUMMARIES_STORAGE_KEY, JSON.stringify(summaries));
      setExistingSummary(summaryData); // Update local state for immediate reflection
      toast({ title: "Draft Saved", description: "Discharge summary draft has been saved." });
    } catch (e) {
      console.error("Error saving draft:", e);
      toast({ title: "Save Error", description: "Could not save draft.", variant: "destructive"});
    }
    setIsSubmittingDraft(false);
  };

  const handleFinalizeDischarge = async (values: DischargeSummaryFormValues) => {
    if (!admission) {
      toast({ title: "Error", description: "Admission details missing.", variant: "destructive" });
      return;
    }
    setIsFinalizing(true);

    // 1. Update/Create Discharge Summary and set status to Finalized
    const finalSummaryData: DischargeSummary = {
      id: existingSummary?.id || `DSUM-${admission.id}`,
      admissionId: admission.id,
      patientId: admission.patientId,
      patientName: admission.patientName,
      admissionDate: admission.admissionDate,
      dischargeDate: format(values.dischargeDate, "yyyy-MM-dd"),
      dischargeDiagnosis: values.dischargeDiagnosis,
      hospitalCourse: values.hospitalCourse,
      conditionAtDischarge: values.conditionAtDischarge,
      dischargeMedicationsText: values.dischargeMedicationsText,
      followUpInstructions: values.followUpInstructions,
      physicianResponsible: values.physicianResponsible,
      status: "Finalized",
    };

    try {
        // Save finalized summary
        let summaries: DischargeSummary[] = JSON.parse(localStorage.getItem(NAVAEL_DISCHARGE_SUMMARIES_STORAGE_KEY) || '[]');
        const existingSummaryIndex = summaries.findIndex(s => s.id === finalSummaryData.id);
        if (existingSummaryIndex > -1) summaries[existingSummaryIndex] = finalSummaryData;
        else summaries.unshift(finalSummaryData);
        localStorage.setItem(NAVAEL_DISCHARGE_SUMMARIES_STORAGE_KEY, JSON.stringify(summaries));
        setExistingSummary(finalSummaryData);

        // 2. Update Admission Record
        let admissions: Admission[] = JSON.parse(localStorage.getItem(ADMISSIONS_STORAGE_KEY) || '[]');
        admissions = admissions.map(adm => 
            adm.id === admissionId 
            ? { ...adm, status: "Discharged", dischargeDate: finalSummaryData.dischargeDate } 
            : adm
        );
        localStorage.setItem(ADMISSIONS_STORAGE_KEY, JSON.stringify(admissions));
        setAdmission(prev => prev ? { ...prev, status: "Discharged", dischargeDate: finalSummaryData.dischargeDate } : null);


        // 3. Update Bed Status
        let wards: Ward[] = JSON.parse(localStorage.getItem(WARDS_BEDS_STORAGE_KEY) || '[]');
        wards = wards.map(ward => {
            if (ward.name === admission.room) { // Assuming admission.room stores ward name
                return {
                    ...ward,
                    beds: ward.beds.map(bed => {
                        // Match by label OR if patientId was set on bed (safer)
                        if (bed.label === admission.bed || (bed.patientId && bed.patientId === admission.patientId)) {
                            return { ...bed, status: "Needs Cleaning", patientId: undefined, patientName: undefined };
                        }
                        return bed;
                    })
                };
            }
            return ward;
        });
        localStorage.setItem(WARDS_BEDS_STORAGE_KEY, JSON.stringify(wards));

        logActivity({
            actorRole: userRole || "System",
            actorName: actorName || "System",
            actionDescription: `Patient ${admission.patientName} discharged. Admission ID: ${admission.id}`,
            targetEntityType: "Discharge",
            targetEntityId: admission.patientId,
            targetLink: `/dashboard/patients/${admission.patientId}`,
            iconName: "CheckCircle",
            details: `Discharge Diagnosis: ${finalSummaryData.dischargeDiagnosis}`,
        });

        toast({ title: "Patient Discharged", description: `${admission.patientName} has been successfully discharged. Bed status updated.` });
        router.push("/dashboard/admissions");

    } catch (e) {
        console.error("Error finalizing discharge:", e);
        toast({ title: "Discharge Error", description: "Could not finalize discharge process.", variant: "destructive"});
    } finally {
        setIsFinalizing(false);
    }
  };

  if (isLoadingData) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
  }

  if (!admission) {
    return <div className="text-center py-10">Admission record not found.</div>;
  }
  
  const isFinalized = existingSummary?.status === "Finalized" || admission.status === "Discharged";


  return (
    <div className="space-y-6 max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => router.back()} disabled={isSubmittingDraft || isFinalizing}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admissions
        </Button>

        {isFinalized && (
            <Alert variant="default" className="border-green-500 bg-green-50 text-green-700">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <AlertTitle className="font-semibold">Patient Discharged</AlertTitle>
                <AlertDescription>
                    This patient has been discharged. The summary below is read-only. Admission Date: {format(parseISO(admission.admissionDate), "PPP")}, Discharge Date: {admission.dischargeDate ? format(parseISO(admission.dischargeDate), "PPP") : 'N/A'}.
                </AlertDescription>
            </Alert>
        )}

        <Card className="shadow-lg">
        <CardHeader>
            <div className="flex items-center space-x-3">
                <FileText className="h-7 w-7 text-primary" />
                <CardTitle className="font-headline text-2xl">
                    {isFinalized ? "View Discharge Summary" : "Draft Discharge Summary"} for {admission.patientName}
                </CardTitle>
            </div>
            <CardDescription>
                Admission ID: {admission.id} | Admission Date: {format(parseISO(admission.admissionDate), "PPP")} <br/>
                Admitting Doctor: {admission.primaryDoctor || "N/A"}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form className="space-y-8">
                <FormField control={form.control} name="dischargeDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Planned Discharge Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn("w-full md:w-1/2 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            disabled={isSubmittingDraft || isFinalizing || isFinalized}
                            >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarLucideIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < parseISO(admission.admissionDate) || isFinalized} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )} />
                
                <FormField control={form.control} name="dischargeDiagnosis" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Discharge Diagnosis</FormLabel>
                        <FormControl><Input placeholder="e.g., Resolved Community Acquired Pneumonia" {...field} disabled={isSubmittingDraft || isFinalizing || isFinalized} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name="hospitalCourse" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Brief Summary of Hospital Course / Reason for Admission</FormLabel>
                        <FormControl><Textarea placeholder="Patient admitted for..." {...field} rows={4} disabled={isSubmittingDraft || isFinalizing || isFinalized} /></FormControl>
                        <FormDescription>Pre-filled with admission reason if available.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />
                
                <FormField control={form.control} name="conditionAtDischarge" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Condition at Discharge</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Stable, afebrile, vitals normal..." {...field} rows={3} disabled={isSubmittingDraft || isFinalizing || isFinalized} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name="dischargeMedicationsText" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Discharge Medications</FormLabel>
                        <FormControl><Textarea placeholder="List medications, dosage, frequency, duration. e.g., Amoxicillin 500mg TDS for 7 days." {...field} rows={4} disabled={isSubmittingDraft || isFinalizing || isFinalized} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name="followUpInstructions" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Follow-up Instructions</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Follow up with Dr. Smith in 1 week. Continue home exercises. Diet as tolerated." {...field} rows={4} disabled={isSubmittingDraft || isFinalizing || isFinalized} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                
                <FormField control={form.control} name="physicianResponsible" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Physician Responsible for Discharge</FormLabel>
                        <FormControl><Input placeholder="e.g., Dr. Jane Doe" {...field} disabled={isSubmittingDraft || isFinalizing || isFinalized} /></FormControl>
                        <FormDescription>Pre-filled with admitting doctor if available.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />

                {!isFinalized && (
                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6">
                        <Button type="button" variant="outline" onClick={form.handleSubmit(handleSaveDraft)} disabled={isSubmittingDraft || isFinalizing}>
                            {isSubmittingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Draft Summary
                        </Button>
                         <Button type="button" onClick={form.handleSubmit(handleFinalizeDischarge)} disabled={isSubmittingDraft || isFinalizing}>
                            {isFinalizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Finalize and Discharge Patient
                        </Button>
                    </div>
                )}
            </form>
            </Form>
        </CardContent>
        </Card>
    </div>
  );
}


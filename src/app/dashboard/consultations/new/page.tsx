"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MessageSquarePlus, Search, UserCircle, CalendarIcon as CalendarLucideIcon, Sparkles, Copy, ArrowLeft, Pill, FlaskConical, CalendarPlus as CalendarPlusIcon, BookMarked, Code } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, setHours, setMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Separator } from "@/components/ui/separator";

import type { SummarizeConsultationNotesInput } from "@/ai/flows/summarize-consultation-notes-flow";
import type { SuggestMedicalCodesInput, SuggestMedicalCodesOutput } from "@/ai/flows/suggest-medical-codes-flow";

import { usePatients, type Patient, type AugmentedPatient } from "@/contexts/patient-context";
import { useConsultations } from "@/contexts/consultation-context";
import { useAppointments } from "@/contexts/appointment-context";
import type { Consultation } from "../page";
import type { Appointment } from "../../appointments/page";
import Link from "next/link";
import { logActivity } from "@/lib/activityLog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const consultationNoteSchema = z.object({
  patientSearch: z.string().optional(),
  selectedPatient: z.object({ id: z.string(), name: z.string() }).optional(),
  consultationDate: z.date({ required_error: "Consultation date is required" }),
  presentingComplaint: z.string().min(1, "Presenting complaint is required").max(1000),
  historyOfPresentingComplaint: z.string().max(2000).optional(),
  pastMedicalHistory: z.string().max(2000).optional(),
  medicationHistory: z.string().max(2000).optional(),
  allergies: z.string().max(1000).optional(),
  familyHistory: z.string().max(2000).optional(),
  socialHistory: z.string().max(2000).optional(),
  reviewOfSystems: z.string().max(2000).optional(),
  examinationFindings: z.string().max(3000).optional(),
  aiGeneratedSummary: z.string().max(2000).optional(),
  assessmentDiagnosis: z.string().min(1, "Assessment/Diagnosis is required").max(2000),
  plan: z.string().min(1, "Plan for treatment/follow-up is required").max(2000),
  doctorName: z.string().min(1, "Doctor's name is required"),
});

type ConsultationNoteFormValues = z.infer<typeof consultationNoteSchema>;

export default function NewConsultationNotePage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { username: loggedInDoctorName } = useAuth();
  const { patients, getPatientById } = usePatients();
  const { createConsultation, isLoadingConsultations } = useConsultations();
  const { fetchAppointmentById } = useAppointments();

  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [generatedAISummaryText, setGeneratedAISummaryText] = useState<string | null>(null);
  const [searchedPatients, setSearchedPatients] = useState<Patient[]>([]);
  const [lockedPatient, setLockedPatient] = useState<AugmentedPatient | null>(null);

  const [isSuggestingCodes, setIsSuggestingCodes] = useState(false);
  const [suggestedCodesResult, setSuggestedCodesResult] = useState<SuggestMedicalCodesOutput | null>(null);

  const [prefillAppointment, setPrefillAppointment] = useState<Appointment | null>(null);
  const [isLoadingPrefillData, setIsLoadingPrefillData] = useState(false);

  const patientIdFromQuery = searchParams.get("patientId");
  const appointmentIdFromQuery = searchParams.get("appointmentId");

  const form = useForm<ConsultationNoteFormValues>({
    resolver: zodResolver(consultationNoteSchema),
    defaultValues: {
      consultationDate: new Date(),
      presentingComplaint: "",
      historyOfPresentingComplaint: "",
      pastMedicalHistory: "",
      medicationHistory: "",
      allergies: "",
      familyHistory: "",
      socialHistory: "",
      reviewOfSystems: "",
      examinationFindings: "",
      aiGeneratedSummary: "",
      assessmentDiagnosis: "",
      plan: "",
      doctorName: loggedInDoctorName || "",
    },
  });

  useEffect(() => {
    let active = true;
    const loadPrefillData = async () => {
      setIsLoadingPrefillData(true);
      let targetPatientId: string | null = patientIdFromQuery;

      if (appointmentIdFromQuery) {
        try {
          const fetchedAppointment = await fetchAppointmentById(appointmentIdFromQuery);
          if (!active) return;
          if (fetchedAppointment) {
            setPrefillAppointment(fetchedAppointment);
            targetPatientId = fetchedAppointment.patientId;
            form.setValue("consultationDate", parseISO(fetchedAppointment.date));
            toast({ title: "Appointment Loaded", description: `Consultation linked to appointment ID: ${fetchedAppointment.id}.`, variant: "default" });
          } else {
            console.warn(`Appointment with ID ${appointmentIdFromQuery} not found.`);
            toast({ title: "Warning", description: "Appointment not found for the given ID. Continuing with general consultation.", variant: "default" });
          }
        } catch (error) {
          console.error("Error fetching appointment for prefill:", error);
          toast({ title: "Error", description: "Could not load appointment data for prefill.", variant: "destructive" });
        }
      }

      if (targetPatientId) {
        try {
          const foundPatient = await getPatientById(targetPatientId);
          if (!active) return;
          if (foundPatient) {
            setLockedPatient(foundPatient);
            const fullName = `${foundPatient.firstName} ${foundPatient.lastName}`;
            form.setValue("selectedPatient", { id: foundPatient.id, name: fullName });
            form.setValue("patientSearch", fullName);
            form.setValue("pastMedicalHistory", foundPatient.medicalHistoryNotes || "");
            form.setValue("allergies", foundPatient.allergies?.join(', ') || "");
            toast({ title: "Patient Loaded", description: `Patient ${fullName} loaded for consultation.`, variant: "default" });
          } else {
            console.warn(`Patient with ID ${targetPatientId} not found.`);
            toast({ title: "Warning", description: `Patient not found for ID: ${targetPatientId}. Continuing with general consultation.`, variant: "default" });
            setLockedPatient(null);
            form.setValue("selectedPatient", undefined);
            form.setValue("patientSearch", "");
          }
        } catch (error) {
          console.error("Error fetching patient for prefill:", error);
          toast({ title: "Error", description: "Could not load patient data for prefill.", variant: "destructive" });
        }
      }
      setIsLoadingPrefillData(false);
    };

    loadPrefillData();
    return () => { active = false; };
  }, [patientIdFromQuery, appointmentIdFromQuery, toast, getPatientById, form, fetchAppointmentById]);


  const handlePatientSearch = useCallback((searchTerm: string) => {
    if (searchTerm) {
      setSearchedPatients(
        patients.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } else {
      setSearchedPatients([]);
    }
  }, [patients]);

  const handleGenerateAISummary = useCallback(async () => {
    setIsGeneratingSummary(true);
    setGeneratedAISummaryText(null);
    form.setValue("aiGeneratedSummary", "");

    const values = form.getValues();
    const notesToSummarize = [
      `Presenting Complaint: ${values.presentingComplaint || 'N/A'}`,
      `History of Presenting Complaint: ${values.historyOfPresentingComplaint || 'N/A'}`,
      `Past Medical History (Current Relevance): ${values.pastMedicalHistory || 'N/A'}`,
      `Medication History (Current Relevance): ${values.medicationHistory || 'N/A'}`,
      `Allergies (Current Relevance): ${values.allergies || 'N/A'}`,
      `Family History (Current Relevance): ${values.familyHistory || 'N/A'}`,
      `Social History (Current Relevance): ${values.socialHistory || 'N/A'}`,
      `Review of Systems: ${values.reviewOfSystems || 'N/A'}`,
      `Examination Findings: ${values.examinationFindings || 'N/A'}`,
    ].join('\n\n');

    try {
      const input: SummarizeConsultationNotesInput = { notesToSummarize };
      const response = await fetch('/api/ai/summarize-consultation-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate AI summary.');
      }
      const result = await response.json();
      setGeneratedAISummaryText(result.summary);
      toast({ title: "AI Summary Generated", description: "Review the summary below." });
    } catch (error: any) {
      console.error("Error generating AI summary:", error);
      toast({ title: "AI Summary Error", description: error.message || "Could not generate summary at this time.", variant: "destructive" });
      setGeneratedAISummaryText("Failed to generate summary.");
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [form, toast]);

  const handleUseAISummary = useCallback(() => {
    if (generatedAISummaryText) {
      form.setValue("aiGeneratedSummary", generatedAISummaryText);
      toast({ title: "Summary Applied", description: "AI summary has been added to the note form." });
    }
  }, [form, generatedAISummaryText, toast]);

  const handleSuggestMedicalCodes = useCallback(async () => {
    setIsSuggestingCodes(true);
    setSuggestedCodesResult(null);

    const assessment = form.getValues("assessmentDiagnosis");
    const plan = form.getValues("plan");
    const complaint = form.getValues("presentingComplaint");

    if (!assessment.trim() && !plan.trim() && !complaint.trim()) {
        toast({ title: "Insufficient Text", description: "Please provide presenting complaint, assessment/diagnosis or plan to get coding suggestions.", variant: "destructive"});
        setIsSuggestingCodes(false);
        return;
    }

    const clinicalText = `Presenting Complaint: ${complaint}\n\nAssessment/Diagnosis: ${assessment}\n\nPlan: ${plan}`;
    try {
        const input: SuggestMedicalCodesInput = { clinicalText };
        const response = await fetch('/api/ai/suggest-medical-codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to suggest medical codes.');
        }
        const result: SuggestMedicalCodesOutput = await response.json();
        setSuggestedCodesResult(result);
        toast({ title: "Medical Codes Suggested", description: "AI has provided coding suggestions."});
    } catch (error: any) {
        console.error("Error suggesting medical codes:", error);
        toast({ title: "AI Coding Error", description: error.message || "Could not suggest codes at this time.", variant: "destructive"});
        setSuggestedCodesResult({ suggestedCodes: [], disclaimer: "Failed to load suggestions." });
    } finally {
        setIsSuggestingCodes(false);
    }
  }, [form, toast]);

  const processAndSaveConsultation = useCallback(async (values: ConsultationNoteFormValues): Promise<Consultation | null> => {
    const patientForNote = lockedPatient || values.selectedPatient;
    if (!patientForNote) {
      form.setError("patientSearch", { type: "manual", message: "Please select a patient." });
      toast({ title: "Patient Required", description: "Please select a patient.", variant: "destructive" });
      return null;
    }

    let patientFullName: string;
    if (lockedPatient) {
        patientFullName = `${lockedPatient.firstName} ${lockedPatient.lastName}`;
    } else if (values.selectedPatient) {
        patientFullName = values.selectedPatient.name;
    } else {
        patientFullName = "Unknown Patient";
    }

    const newConsultationData: Omit<Consultation, 'id' | 'time' | 'reason' | 'createdAt' | 'updatedAt'> = {
      patientId: patientForNote.id,
      patientName: patientFullName,
      consultationDate: values.consultationDate.toISOString(),
      doctorName: values.doctorName,
      presentingComplaint: values.presentingComplaint,
      historyOfPresentingComplaint: values.historyOfPresentingComplaint || '',
      pastMedicalHistory: values.pastMedicalHistory || '',
      medicationHistory: values.medicationHistory || '',
      allergies: values.allergies || '',
      familyHistory: values.familyHistory || '',
      socialHistory: values.socialHistory || '',
      reviewOfSystems: values.reviewOfSystems || '',
      examinationFindings: values.examinationFindings || '',
      aiGeneratedSummary: values.aiGeneratedSummary || '',
      assessmentDiagnosis: values.assessmentDiagnosis,
      plan: values.plan,
      status: "Open",
      linkedAppointmentId: prefillAppointment?.id || undefined,
    };

    try {
      const savedConsultation = await createConsultation(newConsultationData);
      toast({
        title: "Consultation Note Saved",
        description: `Note for ${patientFullName} has been successfully saved.`,
      });
      return savedConsultation;
    } catch (error) {
      console.error("Error saving consultation via context:", error);
      toast({ title: "Save Error", description: "Could not save consultation note.", variant: "destructive" });
      return null;
    }
  }, [createConsultation, lockedPatient, form, toast, prefillAppointment]);

  const onSubmit = useCallback(async (values: ConsultationNoteFormValues) => {
    setIsSubmittingForm(true);
    const savedConsultation = await processAndSaveConsultation(values);

    if (savedConsultation) {
      let patientToResetWith: AugmentedPatient | null = null;
      if (lockedPatient) {
        patientToResetWith = lockedPatient;
      } else if (values.selectedPatient) {
        const fetchedPatient = await getPatientById(values.selectedPatient.id);
        patientToResetWith = fetchedPatient || null;
      }

      const patientFullNameForReset = patientToResetWith ? `${patientToResetWith.firstName} ${patientToResetWith.lastName}` : "";
      const patientSelectedObjectForReset = patientToResetWith ? { id: patientToResetWith.id, name: patientFullNameForReset } : undefined;

      form.reset({
        consultationDate: new Date(),
        doctorName: loggedInDoctorName || "",
        patientSearch: patientFullNameForReset,
        selectedPatient: patientSelectedObjectForReset,
        presentingComplaint: "",
        historyOfPresentingComplaint: "",
        pastMedicalHistory: patientToResetWith?.medicalHistoryNotes || "",
        medicationHistory: "",
        allergies: patientToResetWith?.allergies?.join(', ') || "",
        familyHistory: "",
        socialHistory: "",
        reviewOfSystems: "",
        examinationFindings: "",
        aiGeneratedSummary: "",
        assessmentDiagnosis: "",
        plan: "",
      });
      setGeneratedAISummaryText(null);
      setSuggestedCodesResult(null);
      if (!lockedPatient) {
        form.setValue("selectedPatient", undefined);
        form.setValue("patientSearch", "");
      }
      router.push("/dashboard/consultations");
    }
    setIsSubmittingForm(false);
  }, [form, loggedInDoctorName, lockedPatient, processAndSaveConsultation, router, getPatientById]);

  const handleQuickAction = useCallback(async (targetHref: string) => {
    const finalPatientId = lockedPatient?.id || form.getValues("selectedPatient")?.id;

    if (!finalPatientId) {
      toast({ title: "Patient Not Selected", description: "Please select or confirm a patient before performing this action.", variant: "destructive" });
      if (!lockedPatient) form.setFocus("patientSearch");
      return;
    }

    setIsSubmittingForm(true);
    const isValid = await form.trigger();
    if (!isValid) {
      toast({ title: "Validation Error", description: "Please correct the errors in the form before proceeding.", variant: "destructive" });
      const fieldErrors = form.formState.errors;
      const firstErrorField = Object.keys(fieldErrors)[0] as keyof ConsultationNoteFormValues;
      if (firstErrorField) form.setFocus(firstErrorField);
      setIsSubmittingForm(false);
      return;
    }

    const currentValues = form.getValues();
    const savedConsultation = await processAndSaveConsultation(currentValues);

    if (savedConsultation) {
      let patientToKeepOnForm: AugmentedPatient | null = null;
      if (lockedPatient) {
        patientToKeepOnForm = lockedPatient;
      } else if (currentValues.selectedPatient) {
        const fetchedPatient = await getPatientById(currentValues.selectedPatient.id);
        patientToKeepOnForm = fetchedPatient || null;
      }

      const patientFullNameForReset = patientToKeepOnForm ? `${patientToKeepOnForm.firstName} ${patientToKeepOnForm.lastName}` : "";
      const patientSelectedObjectForReset = patientToKeepOnForm ? { id: patientToKeepOnForm.id, name: patientFullNameForReset } : undefined;

      form.reset({
          consultationDate: new Date(),
          doctorName: loggedInDoctorName || "",
          patientSearch: patientFullNameForReset,
          selectedPatient: patientSelectedObjectForReset,
          presentingComplaint: "",
          historyOfPresentingComplaint: "",
          pastMedicalHistory: patientToKeepOnForm?.medicalHistoryNotes || "",
          medicationHistory: "",
          allergies: patientToKeepOnForm?.allergies?.join(', ') || "",
          familyHistory: "",
          socialHistory: "",
          reviewOfSystems: "",
          examinationFindings: "",
          aiGeneratedSummary: "",
          assessmentDiagnosis: "",
          plan: "",
      });
      setGeneratedAISummaryText(null);
      setSuggestedCodesResult(null);

      const consultationIdForQuery = savedConsultation.id;
      const appointmentIdForQuery = savedConsultation.linkedAppointmentId;
      router.push(`${targetHref}?patientId=${finalPatientId}&linkedConsultationId=${consultationIdForQuery}&linkedAppointmentId=${appointmentIdForQuery}`);
    }
     if (!savedConsultation) setIsSubmittingForm(false);
  }, [form, lockedPatient, processAndSaveConsultation, toast, loggedInDoctorName, getPatientById, router]);


  const currentSelectedPatientName = useMemo(() => {
    if (lockedPatient) return `${lockedPatient.firstName} ${lockedPatient.lastName}`;
    return form.watch("selectedPatient")?.name;
  }, [lockedPatient, form.watch("selectedPatient")]);

  if (isLoadingPrefillData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading patient and appointment data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <Button variant="outline" onClick={() => router.back()} className="mb-4" disabled={isSubmittingForm || isLoadingConsultations}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Consultations
        </Button>
        <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader>
            <div className="flex items-center space-x-3">
            <MessageSquarePlus className="h-7 w-7 text-primary" />
            <CardTitle className="font-headline text-2xl">
                {prefillAppointment ? `Consultation for ${prefillAppointment.patientName}` : (lockedPatient ? `New Consultation for ${lockedPatient.firstName} ${lockedPatient.lastName}` : "New Consultation Note")}
            </CardTitle>
            </div>
            <CardDescription>
            {prefillAppointment ? (
                `Linked to appointment ID: ${prefillAppointment.id} for ${prefillAppointment.patientName} on ${format(parseISO(prefillAppointment.date), "PPP")}.`
            ) : lockedPatient ? (
                `Recording consultation for patient ID: ${lockedPatient.id}.`
            ) : (
                "Select a patient and fill in the details for the consultation."
            )}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                {/* Patient Search/Display */}
                {!lockedPatient && (
                <FormField
                    control={form.control}
                    name="patientSearch"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><UserCircle className="mr-2 h-4 w-4"/>Search Patient</FormLabel>
                        <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input
                            placeholder="Type to search patient..."
                            {...field}
                            onChange={(e) => {
                                field.onChange(e); // Update form state
                                handlePatientSearch(e.target.value); // Trigger search logic
                                form.setValue("selectedPatient", undefined); // Clear selection if user types
                            }}
                            className="pl-10"
                            disabled={isSubmittingForm || isLoadingConsultations}
                            />
                        </FormControl>
                        </div>
                        {searchedPatients.length > 0 && (
                        <ul className="mt-2 border rounded-md max-h-40 overflow-y-auto bg-card z-10 absolute w-full shadow-lg">
                            {searchedPatients.map(p => (
                            <li key={p.id}
                                className="p-3 hover:bg-accent cursor-pointer text-sm"
                                onClick={() => {
                                    const fullName = `${p.firstName} ${p.lastName}`;
                                    form.setValue("selectedPatient", {id: p.id, name: fullName});
                                    form.setValue("patientSearch", fullName);
                                    setSearchedPatients([]);
                                    form.clearErrors("patientSearch");
                                    form.setValue("pastMedicalHistory", p.medicalHistoryNotes || "");
                                    form.setValue("allergies", p.allergies?.join(', ') || "");
                                }}>
                                {p.firstName} {p.lastName} (ID: {p.id})
                            </li>
                            ))}
                        </ul>
                        )}
                        {currentSelectedPatientName && (
                        <p className="text-sm text-green-600 mt-1">Selected: {currentSelectedPatientName}</p>
                        )}
                        <FormMessage />
                    </FormItem>
                    )}
                />
                )}
                {lockedPatient && (
                    <div className="p-3 border rounded-md bg-muted/50">
                        <p className="text-sm font-medium text-foreground">Patient: {lockedPatient.firstName} {lockedPatient.lastName}</p>
                        <p className="text-xs text-muted-foreground">ID: {lockedPatient.id} {lockedPatient.age ? `• Age: ${lockedPatient.age}` : ''} {lockedPatient.gender ? `• Gender: ${lockedPatient.gender}` : ''}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="consultationDate" render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Consultation Date & Time</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                disabled={isSubmittingForm || isLoadingConsultations}
                                >
                                {field.value ? format(field.value, "PPP HH:mm") : <span>Pick a date and time</span>}
                                <CalendarLucideIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus />
                            <div className="p-3 border-t border-border">
                                <div className="flex items-center justify-evenly">
                                    <label htmlFor="hours" className="text-sm">Time:</label>
                                    <Input
                                        id="hours"
                                        type="time"
                                        defaultValue={field.value ? format(field.value, "HH:mm") : ""}
                                        onChange={(e) => {
                                            const [hours, minutes] = e.target.value.split(':').map(Number);
                                            const currentDateTime = field.value || new Date();
                                            const newDate = setMinutes(setHours(currentDateTime, hours), minutes);
                                            field.onChange(newDate);
                                        }}
                                        className="w-auto"
                                        disabled={isSubmittingForm || isLoadingConsultations}
                                    />
                                </div>
                            </div>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="doctorName" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Doctor</FormLabel>
                            <FormControl><Input placeholder="Enter doctor's name" {...field} disabled={!!loggedInDoctorName || isSubmittingForm || isLoadingConsultations} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>

                <Separator />
                <h3 className="text-lg font-semibold font-headline text-primary">Clinical Notes</h3>

                <FormField control={form.control} name="presentingComplaint" render={({ field }) => (
                <FormItem>
                    <FormLabel>Presenting Complaint</FormLabel>
                    <FormControl><Textarea placeholder="e.g., Sore throat, fever for 3 days..." {...field} rows={3} disabled={isSubmittingForm || isLoadingConsultations}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <FormField control={form.control} name="historyOfPresentingComplaint" render={({ field }) => (
                <FormItem>
                    <FormLabel>History of Presenting Complaint (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Detailed history of the current issue..." {...field} rows={4} disabled={isSubmittingForm || isLoadingConsultations}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="pastMedicalHistory" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Past Medical History (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Hypertension, Diabetes Type 2, Asthma..." {...field} rows={3} disabled={isSubmittingForm || isLoadingConsultations}/></FormControl>
                        <FormDescription>Significant past illnesses, surgeries, hospitalizations.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )} />
                    <FormField control={form.control} name="medicationHistory" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Current Medications (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Lisinopril 10mg OD, Metformin 500mg BD..." {...field} rows={3} disabled={isSubmittingForm || isLoadingConsultations}/></FormControl>
                        <FormDescription>Include dosage and frequency.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="allergies" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Allergies (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Penicillin (rash), Peanuts (anaphylaxis)..." {...field} rows={3} disabled={isSubmittingForm || isLoadingConsultations}/></FormControl>
                        <FormDescription>Include reaction if known.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )} />
                    <FormField control={form.control} name="familyHistory" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Family History (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Father - MI at 50, Mother - Breast Cancer..." {...field} rows={3} disabled={isSubmittingForm || isLoadingConsultations}/></FormControl>
                        <FormDescription>Relevant family medical conditions.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )} />
                </div>

                <FormField control={form.control} name="socialHistory" render={({ field }) => (
                <FormItem>
                    <FormLabel>Social History (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="e.g., Smoking, alcohol, occupation, living situation..." {...field} rows={3} disabled={isSubmittingForm || isLoadingConsultations}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <FormField control={form.control} name="reviewOfSystems" render={({ field }) => (
                <FormItem>
                    <FormLabel>Review of Systems (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Systematic review, e.g., CVS: No chest pain, GIT: NAD..." {...field} rows={4} disabled={isSubmittingForm || isLoadingConsultations}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <FormField control={form.control} name="examinationFindings" render={({ field }) => (
                <FormItem>
                    <FormLabel>Examination Findings (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Physical examination findings, vital signs..." {...field} rows={5} disabled={isSubmittingForm || isLoadingConsultations}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <Separator />
                <div className="space-y-4 p-4 border rounded-md shadow-sm bg-muted/30">
                    <h3 className="text-lg font-semibold font-headline text-primary flex items-center"><Sparkles className="mr-2 h-5 w-5"/>AI-Powered Note Summary</h3>
                    <Button type="button" variant="outline" onClick={handleGenerateAISummary} disabled={isGeneratingSummary || isSubmittingForm || isLoadingConsultations}>
                        {isGeneratingSummary ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Generate Summary from Above Notes
                    </Button>
                    {isGeneratingSummary && <p className="text-sm text-muted-foreground">AI is generating summary...</p>}
                    {generatedAISummaryText && (
                        <Card className="mt-2">
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="text-md">Generated AI Summary (Review & Edit Below)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-foreground whitespace-pre-line p-3 bg-background rounded-md border">{generatedAISummaryText}</p>
                                <Button type="button" size="sm" variant="secondary" onClick={handleUseAISummary} className="mt-3" disabled={isSubmittingForm || isLoadingConsultations}>
                                    <Copy className="mr-2 h-4 w-4"/> Use this Summary (Copies to field below)
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                    <FormField control={form.control} name="aiGeneratedSummary" render={({ field }) => (
                    <FormItem>
                        <FormLabel>AI Generated Summary (Editable)</FormLabel>
                        <FormControl><Textarea placeholder="AI summary will appear here after generation, or type your own." {...field} rows={4} disabled={isSubmittingForm || isLoadingConsultations}/></FormControl>
                        <FormDescription>This summary will be saved with the consultation note. You can edit it after generation.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )} />
                </div>


                <Separator />
                <h3 className="text-lg font-semibold font-headline text-primary">Assessment & Plan</h3>

                <FormField control={form.control} name="assessmentDiagnosis" render={({ field }) => (
                <FormItem>
                    <FormLabel>Assessment / Diagnosis</FormLabel>
                    <FormControl><Textarea placeholder="Clinical assessment or diagnosis..." {...field} rows={3} disabled={isSubmittingForm || isLoadingConsultations}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <FormField control={form.control} name="plan" render={({ field }) => (
                <FormItem>
                    <FormLabel>Plan</FormLabel> {/* Corrected LabeL to FormLabel */}
                    <FormControl><Textarea placeholder="Treatment plan, investigations, referrals, follow-up..." {...field} rows={4} disabled={isSubmittingForm || isLoadingConsultations}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                 {/* AI Medical Coding Assistant Section */}
                <Separator />
                <div className="space-y-4 p-4 border rounded-md shadow-sm bg-muted/30">
                    <h3 className="text-lg font-semibold font-headline text-primary flex items-center"><Code className="mr-2 h-5 w-5"/>AI Medical Coding Assistant</h3>
                    <Button type="button" variant="outline" onClick={handleSuggestMedicalCodes} disabled={isSuggestingCodes || isSubmittingForm || isLoadingConsultations}>
                        {isSuggestingCodes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookMarked className="mr-2 h-4 w-4" />}
                        Suggest Medical Codes (from Assessment & Plan)
                    </Button>
                    {isSuggestingCodes && <p className="text-sm text-muted-foreground">AI is suggesting codes...</p>}
                    {suggestedCodesResult && (
                        <Card className="mt-2">
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="text-md">AI Coding Suggestions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {suggestedCodesResult.suggestedCodes.length > 0 ? (
                                    <div className="space-y-3">
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Code</TableHead><TableHead>Description</TableHead><TableHead>Reasoning</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {suggestedCodesResult.suggestedCodes.map((codeSugg, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell><Badge variant="secondary">{codeSugg.codeType}</Badge></TableCell>
                                                        <TableCell className="font-mono">{codeSugg.code}</TableCell>
                                                        <TableCell>{codeSugg.description}</TableCell>
                                                        <TableCell className="text-xs">{codeSugg.reasoning || "N/A"}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        {suggestedCodesResult.confidenceNotes && <p className="text-xs text-muted-foreground mt-2 italic">AI Confidence: {suggestedCodesResult.confidenceNotes}</p>}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No specific codes were suggested for the provided text.</p>
                                )}
                                 <Alert variant="default" className="mt-4 border-amber-500 text-amber-700 bg-amber-50/50">
                                    <Sparkles className="h-4 w-4 text-amber-600" />
                                    <AlertTitle className="font-semibold text-amber-700">Important Disclaimer</AlertTitle>
                                    <AlertDescription className="text-xs text-amber-600">
                                        {suggestedCodesResult.disclaimer || "AI-generated coding suggestions are for informational purposes only and require review and verification by a qualified medical coder or clinician. Final coding decisions are the responsibility of the healthcare provider."}
                                    </AlertDescription>
                                </Alert>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {(lockedPatient || form.getValues("selectedPatient")) && (
                <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Quick Actions (Saves current note first):</h4>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAction(`/dashboard/pharmacy/prescribe`)} disabled={isSubmittingForm || isLoadingConsultations}>
                            <Pill className="mr-2 h-4 w-4" /> Prescribe Medication
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAction(`/dashboard/lab/order`)} disabled={isSubmittingForm || isLoadingConsultations}>
                            <FlaskConical className="mr-2 h-4 w-4" /> Order Lab Test
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAction(`/dashboard/appointments/new`)} disabled={isSubmittingForm || isLoadingConsultations}>
                             <CalendarPlusIcon className="mr-2 h-4 w-4" /> Schedule Follow-up
                        </Button>
                    </div>
                </div>
                )}

                <div className="flex justify-end pt-6">
                <Button type="submit" disabled={isSubmittingForm || isLoadingConsultations}>
                    {(isSubmittingForm || isLoadingConsultations) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Consultation Note
                </Button>
                </div>
            </form>
            </Form>
        </CardContent>
        </Card>
    </div>
  );
}

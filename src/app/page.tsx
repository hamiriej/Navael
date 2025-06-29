
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, FileEdit, ArrowLeft, Sparkles, Copy, Pill, FlaskConical, CalendarPlus as CalendarPlusIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Separator } from "@/components/ui/separator";
import { summarizeConsultationNotes, type SummarizeConsultationNotesInput } from "@/ai/flows/summarize-consultation-notes-flow";
import { useConsultations } from "@/contexts/consultation-context"; // Import context
import type { Consultation } from "../../page"; 
import { consultationNoteSchema } from "../../new/page"; 
import { CalendarIcon as CalendarLucideIcon } from "lucide-react";
import Link from "next/link"; 
import { logActivity } from "@/lib/activityLog"; // Context handles logging for CRUD

type ConsultationEditFormValues = z.infer<typeof consultationNoteSchema>;

export default function EditConsultationNotePage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const consultationId = params.consultationId as string;
  const { username: loggedInDoctorName } = useAuth(); 
  const { fetchConsultationById, updateConsultation, isLoadingConsultations: isContextLoading } = useConsultations(); 

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consultationNote, setConsultationNote] = useState<Consultation | null>(null);
  const [isLoadingNote, setIsLoadingNote] = useState(true); // Local loading state for this specific note

  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [generatedAISummaryText, setGeneratedAISummaryText] = useState<string | null>(null);

  const form = useForm<ConsultationEditFormValues>({
    resolver: zodResolver(consultationNoteSchema),
    defaultValues: {
        consultationDate: new Date(),
        doctorName: loggedInDoctorName || "",
    },
  });

  useEffect(() => {
    const loadNote = async () => {
      if (consultationId) {
        setIsLoadingNote(true); // Start local loading
        const note = await fetchConsultationById(consultationId); // Context function no longer sets global loading
        if (note) {
          setConsultationNote(note);
          form.reset({
            patientSearch: note.patientName, 
            selectedPatient: {id: note.patientId, name: note.patientName},
            consultationDate: parseISO(note.consultationDate),
            presentingComplaint: note.presentingComplaint,
            historyOfPresentingComplaint: note.historyOfPresentingComplaint || "",
            pastMedicalHistory: note.pastMedicalHistory || "",
            medicationHistory: note.medicationHistory || "",
            allergies: note.allergies || "",
            familyHistory: note.familyHistory || "",
            socialHistory: note.socialHistory || "",
            reviewOfSystems: note.reviewOfSystems || "",
            examinationFindings: note.examinationFindings || "",
            aiGeneratedSummary: note.aiGeneratedSummary || "",
            assessmentDiagnosis: note.assessmentDiagnosis,
            plan: note.plan,
            doctorName: note.doctorName,
          });
          setGeneratedAISummaryText(note.aiGeneratedSummary || null);
        } else {
          toast({ title: "Error", description: "Consultation note not found.", variant: "destructive" });
          router.replace("/dashboard/consultations");
        }
        setIsLoadingNote(false); // End local loading
      } else {
        setIsLoadingNote(false); // No ID, so not loading
         router.replace("/dashboard/consultations"); // Redirect if no ID
      }
    };
    loadNote();
  }, [consultationId, fetchConsultationById, form, router, toast]);


  const handleGenerateAISummary = async () => {
    setIsGeneratingSummary(true);
    setGeneratedAISummaryText(null);
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
      const result = await summarizeConsultationNotes(input);
      setGeneratedAISummaryText(result.summary);
      toast({ title: "AI Summary Generated", description: "Review the summary below." });
    } catch (error) {
      console.error("Error generating AI summary:", error);
      toast({ title: "AI Summary Error", description: "Could not generate summary at this time.", variant: "destructive" });
      setGeneratedAISummaryText("Failed to generate summary.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleUseAISummary = () => {
    if (generatedAISummaryText) {
      form.setValue("aiGeneratedSummary", generatedAISummaryText);
      toast({ title: "Summary Applied", description: "AI summary has been added to the note form." });
    }
  };

  const processAndSaveConsultation = async (values: ConsultationEditFormValues): Promise<boolean> => {
    if (!consultationNote) {
        toast({ title: "Error", description: "Original consultation note not found.", variant: "destructive" });
        return false;
    }

    const updatedNoteData: Partial<Omit<Consultation, 'id'>> = { 
      consultationDate: values.consultationDate.toISOString(),
      doctorName: values.doctorName,
      presentingComplaint: values.presentingComplaint,
      historyOfPresentingComplaint: values.historyOfPresentingComplaint,
      pastMedicalHistory: values.pastMedicalHistory,
      medicationHistory: values.medicationHistory,
      allergies: values.allergies,
      familyHistory: values.familyHistory,
      socialHistory: values.socialHistory,
      reviewOfSystems: values.reviewOfSystems,
      examinationFindings: values.examinationFindings,
      aiGeneratedSummary: values.aiGeneratedSummary,
      assessmentDiagnosis: values.assessmentDiagnosis,
      plan: values.plan,
      time: format(values.consultationDate, "p"),
      reason: values.presentingComplaint.substring(0, 50) + (values.presentingComplaint.length > 50 ? "..." : ""),
    };
    
    try {
      await updateConsultation(consultationNote.id, updatedNoteData); 
      toast({
        title: "Consultation Note Updated",
        description: `Note for ${consultationNote.patientName} has been successfully updated.`,
      });
      return true;
    } catch (error) {
      console.error("Error updating consultation via context:", error);
      toast({ title: "Update Error", description: "Could not update consultation note.", variant: "destructive"});
      return false;
    }
  };

  const onSubmit = async (values: ConsultationEditFormValues) => {
    setIsSubmitting(true);
    const saved = await processAndSaveConsultation(values);
    if (saved) {
      router.push("/dashboard/consultations");
    }
    setIsSubmitting(false);
  };

  const handleQuickAction = async (targetHref: string, patientIdForAction?: string) => {
    if (!patientIdForAction) {
        toast({title: "Patient ID Missing", description: "Cannot perform quick action without patient context.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    const isValid = await form.trigger();
    if (!isValid) {
        toast({ title: "Validation Error", description: "Please correct the errors in the form before proceeding.", variant: "destructive" });
        const fieldErrors = form.formState.errors;
        const firstErrorField = Object.keys(fieldErrors)[0] as keyof ConsultationEditFormValues;
        if (firstErrorField) form.setFocus(firstErrorField);
        setIsSubmitting(false);
        return;
    }

    const currentValues = form.getValues();
    const saved = await processAndSaveConsultation(currentValues);

    if (saved) {
      router.push(`${targetHref}?patientId=${patientIdForAction}`);
    }
    if (!saved) setIsSubmitting(false);
  };


  if (isLoadingNote || isContextLoading && !consultationNote) { 
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading consultation note...</p>
      </div>
    );
  }

  if (!consultationNote && !isLoadingNote) { 
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-destructive text-lg">Consultation note not found.</p>
        <Button onClick={() => router.push("/dashboard/consultations")} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Consultations
        </Button>
      </div>
    );
  }
  
  const currentPatientIdForActions = consultationNote?.patientId;

  return (
    <div className="space-y-6">
        <Button variant="outline" onClick={() => router.back()} className="mb-4" disabled={isSubmitting || isLoadingNote || isContextLoading}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Consultations
        </Button>
        <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader>
            <div className="flex items-center space-x-3">
            <FileEdit className="h-7 w-7 text-primary" />
            <CardTitle className="font-headline text-2xl">
                Edit Consultation Note for {consultationNote?.patientName}
            </CardTitle>
            </div>
            <CardDescription>
                Modifying consultation for patient ID: {consultationNote?.patientId}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="p-3 border rounded-md bg-muted/50">
                    <p className="text-sm font-medium text-foreground">Patient: {consultationNote?.patientName}</p>
                    <p className="text-xs text-muted-foreground">ID: {consultationNote?.patientId}</p>
                </div>

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
                                disabled={isSubmitting || isLoadingNote || isContextLoading}
                                >
                                {field.value ? format(field.value, "PPP HH:mm") : <span>Pick a date and time</span>}
                                <CalendarLucideIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus />
                            <Input type="time" className="mt-2 p-2 border-t"
                                   value={field.value ? format(field.value, "HH:mm") : ""}
                                   onChange={(e) => {
                                        const time = e.target.value;
                                        const datePart = field.value ? format(field.value, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
                                        field.onChange(new Date(`${datePart}T${time}`));
                                   }}
                                   disabled={isSubmitting || isLoadingNote || isContextLoading}/>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="doctorName" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Doctor</FormLabel>
                            <FormControl><Input placeholder="Enter doctor's name" {...field} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>

                <Separator />
                <h3 className="text-lg font-semibold font-headline text-primary">Clinical Notes</h3>

                <FormField control={form.control} name="presentingComplaint" render={({ field }) => (
                <FormItem>
                    <FormLabel>Presenting Complaint</FormLabel>
                    <FormControl><Textarea placeholder="e.g., Sore throat, fever for 3 days..." {...field} rows={3} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <FormField control={form.control} name="historyOfPresentingComplaint" render={({ field }) => (
                <FormItem>
                    <FormLabel>History of Presenting Complaint (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Detailed history of the current issue..." {...field} rows={4} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="pastMedicalHistory" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Past Medical History (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Hypertension, Diabetes Type 2, Asthma..." {...field} rows={3} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
                        <FormDescription>Significant past illnesses, surgeries, hospitalizations.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )} />
                    <FormField control={form.control} name="medicationHistory" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Current Medications (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Lisinopril 10mg OD, Metformin 500mg BD..." {...field} rows={3} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
                        <FormDescription>Include dosage and frequency.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="allergies" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Allergies (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Penicillin (rash), Peanuts (anaphylaxis)..." {...field} rows={3} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
                        <FormDescription>Include reaction if known.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )} />
                    <FormField control={form.control} name="familyHistory" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Family History (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Father - MI at 50, Mother - Breast Cancer..." {...field} rows={3} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
                        <FormDescription>Relevant family medical conditions.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )} />
                </div>

                <FormField control={form.control} name="socialHistory" render={({ field }) => (
                <FormItem>
                    <FormLabel>Social History (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="e.g., Smoking, alcohol, occupation, living situation..." {...field} rows={3} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <FormField control={form.control} name="reviewOfSystems" render={({ field }) => (
                <FormItem>
                    <FormLabel>Review of Systems (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Systematic review, e.g., CVS: No chest pain, GIT: NAD..." {...field} rows={4} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <FormField control={form.control} name="examinationFindings" render={({ field }) => (
                <FormItem>
                    <FormLabel>Examination Findings (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Physical examination findings, vital signs..." {...field} rows={5} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <Separator />
                <div className="space-y-4 p-4 border rounded-md shadow-sm bg-muted/30">
                    <h3 className="text-lg font-semibold font-headline text-primary flex items-center"><Sparkles className="mr-2 h-5 w-5"/>AI-Powered Note Summary</h3>
                    <Button type="button" variant="outline" onClick={handleGenerateAISummary} disabled={isGeneratingSummary || isSubmitting || isLoadingNote || isContextLoading}>
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
                                <Button type="button" size="sm" variant="secondary" onClick={handleUseAISummary} className="mt-3" disabled={isSubmitting || isLoadingNote || isContextLoading}>
                                    <Copy className="mr-2 h-4 w-4"/> Use this Summary (Copies to field below)
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                    <FormField control={form.control} name="aiGeneratedSummary" render={({ field }) => (
                    <FormItem>
                        <FormLabel>AI Generated Summary (Editable)</FormLabel>
                        <FormControl><Textarea placeholder="AI summary will appear here after generation, or type your own." {...field} rows={4} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
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
                    <FormControl><Textarea placeholder="Clinical assessment or diagnosis..." {...field} rows={3} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <FormField control={form.control} name="plan" render={({ field }) => (
                <FormItem>
                    <FormLabel>Plan</FormLabel>
                    <FormControl><Textarea placeholder="Treatment plan, investigations, referrals, follow-up..." {...field} rows={4} disabled={isSubmitting || isLoadingNote || isContextLoading}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                {currentPatientIdForActions && (
                <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Quick Actions (Saves current note first):</h4>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAction(`/dashboard/pharmacy/prescribe`, currentPatientIdForActions)} disabled={isSubmitting || isLoadingNote || isContextLoading}>
                            <Pill className="mr-2 h-4 w-4" /> Prescribe Medication
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAction(`/dashboard/lab/order`, currentPatientIdForActions)} disabled={isSubmitting || isLoadingNote || isContextLoading}>
                            <FlaskConical className="mr-2 h-4 w-4" /> Order Lab Test
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAction(`/dashboard/appointments/new`, currentPatientIdForActions)} disabled={isSubmitting || isLoadingNote || isContextLoading}>
                             <CalendarPlusIcon className="mr-2 h-4 w-4" /> Schedule Follow-up
                        </Button>
                    </div>
                </div>
                )}

                <div className="flex justify-end pt-6">
                <Button type="submit" disabled={isSubmitting || isLoadingNote || isContextLoading}>
                    {(isSubmitting || isLoadingNote || isContextLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileEdit className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
                </div>
            </form>
            </Form>
        </CardContent>
        </Card>
    </div>
  );
}
    
      
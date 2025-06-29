"use client";

// --- UI Components ---
// These are components from your UI library (e.g., Shadcn UI)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Used for AI medical coding suggestions
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Used for AI medical coding disclaimers

// --- Icons (from Lucide React) ---
import { Loader2, MessageSquarePlus, Search, UserCircle, CalendarIcon as CalendarLucideIcon, Sparkles, Copy, ArrowLeft, Pill, FlaskConical, CalendarPlus as CalendarPlusIcon, BookMarked, Code } from "lucide-react";

// --- Form Validation & State Management ---
import { zodResolver } from "@hookform/resolvers/zod"; // Integrates Zod with React Hook Form
import { useForm } from "react-hook-form"; // React Hook Form library
import { z } from "zod"; // Zod for schema validation

// --- Utilities & Hooks ---
import { format, setHours, setMinutes, parseISO, differenceInYears } from "date-fns"; // Add parseISO, differenceInYears
import { cn } from "@/lib/utils"; // Utility to conditionally join TailwindCSS classes
import { useToast } from "@/hooks/use-toast"; // Custom hook for displaying toasts/notifications
import { useEffect, useState, useMemo, useCallback } from "react"; // React hooks
import { useSearchParams, useRouter } from "next/navigation"; // Next.js hooks for URL parameters and navigation

// --- Contexts & Types (for application-wide state/data) ---
import { useAuth } from "@/contexts/auth-context"; // Context for authentication and user details
import { usePatients, type Patient } from "@/contexts/patient-context"; // Context for patient data
import { useConsultations } from "@/contexts/consultation-context"; // Context for consultation data actions (create, update, etc.)
import type { Consultation } from "../page"; // Type definition for a Consultation object

// --- AI Flow Types (These are just type imports, actual API calls happen via fetch) ---
import type { SummarizeConsultationNotesInput } from "@/ai/flows/summarize-consultation-notes-flow";
import type { SuggestMedicalCodesInput, SuggestMedicalCodesOutput } from "@/ai/flows/suggest-medical-codes-flow";

// --- Other Imports ---
import Link from "next/link"; // For client-side navigation within Next.js
import { Badge } from "@/components/ui/badge";






// --- Zod Schema for Form Validation ---
// This schema defines the structure and validation rules for all the fields
// in your consultation note form. It ensures data integrity before submission.
export const consultationNoteSchema = z.object({
  // `patientSearch` is a UI-only field for searching patients, not directly saved to DB.
  patientSearch: z.string().optional(),
  // `selectedPatient` holds the ID and name of the chosen patient. It's validated to be present before save.
  selectedPatient: z.object({ id: z.string(), name: z.string() }).optional(),
  
  // Core consultation details
  consultationDate: z.date({ required_error: "Consultation date is required" }),
  doctorName: z.string().min(1, "Doctor's name is required"),
  presentingComplaint: z.string().min(1, "Presenting complaint is required").max(1000),

  // Optional detailed clinical history fields
  historyOfPresentingComplaint: z.string().max(2000).optional(),
  pastMedicalHistory: z.string().max(2000).optional(),
  medicationHistory: z.string().max(2000).optional(),
  allergies: z.string().max(1000).optional(),
  familyHistory: z.string().max(2000).optional(),
  socialHistory: z.string().max(2000).optional(),
  reviewOfSystems: z.string().max(2000).optional(),
  examinationFindings: z.string().max(3000).optional(),
  
  // AI-generated summary (optional, but can be populated by AI or manually)
  aiGeneratedSummary: z.string().max(2000).optional(),
  
  // Assessment and plan (required)
  assessmentDiagnosis: z.string().min(1, "Assessment/Diagnosis is required").max(2000),
  plan: z.string().min(1, "Plan for treatment/follow-up is required").max(2000),
});

// Type definition derived directly from the Zod schema for type safety
// with React Hook Form and other parts of the component.
type ConsultationNoteFormValues = z.infer<typeof consultationNoteSchema>;

// --- Main Component: NewConsultationNotePage ---
export default function NewConsultationNotePage() {
  // --- Hooks for External Functionality ---
  const { toast } = useToast(); // Hook to display user feedback messages
  const router = useRouter(); // Hook to programmatically navigate between pages
  const searchParams = useSearchParams(); // Hook to read URL query parameters

  // --- Context Hooks for Global Application State/Data ---
  const { username: loggedInDoctorName } = useAuth(); // Get the name of the currently logged-in doctor
  const { patients, getPatientById } = usePatients(); // Access the list of all patients and a function to retrieve a patient by ID
  const { createConsultation, isLoadingConsultations } = useConsultations(); // Access the function to save new consultations and its loading state

  // --- Component Local State Variables ---
  const [isSubmittingForm, setIsSubmittingForm] = useState(false); // Controls the loading state during form submission
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false); // Controls loading state for AI summary generation
  const [generatedAISummaryText, setGeneratedAISummaryText] = useState<string | null>(null); // Stores the AI-generated summary text for display

  const [searchedPatients, setSearchedPatients] = useState<Patient[]>([]); // Stores patient search results for the dropdown
  const [lockedPatient, setLockedPatient] = useState<Patient | null>(null); // Stores a patient object if pre-selected via URL query params

  const [isSuggestingCodes, setIsSuggestingCodes] = useState(false); // Controls loading state for AI medical code suggestion
  const [suggestedCodesResult, setSuggestedCodesResult] = useState<SuggestMedicalCodesOutput | null>(null); // Stores AI-generated medical code suggestions

  // Extract patient ID from the URL query parameter (e.g., `/dashboard/consultations/new?patientId=P123`).
  const patientIdFromQuery = searchParams.get("patientId");

  // --- React Hook Form Initialization ---
  // Sets up the form with Zod validation, and defines default values for all fields.
  // Default values ensure that form inputs are "controlled" (have a defined value) from their initial render.
  const form = useForm<ConsultationNoteFormValues>({
    resolver: zodResolver(consultationNoteSchema), // Integrates Zod for schema validation
    defaultValues: {
      consultationDate: new Date(), // Defaults to the current date and time
      presentingComplaint: "", // Default to empty string for controlled input
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
      doctorName: loggedInDoctorName || "", // Pre-fills with the logged-in doctor's name, or empty string if not available
      // `selectedPatient` and `patientSearch` are handled dynamically via effects and handlers,
      // so they are not included in `defaultValues` here.
    },
  });

  // --- Effects ---
  // This `useEffect` hook runs when the component mounts or when `patientIdFromQuery` changes.
  // It's responsible for pre-populating patient-related form fields if a `patientId` is provided in the URL.
  useEffect(() => {
    // CORRECTED: Mark the function as 'async'
    const loadPatientFromQuery = async () => {
      if (patientIdFromQuery) {
        // Await the result of getPatientById. This will give you the actual Patient or undefined.
        const foundPatient = await getPatientById(patientIdFromQuery); // This 'await' is now valid!

        if (foundPatient) {
          setLockedPatient(foundPatient);
          // And remember to use firstName/lastName for display
          form.setValue("selectedPatient", { id: foundPatient.id, name: `${foundPatient.firstName} ${foundPatient.lastName}` });
          form.setValue("patientSearch", `${foundPatient.firstName} ${foundPatient.lastName}`);

          form.setValue("pastMedicalHistory", foundPatient.medicalHistoryNotes || "");
          form.setValue("allergies", foundPatient.allergies?.join(', ') || "");
        } else {
          toast({ title: "Error", description: "Patient not found for the given ID.", variant: "destructive" });
        }
      }
    };

    loadPatientFromQuery(); // Call the async function

  }, [patientIdFromQuery, toast, getPatientById, form]); // Dependencies

  // --- Handlers (Part 1 - Patient Search & AI Summary Generation) ---

  /**
   * `handlePatientSearch`
   * This function filters the list of available patients based on the user's search term.
   * It populates the `searchedPatients` state, which is used to render the search dropdown.
   *
   * @param searchTerm The text entered by the user in the patient search input.
   */
  const handlePatientSearch = useCallback((searchTerm: string) => {
    if (searchTerm) {
      // Filter patients whose names include the search term (case-insensitive search).
      setSearchedPatients(
        patients.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } else {
      // If the search term is empty, clear the search results.
      setSearchedPatients([]);
    }
  }, [patients]); // Dependency: `patients` list from context.

  /**
   * `handleGenerateAISummary`
   * This asynchronous function triggers the AI to generate a summary of the clinical notes.
   * It collects relevant data from the form, sends it to an API endpoint, and displays the result.
   *
   * It also manages loading states and user feedback (toasts).
   */
  const handleGenerateAISummary = useCallback(async () => {
    setIsGeneratingSummary(true); // Set loading state to true for UI feedback (e.g., spinner)
    setGeneratedAISummaryText(null); // Clear any previously generated summary from the display card
    form.setValue("aiGeneratedSummary", ""); // Clear the `aiGeneratedSummary` form field immediately for visual feedback

    // Gather values from relevant form fields to send to the AI for summarization.
    // Use `|| 'N/A'` to ensure that even optional/empty fields contribute something to the prompt.
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
    ].join('\n\n'); // Join all notes with double newlines for clear separation

    try {
      const input: SummarizeConsultationNotesInput = { notesToSummarize };
      // Make a POST request to your Next.js API route responsible for AI summarization.
      const response = await fetch('/api/ai/summarize-consultation-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      // Check if the API response was successful.
      if (!response.ok) {
        const errorData = await response.json(); // Parse error details from response body
        throw new Error(errorData.error || 'Failed to generate AI summary.'); // Throw an error with a descriptive message
      }

      const result = await response.json(); // Parse the successful response body
      setGeneratedAISummaryText(result.summary); // Store the generated summary in state for display in the AI card

      // Important: The AI summary is NOT automatically populated into the form field here.
      // The user must explicitly click a "Use this Summary" button for it to be moved into the form.
      toast({ title: "AI Summary Generated", description: "Review the summary below." }); // Show success toast

    } catch (error: any) {
      console.error("Error generating AI summary:", error); // Log the detailed error to the console
      toast({ title: "AI Summary Error", description: error.message || "Could not generate summary at this time.", variant: "destructive" }); // Show an error toast to the user
      setGeneratedAISummaryText("Failed to generate summary."); // Display a failure message in the AI card to the user
    } finally {
      setIsGeneratingSummary(false); // Always set loading state to false when the process finishes (success or failure)
    }
  }, [form, toast]); // Dependencies: `form` (to get values and set field) and `toast` (for notifications).



  /**
   * `handleUseAISummary`
   * This function is called when the user clicks the "Use this Summary" button.
   * It takes the AI-generated summary text and populates it into the `aiGeneratedSummary` form field.
   */
  const handleUseAISummary = useCallback(() => {
    if (generatedAISummaryText) {
      form.setValue("aiGeneratedSummary", generatedAISummaryText); // Set the form field's value
      toast({ title: "Summary Applied", description: "AI summary has been added to the note form." });
    }
  }, [form, generatedAISummaryText, toast]); // Dependencies: `form` (to set value), `generatedAISummaryText` (content), `toast` (notifications)

  /**
   * `handleSuggestMedicalCodes`
   * This asynchronous function triggers the AI to suggest medical codes (e.g., ICD, CPT)
   * based on the provided clinical text (assessment, plan, presenting complaint).
   * It manages loading states and displays the AI's suggestions or errors.
   */
  const handleSuggestMedicalCodes = useCallback(async () => {
    setIsSuggestingCodes(true); // Set loading state to true
    setSuggestedCodesResult(null); // Clear any previously suggested codes from display

    // Gather relevant clinical text from form fields.
    const assessment = form.getValues("assessmentDiagnosis");
    const plan = form.getValues("plan");
    const complaint = form.getValues("presentingComplaint");

    // Validate if there's enough text for the AI to process.
    if (!assessment.trim() && !plan.trim() && !complaint.trim()) {
      toast({ title: "Insufficient Text", description: "Please provide presenting complaint, assessment/diagnosis or plan to get coding suggestions.", variant: "destructive" });
      setIsSuggestingCodes(false);
      return;
    }

    // Combine the relevant text into a single string for the AI prompt.
    const clinicalText = `Presenting Complaint: ${complaint}\n\nAssessment/Diagnosis: ${assessment}\n\nPlan: ${plan}`;
    try {
      const input: SuggestMedicalCodesInput = { clinicalText };
      // Make a POST request to your Next.js API route for AI medical code suggestion.
      const response = await fetch('/api/ai/suggest-medical-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      // Check for API response success.
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to suggest medical codes.');
      }

      const result: SuggestMedicalCodesOutput = await response.json();
      setSuggestedCodesResult(result); // Store the suggested codes for display.
      toast({ title: "Medical Codes Suggested", description: "AI has provided coding suggestions." });

    } catch (error: any) {
      console.error("Error suggesting medical codes:", error);
      toast({ title: "AI Coding Error", description: error.message || "Could not suggest codes at this time.", variant: "destructive" });
      setSuggestedCodesResult({ suggestedCodes: [], disclaimer: "Failed to load suggestions." }); // Display a failure message
    } finally {
      setIsSuggestingCodes(false); // End loading animation.
    }
  }, [form, toast]); // Dependencies: `form` (to get values) and `toast` (for notifications)

  /**
   * `processAndSaveConsultation`
   * This helper function is responsible for preparing and saving the consultation note data to Firestore.
   * It's called by both the main `onSubmit` function and the `handleQuickAction` function.
   *
   * @param values The validated form data (from `react-hook-form`).
   * @returns The saved `Consultation` object (with its Firestore ID) or `null` if the save failed.
   */
  const processAndSaveConsultation = useCallback(async (values: ConsultationNoteFormValues): Promise<Consultation | null> => {
    const patientForNote = lockedPatient || values.selectedPatient; // Determine which patient object to use
    if (!patientForNote) {
      // If no patient is selected, set a form error and display a toast.
      form.setError("patientSearch", { type: "manual", message: "Please select a patient." });
      toast({ title: "Patient Required", description: "Please select a patient.", variant: "destructive" });
      return null;
    }
    

    // Prepare the data structure required for Firestore.
    // `Omit` is used to exclude client-side-only fields (`time`, `reason`) and
    // Firestore-managed fields (`id`, `createdAt`, `updatedAt`) as they are handled by the context.

// First, determine the full name based on the patientForNote type
let patientFullName: string;
if (patientForNote && 'firstName' in patientForNote) {
  // If it's a Patient object (from lockedPatient), combine first and last names
  patientFullName = `${patientForNote.firstName} ${patientForNote.lastName}`;
} else if (patientForNote && 'name' in patientForNote) {
  // If it's the selectedPatient object from the form, use its 'name' property
  patientFullName = patientForNote.name;
} else {
  // Fallback, though your logic should ensure patientForNote is always valid here
  patientFullName = "Unknown Patient";
}

    const newConsultationData: Omit<Consultation, 'id' | 'time' | 'reason' | 'createdAt' | 'updatedAt'> = {
      patientId: patientForNote.id,
      patientName: patientFullName,
      consultationDate: values.consultationDate.toISOString(), // Convert Date object to ISO string for consistent storage
      doctorName: values.doctorName,
      presentingComplaint: values.presentingComplaint,
      // Ensure optional fields send an empty string if not provided, for consistency in Firestore.
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
      status: "Open", // Default status for a newly created note
    };

    try {
      // Call the `createConsultation` function from your consultation context.
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
  }, [createConsultation, lockedPatient, form, toast]); // Dependencies: `createConsultation` (from context), `lockedPatient` (current state), `form` (to set error), `toast` (notifications)

  /**
   * `onSubmit`
   * This is the main handler for the form's `submit` event.
   * It orchestrates the entire form submission process: validation, saving, resetting, and redirection.
   */
    const onSubmit = useCallback(async (values: ConsultationNoteFormValues) => {
    setIsSubmittingForm(true);
    const savedConsultation = await processAndSaveConsultation(values);

    if (savedConsultation) {
      // --- NEW: Get the full patient object before resetting the form ---
      let patientToResetWith: Patient | null = null;
      if (lockedPatient) {
        patientToResetWith = lockedPatient;
      } else if (values.selectedPatient) {
        // Await the call to get the patient data
        const fetchedPatient = await getPatientById(values.selectedPatient.id);
        // If fetchedPatient is undefined, assign null to patientToResetWith.
        // Otherwise, assign the fetched AugmentedPatient (which is compatible with Patient).
        patientToResetWith = fetchedPatient || null; // <-- CORRECTED: Handles undefined by converting it to null
      }
      // --- END NEW LOGIC ---
      form.reset({
        consultationDate: new Date(),
        doctorName: loggedInDoctorName || "",
        // Now use 'patientToResetWith' which is guaranteed to be a Patient or null
        patientSearch: patientToResetWith ? `${patientToResetWith.firstName} ${patientToResetWith.lastName}` : "",
        selectedPatient: patientToResetWith ? { id: patientToResetWith.id, name: `${patientToResetWith.firstName} ${patientToResetWith.lastName}` } : undefined,
        presentingComplaint: "",
        historyOfPresentingComplaint: "",
        // Correctly access properties from the full 'patientToResetWith' object
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

      setGeneratedAISummaryText(null); // Clear AI summary display
      setSuggestedCodesResult(null); // Clear AI code suggestions display
      if (!lockedPatient) { // If the patient was not locked (i.e., user selected it from search), clear the selection for the next note.
        form.setValue("selectedPatient", undefined);
        form.setValue("patientSearch", "");
      }
      router.push("/dashboard/consultations"); // Redirect to the main consultations list page.
    }
    setIsSubmittingForm(false); // End form submission loading state.
  }, [form, loggedInDoctorName, lockedPatient, processAndSaveConsultation, router, getPatientById]); // Dependencies for `onSubmit`

  /**
   * `handleQuickAction`
   * This function is triggered by buttons like "Prescribe Medication" or "Order Lab Test".
   * It first ensures the current consultation note is saved, then redirects to the specified target page,
   * typically passing the patient's ID to maintain context for the next action.
   *
   * @param targetHref The URL path to navigate to after saving the consultation.
   * @param patientIdForAction Optional: An explicit patient ID to use for the action, overriding current form selection.
   */
  const handleQuickAction = useCallback(async (targetHref: string, patientIdForAction?: string) => {
    // Determine the patient ID to use for the quick action:
    // 1. If a patient is 'locked' from the URL query, use their ID.
    // 2. Otherwise, use the `patientIdForAction` if provided.
    // 3. Otherwise, use the ID from the currently `selectedPatient` in the form.
    const finalPatientId = lockedPatient?.id || patientIdForAction || form.getValues("selectedPatient")?.id;

    if (!finalPatientId) {
      // If no patient is identified, prompt the user to select one and focus the search input.
      toast({ title: "Patient Not Selected", description: "Please select or confirm a patient before performing this action.", variant: "destructive" });
      if (!lockedPatient) form.setFocus("patientSearch");
      return;
    }

    setIsSubmittingForm(true); // Start loading state for the action.
    const isValid = await form.trigger(); // Manually trigger form validation before saving.
    if (!isValid) {
      // If validation fails, display an error and focus on the first erroneous field.
      toast({ title: "Validation Error", description: "Please correct the errors in the form before proceeding.", variant: "destructive" });
      const fieldErrors = form.formState.errors;
      const firstErrorField = Object.keys(fieldErrors)[0] as keyof ConsultationNoteFormValues;
      if (firstErrorField) form.setFocus(firstErrorField);
      setIsSubmittingForm(false); // End loading state.
      return;
    }

    // Attempt to save the current consultation note.
    const currentValues = form.getValues();
    const savedConsultation = await processAndSaveConsultation(currentValues);

   if (savedConsultation) {
      // If saving was successful, reset the form for a new entry but retain patient context if necessary.

      // --- CORRECTION 1: Await getPatientById and ensure type is Patient | null ---
      let patientToKeepOnForm: Patient | null = null;
      if (lockedPatient) {
        patientToKeepOnForm = lockedPatient;
      } else if (currentValues.selectedPatient) {
        const fetchedPatient = await getPatientById(currentValues.selectedPatient.id);
        patientToKeepOnForm = fetchedPatient || null; // Convert undefined to null
      }
      // --- END CORRECTION 1 ---

      form.reset({
          consultationDate: new Date(),
          doctorName: loggedInDoctorName || "",
          // --- CORRECTION 2: Use firstName and lastName for name properties ---
          patientSearch: patientToKeepOnForm ? `${patientToKeepOnForm.firstName} ${patientToKeepOnForm.lastName}` : "",
          selectedPatient: patientToKeepOnForm ? { id: patientToKeepOnForm.id, name: `${patientToKeepOnForm.firstName} ${patientToKeepOnForm.lastName}` } : undefined,
          // --- END CORRECTION 2 ---
          presentingComplaint: "",
          historyOfPresentingComplaint: "",
          // Now these lines will correctly access properties on Patient | null
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
      setGeneratedAISummaryText(null); // Clear AI summary display
      setSuggestedCodesResult(null); // Clear AI code suggestions display

      // Redirect to the target URL, passing the patient ID to maintain context.
      router.push(`${targetHref}?patientId=${finalPatientId}`);
    }
    // Only set submitting to false if save failed, otherwise redirect handles it.
    if (!savedConsultation) setIsSubmittingForm(false);
  }, [form, lockedPatient, processAndSaveConsultation, toast, loggedInDoctorName, getPatientById, router]);
   // --- Memos for Derived State/Values ---

  // Memoized value for the current selected patient's name, used in UI display.
  const currentSelectedPatientName = useMemo(() => {
if (lockedPatient) return `${lockedPatient.firstName} ${lockedPatient.lastName}`;
    // Watch 'selectedPatient' to ensure this memo re-evaluates when patient selection changes.
    return form.watch("selectedPatient")?.name;
  }, [lockedPatient, form.watch("selectedPatient")]);

  // Memoized value for the patient ID relevant for quick actions, ensuring consistency.
  const currentPatientIdForActions = lockedPatient?.id || form.getValues("selectedPatient")?.id;

  // --- Component Render ---
  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="outline" onClick={() => router.back()} className="mb-4" disabled={isSubmittingForm || isLoadingConsultations}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Consultations
      </Button>

      {/* Main Form Card */}
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <MessageSquarePlus className="h-7 w-7 text-primary" />
            <CardTitle className="font-headline text-2xl">
              {lockedPatient ? `New Consultation for ${lockedPatient.firstName} ${lockedPatient.lastName}` : "New Consultation Note"}
            </CardTitle>
          </div>
          <CardDescription>
            {lockedPatient ? `Recording consultation for patient ID: ${lockedPatient.id}` : "Select a patient and fill in the details for the consultation."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

              {/* Patient Selection Field (conditionally rendered if no patient is locked) */}
              {!lockedPatient && (
                <FormField
                  control={form.control}
                  name="patientSearch"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><UserCircle className="mr-2 h-4 w-4" />Search Patient</FormLabel>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
<FormControl>
  <Input
    placeholder="Type to search patient..."
    {...field}
    value={field.value || ''} // Ensure controlled input  <-- CORRECTED LINE
    onChange={(e) => {
      field.onChange(e);
      handlePatientSearch(e.target.value);
      form.setValue("selectedPatient", undefined); // Clear selected patient on new search
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
                                form.setValue("selectedPatient", { id: p.id, name: `${p.firstName} ${p.lastName}` });
                                form.setValue("patientSearch", `${p.firstName} ${p.lastName}`);
                                setSearchedPatients([]); // Close dropdown
                                form.clearErrors("patientSearch"); // Clear any previous errors
                                form.setValue("pastMedicalHistory", p.medicalHistoryNotes || "");
                                form.setValue("allergies", p.allergies?.join(', ') || "");
                              }}>
                              {`${p.firstName} ${p.lastName}`} (ID: {p.id})
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

          {/* Display for Locked Patient */}
          {lockedPatient && (
            <div className="p-3 border rounded-md bg-muted/50">
              <p className="text-sm font-medium text-foreground">Patient: {lockedPatient.firstName} {lockedPatient.lastName}</p>
              <p className="text-xs text-muted-foreground">
                ID: {lockedPatient.id} &bull; Age: {
                  lockedPatient.dateOfBirth ? differenceInYears(new Date(), parseISO(lockedPatient.dateOfBirth)) : 'N/A'
                } &bull; Gender: {lockedPatient.gender}
              </p>
            </div>
          )}

              {/* Consultation Date & Time and Doctor Fields */}
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
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            // When date is selected, keep the current time or default to 00:00
                            const currentDateTime = field.value || new Date();
                            const newDate = date ? setMinutes(setHours(date, currentDateTime.getHours()), currentDateTime.getMinutes()) : null;
                            field.onChange(newDate);
                          }}
                          disabled={(date) => date > new Date()} // Disable future dates
                          initialFocus
                        />
                        {/* Time Input for Calendar */}
                        <Input type="time" className="mt-2 p-2 border-t"
                          value={field.value ? format(field.value, "HH:mm") : ""} // Controlled input
                          onChange={(e) => {
                            const time = e.target.value;
                            // Take the date part from current field value, or current date if no date selected yet
                            const datePart = field.value ? format(field.value, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
                            field.onChange(new Date(`${datePart}T${time}`)); // Combine date and time
                          }}
                          disabled={isSubmittingForm || isLoadingConsultations} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
                {/* The doctorName FormField would typically follow here */}

              </div> {/* <-- This closing div for the grid will be the *last* thing in this section */}

<FormField control={form.control} name="doctorName" render={({ field }) => (
  <FormItem>
    <FormLabel>Doctor</FormLabel>
    <FormControl>
      <Input
        placeholder="Enter doctor's name"
        {...field}
        value={field.value || ''} // Ensure controlled input  <-- CORRECTED LINE
        disabled={!!loggedInDoctorName || isSubmittingForm || isLoadingConsultations}
      />
    </FormControl>
    <FormMessage />
  </FormItem>
)} />


              <Separator />
              <h3 className="text-lg font-semibold font-headline text-primary">Clinical Notes</h3>

              {/* Presenting Complaint */}
              <FormField control={form.control} name="presentingComplaint" render={({ field }) => (
                <FormItem>
                  <FormLabel>Presenting Complaint</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Sore throat, fever for 3 days..."
                      {...field}
                      value={field.value || ''} // Ensure controlled input <-- CORRECTED LINE
                      rows={3}
                      disabled={isSubmittingForm || isLoadingConsultations} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />


             {/* History of Presenting Complaint */}
              <FormField control={form.control} name="historyOfPresentingComplaint" render={({ field }) => (
                <FormItem>
                  <FormLabel>History of Presenting Complaint (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detailed history of the current issue..."
                      {...field}
                      value={field.value || ''} // Ensure controlled input <-- CORRECTED LINE
                      rows={4}
                      disabled={isSubmittingForm || isLoadingConsultations} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />


              {/* Past Medical History and Current Medications (grid layout) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="pastMedicalHistory" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Past Medical History (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Hypertension, Diabetes Type 2, Asthma..."
                        {...field}
                        value={field.value || ''} // Ensure controlled input <-- CORRECTED LINE
                        rows={3}
                        disabled={isSubmittingForm || isLoadingConsultations} />
                    </FormControl>
                    <FormDescription>Significant past illnesses, surgeries, hospitalizations.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="medicationHistory" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Medications (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Lisinopril 10mg OD, Metformin 500mg BD..."
                        {...field}
                        value={field.value || ''} // Ensure controlled input <-- CORRECTED LINE
                        rows={3}
                        disabled={isSubmittingForm || isLoadingConsultations} />
                    </FormControl>
                    <FormDescription>Include dosage and frequency.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>


              {/* Allergies and Family History (grid layout) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="allergies" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allergies (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Penicillin (rash), Peanuts (anaphylaxis)..."
                        {...field}
                        value={field.value || ''} // Ensure controlled input <-- CORRECTED LINE
                        rows={3}
                        disabled={isSubmittingForm || isLoadingConsultations} />
                    </FormControl>
                    <FormDescription>Include reaction if known.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="familyHistory" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Family History (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Father - MI at 50, Mother - Breast Cancer..."
                        {...field}
                        value={field.value || ''} // Ensure controlled input <-- CORRECTED LINE
                        rows={3}
                        disabled={isSubmittingForm || isLoadingConsultations} />
                    </FormControl>
                    <FormDescription>Relevant family medical conditions.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>


             {/* Social History */}
              <FormField control={form.control} name="socialHistory" render={({ field }) => (
                <FormItem>
                  <FormLabel>Social History (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Smoking, alcohol, occupation, living situation..."
                      {...field}
                      value={field.value || ''} // Ensure controlled input <-- CORRECTED LINE
                      rows={3}
                      disabled={isSubmittingForm || isLoadingConsultations} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />


              {/* Review of Systems */}
              <FormField control={form.control} name="reviewOfSystems" render={({ field }) => (
                <FormItem>
                  <FormLabel>Review of Systems (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Systematic review, e.g., CVS: No chest pain, GIT: NAD..."
                      {...field}
                      value={field.value || ''} // Ensure controlled input <-- CORRECTED LINE
                      rows={4}
                      disabled={isSubmittingForm || isLoadingConsultations} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />


              {/* Examination Findings */}
              <FormField control={form.control} name="examinationFindings" render={({ field }) => (
                <FormItem>
                  <FormLabel>Examination Findings (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Physical examination findings, vital signs..."
                      {...field}
                      value={field.value || ''} // Ensure controlled input <-- CORRECTED LINE
                      rows={5}
                      disabled={isSubmittingForm || isLoadingConsultations} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />


              <Separator />
              {/* AI-Powered Note Summary Section */}
              <div className="space-y-4 p-4 border rounded-md shadow-sm bg-muted/30">
                <h3 className="text-lg font-semibold font-headline text-primary flex items-center"><Sparkles className="mr-2 h-5 w-5" />AI-Powered Note Summary</h3>
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
                        <Copy className="mr-2 h-4 w-4" /> Use this Summary (Copies to field below)
                      </Button>
                    </CardContent>
                  </Card>
                )}
                <FormField control={form.control} name="aiGeneratedSummary" render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI Generated Summary (Editable)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="AI summary will appear here after generation, or type your own."
                        {...field}
                        value={field.value || ''} // Ensure controlled input <-- CORRECTED LINE
                        rows={4}
                        disabled={isSubmittingForm || isLoadingConsultations} />
                    </FormControl>
                    <FormDescription>This summary will be saved with the consultation note. You can edit it after generation.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>


                            <Separator />
              <h3 className="text-lg font-semibold font-headline text-primary">Assessment & Plan</h3>

              {/* Assessment / Diagnosis */}
              <FormField control={form.control} name="assessmentDiagnosis" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assessment / Diagnosis</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Clinical assessment or diagnosis..."
                      {...field}
                      value={field.value || ''} // Ensure controlled input <-- CORRECTED LINE
                      rows={3}
                      disabled={isSubmittingForm || isLoadingConsultations} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />


               {/* Plan */}
              <FormField control={form.control} name="plan" render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Treatment plan, investigations, referrals, follow-up..."
                      {...field}
                      value={field.value || ''} // Ensure controlled input <-- CORRECTED LINE
                      rows={4}
                      disabled={isSubmittingForm || isLoadingConsultations} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* AI Medical Coding Assistant Section */}
              <Separator />
              <div className="space-y-4 p-4 border rounded-md shadow-sm bg-muted/30">
                <h3 className="text-lg font-semibold font-headline text-primary flex items-center"><Code className="mr-2 h-5 w-5" />AI Medical Coding Assistant</h3>
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

              {/* Quick Actions Section */}
              {(lockedPatient || form.getValues("selectedPatient")) && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Quick Actions (Saves current note first):</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAction(`/dashboard/pharmacy/prescribe`, currentPatientIdForActions)} disabled={isSubmittingForm || isLoadingConsultations}>
                      <Pill className="mr-2 h-4 w-4" /> Prescribe Medication
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAction(`/dashboard/lab/order`, currentPatientIdForActions)} disabled={isSubmittingForm || isLoadingConsultations}>
                      <FlaskConical className="mr-2 h-4 w-4" /> Order Lab Test
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAction(`/dashboard/appointments/new`, currentPatientIdForActions)} disabled={isSubmittingForm || isLoadingConsultations}>
                      <CalendarPlusIcon className="mr-2 h-4 w-4" /> Schedule Follow-up
                    </Button>
                  </div>
                </div>
              )}

              {/* Save Button */}
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

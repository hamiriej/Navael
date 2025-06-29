
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Added Select
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, NotebookPen, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Admission } from "../../../../admissions/page";
import { useAuth } from "@/contexts/auth-context";
import { logActivity } from "@/lib/activityLog";

const ADMISSIONS_STORAGE_KEY = 'navael_admissions';
const NURSING_NOTES_STORAGE_KEY = 'navael_nursing_notes';

export interface NursingNoteRecord {
  id: string;
  patientId: string;
  admissionId: string;
  timestamp: string;
  noteType: string;
  content: string;
  recordedBy: string;
}

const predefinedNoteTypes = [
  "General Progress",
  "Medication Administration",
  "Intervention Record",
  "Patient Observation",
  "Safety Check",
  "Shift Handover",
  "Care Plan Update",
  "Wound Care",
  "Pain Assessment",
  "Patient Education",
  "Discharge Note (Draft)",
  "Other",
] as const;

const nursingNoteSchema = z.object({
  noteType: z.string().min(1, "Note type is required."),
  content: z.string().min(1, "Note content cannot be empty.").max(5000, "Note content is too long."),
});

type NursingNoteFormValues = z.infer<typeof nursingNoteSchema>;

export default function NewNursingNotePage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const admissionId = params.admissionId as string;
  const { username: staffName, userRole } = useAuth();

  const [isLoadingAdmission, setIsLoadingAdmission] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [admission, setAdmission] = useState<Admission | null>(null);

  const form = useForm<NursingNoteFormValues>({
    resolver: zodResolver(nursingNoteSchema),
    defaultValues: {
      noteType: predefinedNoteTypes[0], // Default to the first type
      content: "",
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
        console.error("Error loading admission data for nursing note:", e);
        toast({ title: "Load Error", description: "Could not load admission data.", variant: "destructive"});
      }
    }
    setIsLoadingAdmission(false);
  }, [admissionId, router, toast]);

  const onSubmit = async (values: NursingNoteFormValues) => {
    if (!admission || !staffName) {
        toast({ title: "Error", description: "Admission details or staff information missing.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    const newNote: NursingNoteRecord = {
      id: `NN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      patientId: admission.patientId,
      admissionId: admission.id,
      timestamp: new Date().toISOString(),
      noteType: values.noteType,
      content: values.content,
      recordedBy: staffName,
    };
    
    try {
      const storedNotes = localStorage.getItem(NURSING_NOTES_STORAGE_KEY);
      let notes: NursingNoteRecord[] = storedNotes ? JSON.parse(storedNotes) : [];
      notes.unshift(newNote);
      localStorage.setItem(NURSING_NOTES_STORAGE_KEY, JSON.stringify(notes));

      logActivity({
        actorRole: userRole || "System",
        actorName: staffName,
        actionDescription: `Added nursing note (${values.noteType}) for patient ${admission.patientName} (Admission: ${admission.id})`,
        targetEntityType: "Nursing Note",
        targetEntityId: newNote.id,
        targetLink: `/dashboard/patients/${admission.patientId}?view=nursing_notes`,
        iconName: "NotebookPen",
        details: values.content.substring(0, 100) + (values.content.length > 100 ? "..." : ""),
      });

      toast({ title: "Nursing Note Saved", description: `Note for ${admission.patientName} has been successfully recorded.` });
      form.reset({ noteType: predefinedNoteTypes[0], content: "" });
      router.push(`/dashboard/patients/${admission.patientId}?view=nursing_notes`);
    } catch (e) {
      console.error("Error saving nursing note:", e);
      toast({ title: "Save Error", description: "Could not save nursing note.", variant: "destructive"});
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
                    <NotebookPen className="h-7 w-7 text-primary" />
                    <CardTitle className="font-headline text-2xl">Add Nursing Note</CardTitle>
                </div>
                <CardDescription>
                    Patient: <span className="font-semibold">{admission.patientName}</span> (Admission ID: {admission.id})
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="noteType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a note type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {predefinedNoteTypes.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField control={form.control} name="content" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Note Content</FormLabel>
                            <FormControl><Textarea placeholder="Enter nursing note details here..." {...field} rows={10} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    
                    <div className="text-sm text-muted-foreground">
                        Recorded by: {staffName || "Current User"} on {new Date().toLocaleString()}
                    </div>
                    
                    <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isSubmitting} size="lg">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <NotebookPen className="mr-2 h-4 w-4" />}
                        Save Nursing Note
                    </Button>
                    </div>
                </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}


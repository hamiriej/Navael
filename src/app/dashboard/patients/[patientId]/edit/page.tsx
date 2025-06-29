
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserCog, CalendarIcon as CalendarLucideIcon, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePatients, type Patient } from "@/contexts/patient-context"; // Import from context

const patientEditSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.date({ required_error: "Date of birth is required" }),
  gender: z.enum(["Male", "Female", "Other", "Prefer not to say"]),
  contactNumber: z.string().min(10, "Enter a valid contact number").regex(/^\+?[0-9\s-()]+$/, "Invalid phone number format"),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State/Province is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  emergencyContactName: z.string().min(1, "Emergency contact name is required"),
  emergencyContactRelationship: z.string().min(1, "Emergency contact relationship is required"),
  emergencyContactNumber: z.string().min(10, "Enter a valid emergency contact number").regex(/^\+?[0-9\s-()]+$/, "Invalid phone number format"),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  allergies: z.string().optional(),
  currentMedicationsNotes: z.string().optional(),
  medicalHistoryNotes: z.string().optional(),
  status: z.enum(["Active", "Inactive", "Pending"]),
});

type PatientEditFormValues = z.infer<typeof patientEditSchema>;

export default function EditPatientPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  // const patientId = params.patientId as string; // Original, less safe

  const { getPatientById, updatePatient, isLoading: isLoadingPatientsContext } = usePatients();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoadingPatientData, setIsLoadingPatientData] = useState(true);


  const form = useForm<PatientEditFormValues>({
    resolver: zodResolver(patientEditSchema),
  });

  useEffect(() => {
    let isActive = true;
    // Resolve patientId more safely
    const resolvedPatientId = Array.isArray(params.patientId) ? params.patientId[0] : params.patientId;

    async function loadPatientData() {
      if (!resolvedPatientId) {
        if (isActive) {
          toast({ title: "Error", description: "Patient ID is missing from URL.", variant: "destructive" });
          router.replace("/dashboard/patients");
          setIsLoadingPatientData(false);
        }
        return;
      }
      
      if (isLoadingPatientsContext) {
        if (isActive) setIsLoadingPatientData(true); // Reflect context loading
        return; 
      }

      if (isActive) setIsLoadingPatientData(true); // Indicate fetching specific patient
      try {
        const fetchedPatient = await getPatientById(resolvedPatientId);

        if (!isActive) return;

        if (fetchedPatient) {
          setPatient(fetchedPatient);
          const patientName = fetchedPatient.name || ""; // Fallback for name
          const nameParts = patientName.split(' ');
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(' ') || "";

          form.reset({
            id: fetchedPatient.id,
            firstName: firstName,
            lastName: lastName,
            dateOfBirth: fetchedPatient.dateOfBirth && isValid(parseISO(fetchedPatient.dateOfBirth)) ? parseISO(fetchedPatient.dateOfBirth) : new Date(),
            gender: fetchedPatient.gender as PatientEditFormValues["gender"],
            contactNumber: fetchedPatient.contactNumber || "",
            email: fetchedPatient.email || "",
            addressLine1: fetchedPatient.address?.line1 || "",
            addressLine2: fetchedPatient.address?.line2 || "",
            city: fetchedPatient.address?.city || "",
            state: fetchedPatient.address?.state || "",
            postalCode: fetchedPatient.address?.postalCode || "",
            emergencyContactName: fetchedPatient.emergencyContact?.name || "",
            emergencyContactRelationship: fetchedPatient.emergencyContact?.relationship || "",
            emergencyContactNumber: fetchedPatient.emergencyContact?.number || "",
            insuranceProvider: fetchedPatient.insurance?.provider || "",
            insurancePolicyNumber: fetchedPatient.insurance?.policyNumber || "",
            allergies: Array.isArray(fetchedPatient.allergies)
              ? fetchedPatient.allergies.join(", ")
              : (typeof fetchedPatient.allergies === 'string' ? fetchedPatient.allergies : ""), // If it's a string (e.g., ""), use it; otherwise, empty string.
            currentMedicationsNotes: Array.isArray(fetchedPatient.currentMedications)
              ? fetchedPatient.currentMedications.map(m => `${m.name} ${m.dosage} ${m.frequency}`).join("\n")
              : (typeof fetchedPatient.currentMedications === 'string' ? fetchedPatient.currentMedications : ""), // If it's a string (e.g., ""), use it; otherwise, empty string.
            medicalHistoryNotes: fetchedPatient.medicalHistoryNotes || "",
            status: fetchedPatient.status || "Pending",
          });
        } else {
          toast({ title: "Error", description: `Patient with ID ${resolvedPatientId} not found.`, variant: "destructive" });
          router.replace("/dashboard/patients");
        }
      } catch (error) {
        if (!isActive) return;
        toast({ title: "Error", description: "Could not load patient data.", variant: "destructive" });
        console.error("Failed to load patient:", error);
        router.replace("/dashboard/patients");
      } finally {
        if (isActive) {
          setIsLoadingPatientData(false);
        }
      }
    }

    loadPatientData();

    return () => {
      isActive = false; 
    };
  }, [params.patientId, getPatientById, form, router, toast, isLoadingPatientsContext]);

  const onSubmit = async (values: PatientEditFormValues) => {
    if (!patient) return;
    setIsSubmitting(true);

    const updatedPatientData: Patient = {
        ...patient, 
        id: values.id,
        name: `${values.firstName} ${values.lastName}`,
        dateOfBirth: format(values.dateOfBirth, "yyyy-MM-dd"),
        age: new Date().getFullYear() - values.dateOfBirth.getFullYear(),
        gender: values.gender,
        contactNumber: values.contactNumber,
        email: values.email || "",
        address: {
            line1: values.addressLine1,
            line2: values.addressLine2,
            city: values.city,
            state: values.state,
            postalCode: values.postalCode,
        },
        emergencyContact: {
            name: values.emergencyContactName,
            relationship: values.emergencyContactRelationship,
            number: values.emergencyContactNumber,
        },
        insurance: values.insuranceProvider ? {
            provider: values.insuranceProvider,
            policyNumber: values.insurancePolicyNumber || "",
        } : undefined,
        allergies: values.allergies ? values.allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
        currentMedications: values.currentMedicationsNotes
            ? values.currentMedicationsNotes.split('\n').map(line => {
                const parts = line.split(' ');
                return { name: parts[0] || "Unknown", dosage: parts[1] || "", frequency: parts.slice(2).join(' ') || "" };
            }).filter(m => m.name !== "Unknown")
            : [],
        medicalHistoryNotes: values.medicalHistoryNotes,
        status: values.status,
    };

    try {
      await updatePatient(patient.id, updatedPatientData); 
      toast({
        title: "Patient Updated",
        description: `${values.firstName} ${values.lastName}'s details have been successfully updated.`,
      });
      router.push(`/dashboard/patients/${values.id}`);
    } catch (error) {
        console.error("Failed to update patient:", error);
        toast({
            title: "Update Failed",
            description: "Could not update patient details. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoadingPatientsContext || isLoadingPatientData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!patient && !isLoadingPatientData) { 
     return (
       <div className="container mx-auto p-4 text-center">
          <p className="text-destructive text-lg">Patient with ID {Array.isArray(params.patientId) ? params.patientId[0] : params.patientId} could not be loaded for editing.</p>
        <Button onClick={() => router.push("/dashboard/patients")} variant="outline" className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Patients List
        </Button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Patient Profile
        </Button>
        <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader>
            <div className="flex items-center space-x-2">
            <UserCog className="h-6 w-6 text-primary" />
            <CardTitle className="font-headline text-2xl">Edit Patient: {patient?.name}</CardTitle>
            </div>
            <CardDescription>Update the patient's information below.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <h3 className="text-lg font-semibold font-headline border-b pb-2">Personal Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl><Input placeholder="John" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Date of Birth</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarLucideIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                            initialFocus
                            captionLayout="dropdown-buttons"
                            fromYear={1900}
                            toYear={new Date().getFullYear()}
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                        <SelectContent>
                        {["Male", "Female", "Other", "Prefer not to say"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )} />
                </div>

                <h3 className="text-lg font-semibold font-headline border-b pb-2 pt-4">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="contactNumber" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Contact Number</FormLabel>
                    <FormControl><Input placeholder="+1 123 456 7890" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl><Input placeholder="john.doe@example.com" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
                </div>
                <FormField control={form.control} name="addressLine1" render={({ field }) => (
                <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl><Input placeholder="123 Main St" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )} />
                <FormField control={form.control} name="addressLine2" render={({ field }) => (
                <FormItem>
                    <FormLabel>Address Line 2 (Optional)</FormLabel>
                    <FormControl><Input placeholder="Apartment, studio, or floor" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl><Input placeholder="New York" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                    <FormLabel>State/Province</FormLabel>
                    <FormControl><Input placeholder="NY" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="postalCode" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Postal Code</FormLabel>
                    <FormControl><Input placeholder="10001" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
                </div>

                <h3 className="text-lg font-semibold font-headline border-b pb-2 pt-4">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField control={form.control} name="emergencyContactName" render={({ field }) => (
                        <FormItem> <FormLabel>Full Name</FormLabel> <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl> <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="emergencyContactRelationship" render={({ field }) => (
                        <FormItem> <FormLabel>Relationship</FormLabel> <FormControl><Input placeholder="Spouse" {...field} /></FormControl> <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="emergencyContactNumber" render={({ field }) => (
                        <FormItem> <FormLabel>Contact Number</FormLabel> <FormControl><Input placeholder="+1 987 654 3210" {...field} /></FormControl> <FormMessage /></FormItem>
                    )} />
                </div>

                <h3 className="text-lg font-semibold font-headline border-b pb-2 pt-4">Medical Information</h3>
                 <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Patient Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                        <SelectContent>
                        {["Active", "Inactive", "Pending"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="insuranceProvider" render={({ field }) => (
                    <FormItem> <FormLabel>Insurance Provider (Optional)</FormLabel> <FormControl><Input placeholder="Blue Cross" {...field} /></FormControl> <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="insurancePolicyNumber" render={({ field }) => (
                    <FormItem> <FormLabel>Policy Number (Optional)</FormLabel> <FormControl><Input placeholder="X123456789" {...field} /></FormControl> <FormMessage /></FormItem>
                )} />
                </div>
                <FormField control={form.control} name="allergies" render={({ field }) => (
                <FormItem>
                    <FormLabel>Allergies (Optional, comma-separated)</FormLabel>
                    <FormControl><Textarea placeholder="e.g., Penicillin, Peanuts" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )} />
                <FormField control={form.control} name="currentMedicationsNotes" render={({ field }) => (
                <FormItem>
                    <FormLabel>Current Medications (Optional, one per line: Name Dosage Frequency)</FormLabel>
                    <FormControl><Textarea placeholder="e.g., Lisinopril 10mg Once daily\nMetformin 500mg Twice daily" {...field} rows={3}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />
                <FormField control={form.control} name="medicalHistoryNotes" render={({ field }) => (
                <FormItem>
                    <FormLabel>Significant Medical History (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="e.g., Hypertension, Type 2 Diabetes" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <div className="flex justify-end space-x-3 pt-6">
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || isLoadingPatientsContext || isLoadingPatientData }>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCog className="mr-2 h-4 w-4"/>}
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
    

    

    
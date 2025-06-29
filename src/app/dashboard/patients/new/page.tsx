
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus, CalendarIcon as CalendarLucideIcon, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { usePatients, type NewPatientFormData } from "@/contexts/patient-context"; // Import usePatients and NewPatientFormData
import { useRouter } from "next/navigation";


const patientRegistrationSchema = z.object({
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
});

type PatientRegistrationFormValues = z.infer<typeof patientRegistrationSchema>;

export default function NewPatientPage() {
  const { toast } = useToast();
  const { addPatient, isLoading } = usePatients(); // Use context
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PatientRegistrationFormValues>({
    resolver: zodResolver(patientRegistrationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      gender: undefined,
      contactNumber: "",
      email: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      emergencyContactName: "",
      emergencyContactRelationship: "",
      emergencyContactNumber: "",
      insuranceProvider: "",
      insurancePolicyNumber: "",
      allergies: "",
      currentMedicationsNotes: "",
      medicalHistoryNotes: "",
    },
  });

  const onSubmit = async (values: PatientRegistrationFormValues) => {
    setIsSubmitting(true);
    
    try {
      // The addPatient function from context now expects NewPatientFormData
      const newPatientId = await addPatient(values as NewPatientFormData); // Cast because schema matches NewPatientFormData
      toast({
        title: "Patient Registered",
        description: `${values.firstName} ${values.lastName} has been successfully registered. Patient ID: ${newPatientId}`,
      });
      form.reset();
      router.push("/dashboard/patients"); // Redirect to patient list
    } catch (error) {
      console.error("Failed to add patient:", error);
      toast({
        title: "Registration Failed",
        description: "Could not register the patient. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
        <Button variant="outline" onClick={() => router.back()} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader>
            <div className="flex items-center space-x-2">
            <UserPlus className="h-6 w-6 text-primary" />
            <CardTitle className="font-headline text-2xl">New Patient Registration</CardTitle>
            </div>
            <CardDescription>Fill in the details below to register a new patient.</CardDescription>
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
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? (
                                format(field.value, "PPP")
                            ) : (
                                <span>Pick a date</span>
                            )}
                            <CalendarLucideIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                            }
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                <h3 className="text-lg font-semibold font-headline border-b pb-2 pt-4">Medical Information (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="insuranceProvider" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Insurance Provider</FormLabel>
                    <FormControl><Input placeholder="Blue Cross" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="insurancePolicyNumber" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Policy Number</FormLabel>
                    <FormControl><Input placeholder="X123456789" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
                </div>
                <FormField control={form.control} name="allergies" render={({ field }) => (
                <FormItem>
                    <FormLabel>Allergies (comma-separated)</FormLabel>
                    <FormControl><Textarea placeholder="e.g., Penicillin, Peanuts" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )} />
                <FormField control={form.control} name="currentMedicationsNotes" render={({ field }) => (
                <FormItem>
                    <FormLabel>Current Medications (one per line: Name Dosage Frequency)</FormLabel>
                    <FormControl><Textarea placeholder="e.g., Lisinopril 10mg Once daily\nMetformin 500mg Twice daily" {...field} rows={3}/></FormControl>
                    <FormMessage />
                </FormItem>
                )} />
                <FormField control={form.control} name="medicalHistoryNotes" render={({ field }) => (
                <FormItem>
                    <FormLabel>Significant Medical History</FormLabel>
                    <FormControl><Textarea placeholder="e.g., Hypertension, Type 2 Diabetes" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )} />

                <div className="flex justify-end space-x-3 pt-6">
                    <Button type="button" variant="outline" onClick={() => form.reset()} disabled={isSubmitting || isLoading}>
                        Clear Form
                    </Button>
                    <Button type="submit" disabled={isSubmitting || isLoading}>
                        {(isSubmitting || isLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Register Patient
                    </Button>
                </div>
            </form>
            </Form>
        </CardContent>
        </Card>
    </div>
  );
}

    
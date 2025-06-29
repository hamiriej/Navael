"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, BedDouble, Search, UserCircle, CalendarIcon as CalendarLucideIcon, ArrowLeft, NotebookPen } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { usePatients, type Patient } from "@/contexts/patient-context";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/contexts/auth-context";
import type { Ward } from "../../inpatient/bed-management/page"; // Import Ward type only
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Added missing import


// Define the storage key locally instead of importing
const WARDS_BEDS_STORAGE_KEY_FOR_ADMISSION = 'navael_wards_beds_data';

const admissionSchema = z.object({
  patientSearch: z.string().optional(),
  selectedPatient: z.object({ id: z.string(), name: z.string() }).optional(),
  admissionDate: z.date({ required_error: "Admission date is required" }),
  selectedWardId: z.string().min(1, "Ward selection is required"),
  selectedBedId: z.string().min(1, "Bed selection is required"),
  admissionReason: z.string().min(1, "Reason for admission is required").max(1000),
  admittingDoctor: z.string().min(1, "Admitting doctor is required"),
});

type AdmissionFormValues = z.infer<typeof admissionSchema>;

export default function NewAdmissionPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { patients } = usePatients();
  const { userRole: actorRole, username: actorName } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchedPatients, setSearchedPatients] = useState<Patient[]>([]);
  const [allWards, setAllWards] = useState<Ward[]>([]);
  const [availableBeds, setAvailableBeds] = useState<Ward["beds"]>([]);

  const form = useForm<AdmissionFormValues>({
    resolver: zodResolver(admissionSchema),
    defaultValues: {
      admissionDate: new Date(),
      selectedWardId: "",
      selectedBedId: "",
      admissionReason: "",
      admittingDoctor: "",
    },
  });

  useEffect(() => {
    try {
        const storedWards = localStorage.getItem(WARDS_BEDS_STORAGE_KEY_FOR_ADMISSION);
        if (storedWards) {
            setAllWards(JSON.parse(storedWards));
        }
    } catch (e) {
        console.error("Error loading wards for admission form:", e);
        setAllWards([]);
    }
  }, []);

  const selectedWardIdValue = form.watch("selectedWardId");

  useEffect(() => {
    if (selectedWardIdValue) {
        const selectedWard = allWards.find(w => w.id === selectedWardIdValue);
        if (selectedWard) {
            setAvailableBeds(selectedWard.beds.filter(b => b.status === "Available"));
        } else {
            setAvailableBeds([]);
        }
        form.setValue("selectedBedId", ""); // Reset bed selection when ward changes
    } else {
        setAvailableBeds([]);
    }
  }, [selectedWardIdValue, allWards, form]);


  const handlePatientSearch = (searchTerm: string) => {
    if (searchTerm) {
      setSearchedPatients(
        patients.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } else {
      setSearchedPatients([]);
    }
  };

  const onSubmit = async (values: AdmissionFormValues) => {
    if (!values.selectedPatient) {
        form.setError("patientSearch", { type: "manual", message: "Please select a patient." });
        return;
    }
    if (!values.selectedBedId) {
        form.setError("selectedBedId", { type: "manual", message: "Please select an available bed."});
        return;
    }
    setIsSubmitting(true);

    const selectedBed = availableBeds.find(b => b.id === values.selectedBedId);
    const selectedWard = allWards.find(w => w.id === values.selectedWardId);

    if (!selectedBed || !selectedWard) {
        toast({ title: "Error", description: "Selected ward or bed not found. Please re-select.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }
    
    // Update Bed Status in localStorage
    try {
        const storedWardsData = localStorage.getItem(WARDS_BEDS_STORAGE_KEY_FOR_ADMISSION);
        let currentWards: Ward[] = storedWardsData ? JSON.parse(storedWardsData) : [];
        
        currentWards = currentWards.map(ward => {
            if (ward.id === values.selectedWardId) {
                return {
                    ...ward,
                    beds: ward.beds.map(bed => {
                        if (bed.id === values.selectedBedId) {
                            return { ...bed, status: "Occupied", patientId: values.selectedPatient!.id, patientName: values.selectedPatient!.name };
                        }
                        return bed;
                    })
                };
            }
            return ward;
        });
        localStorage.setItem(WARDS_BEDS_STORAGE_KEY_FOR_ADMISSION, JSON.stringify(currentWards));
        // Also update the local state for immediate reflection on this page if needed, or ensure BedManagementPage re-fetches
        setAllWards(currentWards); 
         if (selectedWardIdValue === values.selectedWardId) { // Re-filter beds for current ward view
            const updatedSelectedWard = currentWards.find(w => w.id === values.selectedWardId);
            setAvailableBeds(updatedSelectedWard ? updatedSelectedWard.beds.filter(b => b.status === "Available") : []);
        }
    } catch (error) {
        console.error("Failed to update bed status in localStorage:", error);
        toast({ title: "Bed Update Error", description: "Could not update bed status. Admission not fully processed.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }


    // Save admission
    const newAdmissionData = {
      id: `ADM-${Date.now()}`,
      patientId: values.selectedPatient.id,
      patientName: values.selectedPatient.name,
      admissionDate: format(values.admissionDate, "yyyy-MM-dd"),
      reasonForAdmission: values.admissionReason, // Make sure this is added
      room: selectedWard.name, 
      bed: selectedBed.label,
      status: "Admitted" as const,
      primaryDoctor: values.admittingDoctor,
    };

    const existingAdmissions = JSON.parse(localStorage.getItem('navael_admissions') || '[]');
    existingAdmissions.unshift(newAdmissionData);
    localStorage.setItem('navael_admissions', JSON.stringify(existingAdmissions));


    logActivity({
        actorRole: actorRole || "System",
        actorName: actorName || "System",
        actionDescription: `Admitted patient ${values.selectedPatient.name} to Ward ${selectedWard.name}, Bed ${selectedBed.label}`,
        targetEntityType: "Admission",
        targetEntityId: values.selectedPatient.id,
        targetLink: `/dashboard/patients/${values.selectedPatient.id}`,
        iconName: "BedDouble",
        details: `Reason: ${values.admissionReason}, Admitting Dr: ${values.admittingDoctor}`,
    });
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Shorter delay
    toast({
      title: "Patient Admitted",
      description: `${values.selectedPatient.name} has been successfully admitted. Bed status updated.`,
    });
    form.reset({
        admissionDate: new Date(),
        selectedWardId: "",
        selectedBedId: "",
        admissionReason: "",
        admittingDoctor: "",
        patientSearch: "",
        selectedPatient: undefined,
    });
    setSearchedPatients([]);
    setIsSubmitting(false);
    router.push('/dashboard/admissions');
  };
  
  const currentSelectedPatientName = useMemo(() => {
    return form.getValues("selectedPatient")?.name;
  }, [form.watch("selectedPatient")]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <BedDouble className="mr-3 h-8 w-8 text-primary" /> New Patient Admission
          </h1>
          <p className="text-muted-foreground">Register a new patient admission into the system.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admissions
        </Button>
      </div>

      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Admission Form</CardTitle>
          <CardDescription>Fill in the details to admit a new patient.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
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
                            field.onChange(e);
                            handlePatientSearch(e.target.value);
                            form.setValue("selectedPatient", undefined);
                          }}
                          className="pl-10"
                        />
                      </FormControl>
                    </div>
                    {searchedPatients.length > 0 && (
                      <ul className="mt-1 border rounded-md max-h-40 overflow-y-auto bg-background shadow-md z-10 absolute w-full">
                        {searchedPatients.map(p => (
                          <li key={p.id} 
                              className="p-3 hover:bg-accent cursor-pointer text-sm"
                              onClick={() => {
                                  form.setValue("selectedPatient", {id: p.id, name: p.name});
                                  form.setValue("patientSearch", p.name); 
                                  setSearchedPatients([]);
                                  form.clearErrors("patientSearch");
                              }}>
                            {p.name} (ID: {p.id})
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
              
              <Separator />
              <h3 className="text-lg font-semibold font-headline text-primary flex items-center"><NotebookPen className="mr-2 h-5 w-5"/>Admission Details</h3>

              <FormField control={form.control} name="admissionDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                  <FormLabel>Admission Date</FormLabel>
                  <Popover>
                      <PopoverTrigger asChild>
                      <FormControl>
                          <Button
                          variant={"outline"}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarLucideIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                      </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus />
                      </PopoverContent>
                  </Popover>
                  <FormMessage />
                  </FormItem>
              )} />
              
                <FormField
                    control={form.control}
                    name="selectedWardId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Select Ward</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Choose a ward" /></SelectTrigger></FormControl>
                            <SelectContent>
                            {allWards.map(ward => (
                                <SelectItem key={ward.id} value={ward.id}>{ward.name}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="selectedBedId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Select Available Bed</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedWardIdValue || availableBeds.length === 0}>
                            <FormControl><SelectTrigger><SelectValue placeholder={!selectedWardIdValue ? "Select ward first" : (availableBeds.length === 0 ? "No beds available" : "Choose an available bed")} /></SelectTrigger></FormControl>
                            <SelectContent>
                            {availableBeds.map(bed => (
                                <SelectItem key={bed.id} value={bed.id}>{bed.label}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        {availableBeds.length === 0 && selectedWardIdValue && <FormDescription className="text-destructive">No available beds in this ward.</FormDescription>}
                        <FormMessage />
                        </FormItem>
                    )}
                />


              <FormField control={form.control} name="admissionReason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Admission</FormLabel>
                  <FormControl><Textarea placeholder="e.g., Acute appendicitis, Observation post-surgery..." {...field} rows={3} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="admittingDoctor" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Admitting Doctor</FormLabel>
                      <FormControl><Input placeholder="e.g., Dr. Smith" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              
              <div className="flex justify-end pt-6">
                <Button type="submit" disabled={isSubmitting} size="lg">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Admit Patient
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

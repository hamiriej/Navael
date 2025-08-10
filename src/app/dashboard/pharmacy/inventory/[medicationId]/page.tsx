
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PackageCheck, CalendarIcon as CalendarLucideIcon, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { usePharmacy } from "@/contexts/pharmacy-context"; // Import usePharmacy
import type { Medication } from "../../../page"; // Import Medication type

const editMedicationSchema = z.object({
  medicationName: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage form and strength is required"),
  category: z.string().min(1, "Category is required"),
  pricePerUnit: z.coerce.number().min(0.01, "Price per unit must be positive."),
  expiryDate: z.date({ required_error: "Expiry date is required" }),
  supplier: z.string().optional(),
  // Stock is not directly editable here, but shown. It's managed via stock adjustments.
});

type EditMedicationFormValues = z.infer<typeof editMedicationSchema>;

export default function EditMedicationPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const medicationId = params.medicationId as string;
  const { currency } = useAppearanceSettings();
  const { getMedicationById, updateMedicationInInventory, isLoadingMedications } = usePharmacy(); // Use context

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [medication, setMedication] = useState<Medication | null>(null);

  const form = useForm<EditMedicationFormValues>({
    resolver: zodResolver(editMedicationSchema),
  });

  useEffect(() => {
    const loadMedication = async () => {
      setIsLoadingData(true);
      if (medicationId) {
        const medToEdit = await getMedicationById(medicationId);
        if (medToEdit) {
          setMedication(medToEdit);
          form.reset({
            medicationName: medToEdit.name,
            dosage: medToEdit.dosage,
            category: medToEdit.category,
            pricePerUnit: medToEdit.pricePerUnit,
            expiryDate: isValid(parseISO(medToEdit.expiryDate)) ? parseISO(medToEdit.expiryDate) : new Date(),
            supplier: medToEdit.supplier || "",
          });
        } else {
          toast({ title: "Error", description: "Medication not found.", variant: "destructive" });
          router.replace("/dashboard/pharmacy");
        }
      }
      setIsLoadingData(false);
    };
    loadMedication();
  }, [medicationId, form, router, toast, getMedicationById]);

  const onSubmit = async (values: EditMedicationFormValues) => {
    if (!medication) return;
    setIsSubmitting(true);
    
    const updatedMedicationData: Partial<Omit<Medication, 'id'>> = {
      name: values.medicationName,
      dosage: values.dosage,
      category: values.category,
      pricePerUnit: values.pricePerUnit,
      expiryDate: format(values.expiryDate, "yyyy-MM-dd"),
      supplier: values.supplier,
      // Stock and status are not updated here directly; would need separate stock adjustment flow
    };

    try {
      await updateMedicationInInventory(medication.id, updatedMedicationData);
      toast({
        title: "Medication Updated",
        description: `${values.medicationName} has been successfully updated.`,
      });
      router.push("/dashboard/pharmacy"); 
    } catch (error) {
      console.error("Error updating medication via context:", error);
      toast({ title: "Update Error", description: "Could not update medication details.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoadingData || isLoadingMedications) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!medication && !isLoadingData) { // Check after loading attempt
    return <div className="text-center py-10">Medication not found. Redirecting...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
        <Button variant="outline" onClick={() => router.back()} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card className="shadow-lg">
        <CardHeader>
            <div className="flex items-center space-x-3">
            <PackageCheck className="h-7 w-7 text-primary" />
            <CardTitle className="font-headline text-2xl">Edit Medication: {medication?.name}</CardTitle>
            </div>
            <CardDescription>Update the details for this medication. Price is in {currency}. Current Stock: {medication?.stock} ({medication?.status})</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <FormField control={form.control} name="medicationName" render={({ field }) => (
                <FormItem>
                    <FormLabel>Medication Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )} />
                
                <FormField control={form.control} name="dosage" render={({ field }) => (
                <FormItem>
                    <FormLabel>Dosage Form & Strength</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormDescription>e.g., 250mg Tablet, 10mg/5ml Syrup</FormDescription>
                    <FormMessage />
                </FormItem>
                )} />

                <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                     <FormDescription>e.g., Antibiotic, Analgesic</FormDescription>
                    <FormMessage />
                </FormItem>
                )} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="pricePerUnit" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Price Per Unit ({currency})</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )} />
                    <FormField control={form.control} name="expiryDate" render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Expiry Date</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                {field.value ? format(field.value, "PPP") : <span>Pick an expiry date</span>}
                                <CalendarLucideIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date()} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )} />
                </div>
                
                <FormField control={form.control} name="supplier" render={({ field }) => (
                <FormItem>
                    <FormLabel>Supplier (Optional)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )} />
                
                <div className="flex justify-end pt-6">
                <Button type="submit" disabled={isSubmitting || isLoadingMedications}>
                    {(isSubmitting || isLoadingMedications) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

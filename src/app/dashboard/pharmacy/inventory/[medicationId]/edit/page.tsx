"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

// --- Import UI Components from shadcn/ui ---
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// --- Import Icons from lucide-react ---
import { Loader2, Save, Edit, CalendarIcon, ArrowLeft } from "lucide-react";

// --- Date formatting and utility ---
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils"; // Assuming you have a cn utility for classnames

// --- Medication type and context ---
// Corrected import path for Medication type
import { Medication } from "../../../page";
// Ensure usePharmacy is imported correctly
import { usePharmacy } from "@/contexts/pharmacy-context";

function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}


// Define the Zod schema for your edit form
// Fields that can be updated are optional, but should be correctly typed.
const editMedicationFormSchema = z.object({
  name: z.string().min(1, "Medication name is required.").optional(),
  dosage: z.string().min(1, "Dosage is required.").optional(),
  stock: z.coerce.number().int().min(0, "Stock must be a non-negative whole number.").optional(),
  category: z.string().min(1, "Category is required.").optional(),
  expiryDate: z.union([
    z.date({
      required_error: "Expiry date is required.",
      invalid_type_error: "Invalid expiry date format.",
    }).refine(date => date >= new Date(new Date().setHours(0,0,0,0)), {
      message: "Expiry date must be in the future or present."
    }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/, "Invalid expiry date format (YYYY-MM-DD or ISO)").optional()
  ]).optional(),
  supplier: z.string().optional(),
  pricePerUnit: z.coerce.number().min(0.01, "Price per unit must be positive.").optional(),
});

type EditMedicationFormValues = z.infer<typeof editMedicationFormSchema>;

export default function EditMedicationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const medicationId = params.medicationId as string;
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { updateMedicationInInventory } = usePharmacy();

  const form = useForm<EditMedicationFormValues>({
    resolver: zodResolver(editMedicationFormSchema),
    defaultValues: {
      name: "",
      dosage: "",
      stock: undefined,
      category: "",
      expiryDate: undefined,
      supplier: "",
      pricePerUnit: undefined,
    },
  });

  useEffect(() => {
    async function fetchMedication() {
      setIsLoadingData(true);
      try {
        const response = await fetch(`/api/pharmacy/medications/${medicationId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch medication details.");
        }
        const data: Medication = await response.json();

        const formattedData = {
          ...data,
          expiryDate: data.expiryDate ? parseISO(data.expiryDate) : undefined,
          stock: data.stock ? Number(data.stock) : undefined,
          pricePerUnit: data.pricePerUnit ? Number(data.pricePerUnit) : undefined,
        };
        form.reset(formattedData);
      } catch (error: any) {
        console.error("Error fetching medication for edit:", error);
        toast({ title: "Error", description: error.message || "Could not load medication details.", variant: "destructive" });
        router.push("/dashboard/pharmacy");
      } finally {
        setIsLoadingData(false);
      }
    }

    if (medicationId) {
      fetchMedication();
    }
  }, [medicationId, form, toast, router]);

  const onSubmit = async (values: EditMedicationFormValues) => {
    setIsSaving(true);
    try {
      const dataToSubmit = { ...values } as Partial<Medication>;

      // Fix: declare expiryDate once and use it in the checks
      const expiryDate = dataToSubmit.expiryDate;
      if (expiryDate && isDate(expiryDate)) {
  dataToSubmit.expiryDate = expiryDate.toISOString();
} else if (typeof expiryDate === "string") {
  // keep as is
} else {
  dataToSubmit.expiryDate = undefined;
}


      const updatedMed = await updateMedicationInInventory(medicationId, dataToSubmit);

      if (updatedMed) {
        toast({ title: "Success", description: "Medication updated successfully." });
        router.push("/dashboard/pharmacy");
      } else {
        toast({ title: "Error", description: "Failed to update medication.", variant: "destructive" });
      }
    } catch (error: any) {
      // Errors handled in context
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading medication details...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <Edit className="mr-3 h-8 w-8 text-primary" /> Edit Medication
          </h1>
          <p className="text-muted-foreground">Modify the information for this medication.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Inventory
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Medication Details</CardTitle>
          <CardDescription>Update the details for the medication.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medication Name</FormLabel>
                      <FormControl><Input placeholder="e.g., Amoxicillin" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dosage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dosage</FormLabel>
                      <FormControl><Input placeholder="e.g., 250mg, 10ml" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Stock</FormLabel>
                      <FormControl><Input type="number" {...field} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} /></FormControl>
                      <FormDescription>Number of units currently available.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Antibiotics">Antibiotics</SelectItem>
                          <SelectItem value="Analgesics">Analgesics</SelectItem>
                          <SelectItem value="Antipyretics">Antipyretics</SelectItem>
                          <SelectItem value="Antihistamines">Antihistamines</SelectItem>
                          <SelectItem value="Vitamins">Vitamins</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="expiryDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expiry Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value instanceof Date ? format(field.value, "PPP") : (
                                typeof field.value === 'string' && field.value ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              (typeof field.value === 'object' && field.value instanceof Date)
                                ? field.value
                                : undefined
                            }
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        The date after which the medication should not be used.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="supplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier (Optional)</FormLabel>
                      <FormControl><Input placeholder="e.g., PharmaCorp" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="pricePerUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price Per Unit</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="e.g., 10.50" {...field} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} /></FormControl>
                    <FormDescription>Cost of one unit of this medication.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

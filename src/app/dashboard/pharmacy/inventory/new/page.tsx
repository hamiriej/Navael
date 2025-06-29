"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, PlusCircle, Save, Loader2, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePharmacy } from "@/contexts/pharmacy-context"; // Assuming usePharmacy provides addMedication
import { Medication } from "../../page"; // To get the Medication type
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns"; // Import format from date-fns
import { cn } from "@/lib/utils"; // Assuming you have a cn utility for classnames

// Define the Zod schema for your form
// We'll define expiryDate as a Date object here because the date picker provides it,
// and then transform it to a string for the final Medication object.
const addMedicationFormSchema = z.object({
  name: z.string().min(1, "Medication name is required."),
  dosage: z.string().min(1, "Dosage is required."),
  stock: z.coerce.number().int().min(0, "Stock must be a non-negative whole number."),
  category: z.string().min(1, "Category is required."),
  expiryDate: z.date({ // This is now z.date() because your date picker likely gives you a Date object
    required_error: "Expiry date is required.",
    invalid_type_error: "Invalid expiry date format.",
  }).refine(date => date >= new Date(new Date().setHours(0,0,0,0)), { // Ensure date is today or in the future
    message: "Expiry date must be in the future."
  }),
  supplier: z.string().optional(),
  pricePerUnit: z.coerce.number().min(0.01, "Price per unit must be positive."), // Make optional based on form input
});

type AddMedicationFormValues = z.infer<typeof addMedicationFormSchema>;

export default function AddNewMedicationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { addMedication } = usePharmacy(); // Correctly destructuring addMedication from usePharmacy

  const form = useForm<AddMedicationFormValues>({
    resolver: zodResolver(addMedicationFormSchema),
    defaultValues: {
      name: "",
      dosage: "",
      stock: 0,
      category: "",
      supplier: "",
      pricePerUnit: 0.01, // Default to a positive price
      expiryDate: undefined, // Default to undefined for date picker
    },
  });

  const onSubmit = async (values: AddMedicationFormValues) => {
    // Transform expiryDate from Date object to ISO string before sending
    const medicationData: Omit<Medication, 'id' | 'status'> = {
      ...values,
      expiryDate: values.expiryDate.toISOString(), // Convert Date to ISO string
      // The 'status' field is handled by the backend POST /api/pharmacy/medications endpoint
      // based on the stock level, so it's omitted here.
    };

    const addedMed = await addMedication(medicationData);

    if (addedMed) {
      toast({
        title: "Medication Added",
        description: `${addedMed.name} (${addedMed.dosage}) has been successfully added to inventory.`,
      });
      router.push("/dashboard/pharmacy"); // Navigate back to pharmacy dashboard or inventory list
    } else {
      toast({
        title: "Error Adding Medication",
        description: "There was a problem adding the medication. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <PlusCircle className="mr-3 h-8 w-8 text-primary" /> Add New Medication
          </h1>
          <p className="text-muted-foreground">Add new pharmaceutical items to the inventory.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Inventory
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Medication Details</CardTitle>
          <CardDescription>Enter the details for the new medication.</CardDescription>
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
                      <FormControl>
                        <Input placeholder="e.g., Amoxicillin" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Input placeholder="e.g., 250mg, 500mg, 10ml" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} // Disable past dates
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
                      <FormControl>
                        <Input placeholder="e.g., PharmaCorp" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g., 10.50" {...field} />
                      </FormControl>
                      <FormDescription>Cost of one unit of this medication.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <Button type="submit" className="w-full">
                <Save className="mr-2 h-4 w-4" /> Add Medication
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

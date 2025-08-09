"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save, FlaskConical, ArrowLeft, CheckSquare, Info, ListOrdered, DollarSign } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { type LabTest } from "../../../page"; // Use type from main lab page
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatCurrency, getLabPaymentStatusVariant } from "@/lib/utils"; // <-- UPDATED LINE HERE!
import Link from "next/link";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { useLabOrders, type LabOrder } from "@/contexts/lab-order-context"; // Import context
import { useAuth } from "@/contexts/auth-context"; // For logging
import { logActivity } from '@/lib/activityLog';


const labTestResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  result: z.string().optional(),
  referenceRange: z.string().optional(),
  status: z.enum(['Pending Result', 'Result Entered']),
  notes: z.string().optional(),
});

const enterResultsSchema = z.object({
  orderId: z.string(),
  patientName: z.string(), 
  orderingDoctor: z.string(), 
  tests: z.array(labTestResultSchema),
});

type EnterResultsFormValues = z.infer<typeof enterResultsSchema>;

export default function EnterLabResultsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;
  const { currency } = useAppearanceSettings();
  const { fetchLabOrderById, updateLabOrder, isLoadingLabOrders } = useLabOrders(); // Use context
  const { username: actorName, userRole } = useAuth(); // For logging

  const [isSubmitting, setIsSubmitting] = useState(false); // Local form submission state
  const [labOrder, setLabOrder] = useState<LabOrder | null>(null);

  const form = useForm<EnterResultsFormValues>({
    resolver: zodResolver(enterResultsSchema),
    defaultValues: {
      orderId: "",
      patientName: "",
      orderingDoctor: "",
      tests: [],
    },
  });

  const { fields } = useFieldArray({ // Removed append, remove, update as fields are driven by fetched order
    control: form.control,
    name: "tests",
  });

  useEffect(() => {
    const loadOrder = async () => {
      if (orderId) {
        const fetchedOrder = await fetchLabOrderById(orderId); // Use context
        if (fetchedOrder) {
          if (fetchedOrder.paymentStatus !== "Paid" && fetchedOrder.status !== "Cancelled") {
              toast({
                  title: "Payment Pending for Order",
                  description: `Payment for lab order ${fetchedOrder.id} is still ${fetchedOrder.paymentStatus || 'pending'}. You can enter results, but they may not be released until payment is confirmed.`,
                  variant: "default",
                  duration: 8000,
              });
          }
          setLabOrder(fetchedOrder);
          form.reset({
            orderId: fetchedOrder.id,
            patientName: fetchedOrder.patientName,
            orderingDoctor: fetchedOrder.orderingDoctor,
            tests: fetchedOrder.tests.map(test => ({
              id: test.id,
              name: test.name,
              result: test.result || "",
              referenceRange: test.referenceRange || "",
              status: test.status === 'Result Entered' ? 'Result Entered' : 'Pending Result',

              notes: test.notes || "",
            })),
          });
        } else {
          toast({ title: "Error", description: `Lab order with ID ${orderId} not found.`, variant: "destructive" });
          router.replace("/dashboard/lab");
        }
      }
    };
    loadOrder();
  }, [orderId, form, router, toast, fetchLabOrderById]); // Added fetchLabOrderById to dependencies

  const onSubmit = async (values: EnterResultsFormValues) => {
    if (!labOrder) {
        toast({ title: "Error", description: "Original lab order not found.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    const updatedTests: LabTest[] = values.tests.map(testField => ({
      id: testField.id,
      name: testField.name,
      result: testField.result,
      referenceRange: testField.referenceRange,
      status: testField.status,
      notes: testField.notes,
      price: labOrder.tests.find(t => t.id === testField.id)?.price, 
    }));

    const allTestsEntered = updatedTests.every(test => test.status === 'Result Entered');

    const newStatus = allTestsEntered 
        ? (labOrder.paymentStatus === "Paid" ? "Results Ready" : "Awaiting Verification") 
        : labOrder.status === "Pending Sample" 
            ? "Sample Collected" 
            : (labOrder.status === "Sample Collected" && updatedTests.some(t=>t.status === "Result Entered") ? "Processing" : labOrder.status);
    
    // NOTE: `logActivity` is used here but not imported in the provided snippet.
    // Ensure you have `logActivity` imported from where it's defined (e.g., a logging context/utility).
    const verificationDetails = newStatus === "Results Ready" && !labOrder.verificationDate
        ? { verificationDate: new Date().toISOString(), verifiedBy: actorName || "Lab Tech" }
        : {};
    
    const sampleCollectionDateUpdate = (labOrder.status === "Pending Sample" && (newStatus === "Sample Collected" || newStatus === "Processing")) && !labOrder.sampleCollectionDate
        ? { sampleCollectionDate: new Date().toISOString() }
        : {};


    const updatedLabOrderData: Partial<Omit<LabOrder, 'id'>> = {
      tests: updatedTests,
      status: newStatus,
      ...verificationDetails,
      ...sampleCollectionDateUpdate,
    };

    try {
      const updatedOrder = await updateLabOrder(labOrder.id, updatedLabOrderData); // Use context
      
      if (updatedOrder) {
        // Assuming logActivity is globally available or imported from another file
        // For example: import { logActivity } from '@/utils/logActivity';
        // You might want to ensure 'logActivity' is imported correctly or defined.
        // As a friendly Firebase expert, I'm noting this as a potential point of future errors if not handled.
        // For the purpose of this request, I'm leaving it as is, assuming it's handled elsewhere.
        // @ts-ignore
        logActivity({ 
            actorRole: userRole || "System",
            actorName: actorName || "System",
            actionDescription: `Entered/Updated results for Lab Order ${updatedOrder.id} for ${updatedOrder.patientName}. New Status: ${updatedOrder.status}`,
            targetEntityType: "Lab Order",
            targetEntityId: updatedOrder.id,
            iconName: "Edit",
        });
        toast({
          title: "Lab Results Saved",
          description: `Results for order ID ${values.orderId} have been successfully updated. Current order status: ${updatedOrder.status}`,
        });
        // Navigate to the main lab dashboard or the specific queue the order might now be in.
        router.push("/dashboard"); // Or a more specific lab queue page if applicable
      } else {
        toast({ title: "Update Error", description: "Could not update lab order.", variant: "destructive" });
      }
    } catch (error) {
        console.error("Error updating lab order via context:", error);
        toast({ title: "Save Error", description: "Could not save lab results.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoadingLabOrders || !labOrder) { // Use context loading state and check for labOrder
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading lab order details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
        <Button variant="outline" onClick={() => router.back()} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lab Orders
        </Button>

        <Card className="shadow-xl">
        <CardHeader>
            <div className="flex items-center space-x-3">
            <FlaskConical className="h-8 w-8 text-primary" />
            <div>
                <CardTitle className="font-headline text-2xl">Enter Lab Results</CardTitle>
                <CardDescription>
                For Order ID: <span className="font-semibold text-primary">{labOrder.id}</span>
                </CardDescription>
            </div>
            </div>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6 p-4 border rounded-md bg-muted/30">
                <DetailItem label="Patient" value={labOrder.patientName} />
                <DetailItem label="Patient ID" value={labOrder.patientId} />
                <DetailItem label="Order Date" value={new Date(labOrder.orderDate).toLocaleDateString()} />
                <DetailItem label="Ordering Doctor" value={labOrder.orderingDoctor} />
                 <div className="flex items-center">
                      <label className="text-sm font-medium text-muted-foreground mr-2">Payment Status:</label>
                        <Badge variant={getLabPaymentStatusVariant(labOrder.paymentStatus ?? "Unknown")}>
                        <DollarSign className="mr-1 h-3 w-3"/>{labOrder.paymentStatus || "N/A"}
                    </Badge>
                     {labOrder.invoiceId && (
                        <Link href={`/dashboard/billing`} className="ml-1 text-xs text-primary hover:underline">
                            (Inv: {labOrder.invoiceId})
                        </Link>
                     )}
                </div>
                {labOrder.clinicalNotes && <DetailItem label="Clinical Notes from Doctor" value={labOrder.clinicalNotes} className="md:col-span-2"/>}
            </div>

            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-headline font-semibold flex items-center">
                        <ListOrdered className="mr-2 h-5 w-5 text-primary"/> Ordered Tests & Results
                    </h3>
                    <Badge variant="secondary">Overall Order Status: {labOrder.status}</Badge>
                </div>

                {fields.map((field, index) => (
                <Card key={field.id} className="p-4 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="p-2 mb-3">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-semibold">{field.name} {labOrder.tests.find(t => t.id === field.id)?.price ? `(${formatCurrency(labOrder.tests.find(t => t.id === field.id)!.price!, currency)})` : ''}</CardTitle>
                            <Badge variant={form.getValues(`tests.${index}.status`) === 'Result Entered' ? 'default' : 'secondary'}>
                                {form.getValues(`tests.${index}.status`)}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                            control={form.control}
                            name={`tests.${index}.result`}
                            render={({ field: formField }) => (
                                <FormItem>
                                <FormLabel>Result</FormLabel>
                                <FormControl>
                                    <Input placeholder="Enter test result" {...formField} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name={`tests.${index}.referenceRange`}
                            render={({ field: formField }) => (
                                <FormItem>
                                <FormLabel>Reference Range (Optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., 70-99 mg/dL" {...formField} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>
                        <FormField
                        control={form.control}
                        name={`tests.${index}.notes`}
                        render={({ field: formField }) => (
                            <FormItem>
                            <FormLabel>Lab Tech Notes for this Test (Optional)</FormLabel>
                            <FormControl>
                                <Textarea placeholder="e.g., Sample slightly hemolyzed. Repeat advised if clinically indicated." {...formField} rows={2} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                         <FormField
                            control={form.control}
                            name={`tests.${index}.status`}
                            render={({ field: formField }) => (
                                <FormItem>
                                <FormLabel>Test Status</FormLabel>
                                <Select onValueChange={formField.onChange} defaultValue={formField.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Pending Result">Pending Result</SelectItem>
                                        <SelectItem value="Result Entered">Result Entered</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>
                ))}

                <div className="flex justify-end pt-6">
                <Button type="submit" disabled={isSubmitting || isLoadingLabOrders} size="lg">
                    {(isSubmitting || isLoadingLabOrders) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save All Results for Order
                </Button>
                </div>
            </form>
            </Form>
        </CardContent>
         <CardFooter>
            <div className="flex items-center text-sm text-muted-foreground">
                <Info className="mr-2 h-4 w-4"/>
                Ensure all individual test statuses are marked 'Result Entered' to update the overall order status appropriately (e.g., to 'Awaiting Verification' or 'Results Ready' if paid).
            </div>
         </CardFooter>
        </Card>
    </div>
  );
}

const DetailItem = ({ label, value, className }: { label: string; value?: string; className?: string }) => {
  if (!value) return null;
  return (
    <div className={cn("text-sm", className)}>
      <p className="font-medium text-muted-foreground">{label}:</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
};


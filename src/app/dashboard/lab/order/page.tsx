"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PackagePlus, Search, FlaskConical, UserCircle, ClipboardList, Info, DollarSign, ArrowLeft } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import type { LabTest, LabOrder } from "@/app/dashboard/lab/types";
// filepath: d:\projects\NavaelHospitalSystem\src\app\dashboard\lab\order\page.tsximport { Invoice } from "@/contexts/invoice-context";
import { useAuth } from "@/contexts/auth-context";

import { Separator } from "@/components/ui/separator";
import { usePatients } from "@/contexts/patient-context";
import { ROLES } from "@/lib/constants";
import { format } from "date-fns";
import { logActivity } from "@/lib/activityLog";
import type { EditableLabTest } from "../../admin/service-pricing/page";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { formatCurrency } from "@/lib/utils";
import { useLabOrders } from "@/contexts/lab-order-context";
import { useInvoices } from "@/contexts/invoice-context";
import type {Invoice } from "@/contexts/invoice-context";
// filepath: d:\projects\NavaelHospitalSystem\src\app\dashboard\lab\order\page.tsx

const labOrderSchema = z.object({
  patientSearch: z.string().optional(),
  selectedPatient: z.object({
    id: z.string().min(1, "Patient ID must not be empty."),
    name: z.string().min(1, "Patient name must not be empty."),
  }).optional(),
  selectedTests: z.array(z.string()).min(1, "At least one lab test must be selected."),
  clinicalNotes: z.string().max(1000).optional(),
  orderingDoctor: z.string().min(1, "Ordering doctor's name is required"),
});

type LabOrderFormValues = z.infer<typeof labOrderSchema>;

export default function OrderLabTestPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { username: loggedInDoctorName, userRole } = useAuth();
  const { userRole: actorRole, username: actorName } = useAuth();
  const { currency } = useAppearanceSettings();
  const { patients: contextPatients, getPatientById } = usePatients();
  const { createLabOrder, isLoadingLabOrders: isSubmittingViaContext } = useLabOrders();
  const { createInvoice, isLoadingInvoices } = useInvoices();

  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [searchedPatients, setSearchedPatients] = useState<any[]>([]);
  const [lockedPatient, setLockedPatient] = useState<any | null>(null);
  const [availableLabTests, setAvailableLabTests] = useState<EditableLabTest[]>([]);
  const [isLoadingTests, setIsLoadingTests] = useState(true);

  const linkedConsultationIdFromQuery = searchParams.get("linkedConsultationId");
  const linkedAppointmentIdFromQuery = searchParams.get("linkedAppointmentId");

  useEffect(() => {
    const fetchLabTests = async () => {
      setIsLoadingTests(true);
      try {
        const response = await fetch('/api/admin/pricing/lab-tests');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: EditableLabTest[] = await response.json();
        setAvailableLabTests(data);
      } catch (e) {
        console.error("Error fetching lab test prices:", e);
        toast({
          title: "Error loading lab tests",
          description: "Could not fetch available lab tests. Please try again later.",
          variant: "destructive",
        });
        setAvailableLabTests([]);
      } finally {
        setIsLoadingTests(false);
      }
    };

    fetchLabTests();
  }, [toast]);

  const patientIdFromQuery = searchParams.get("patientId");

  const form = useForm<LabOrderFormValues>({
    defaultValues: {
      patientSearch: "",
      selectedTests: [],
      clinicalNotes: "",
      orderingDoctor: loggedInDoctorName || "",
    },
  });

  useEffect(() => {
    if (patientIdFromQuery) {
      const loadAndSetPatient = async () => {
        try {
          const foundPatient = await getPatientById(patientIdFromQuery);
          if (foundPatient) {
            setLockedPatient(foundPatient);
            form.setValue("selectedPatient", { id: foundPatient.id, name: foundPatient.name });
            form.setValue("patientSearch", foundPatient.name);
          } else {
            toast({ title: "Error", description: "Patient not found for the given ID.", variant: "destructive" });
            router.replace("/dashboard/lab");
          }
        } catch (error) {
          console.error("Error loading patient from context:", error);
          toast({ title: "Error", description: "Failed to load patient data.", variant: "destructive" });
          router.replace("/dashboard/lab");
        }
      };
      loadAndSetPatient();
    }
    if (loggedInDoctorName && (userRole === ROLES.DOCTOR || userRole === ROLES.NURSE)) {
      form.setValue("orderingDoctor", loggedInDoctorName);
    }
  }, [patientIdFromQuery, toast, router, getPatientById, form, loggedInDoctorName, userRole]);

  const handlePatientSearch = (searchTerm: string) => {
    if (searchTerm) {
      setSearchedPatients(
        contextPatients.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } else {
      setSearchedPatients([]);
    }
  };

  const onSubmit = async (values: LabOrderFormValues) => {
    if (!values.selectedPatient && !lockedPatient) {
      form.setError("patientSearch", { type: "manual", message: "Please select a patient." });
      return;
    }

    setIsSubmittingForm(true);

    const patientForOrder = lockedPatient || values.selectedPatient;

    if (!patientForOrder) {
      toast({ title: "Error", description: "Patient information is missing.", variant: "destructive" });
      setIsSubmittingForm(false);
      return;
    }

    const testsForOrder: LabTest[] = values.selectedTests.map((testName, index): LabTest => {
      const testDefinition = availableLabTests.find(t => t.name === testName);
      return {
        id: testDefinition?.id || `custom_${index}_${Date.now()}`,
        name: testName,
        status: 'Pending Result',
        price: testDefinition?.price
      };
    });

    const totalOrderPrice = testsForOrder.reduce((sum, test) => sum + (test.price || 0), 0);

    const invoiceLineItems = testsForOrder.map(test => ({
      description: `Lab Test: ${test.name}`,
      quantity: 1,
      unitPrice: test.price || 0,
      total: test.price || 0,
      sourceType: 'lab' as 'lab',
      sourceId: test.id,
    }));

    let invoiceId: string | undefined = undefined;

    if (totalOrderPrice > 0) {
      const invoiceData: Omit<Invoice, 'id'> = {
        patientId: patientForOrder.id,
        patientName: patientForOrder.name,
        date: format(new Date(), "yyyy-MM-dd"),
        dueDate: format(new Date(new Date().setDate(new Date().getDate() + 30)), "yyyy-MM-dd"),
        lineItems: invoiceLineItems,
        subTotal: totalOrderPrice,
        totalAmount: totalOrderPrice,
        amountPaid: 0,
        status: "Pending Payment",
      };
      try {
        const createdInv = await createInvoice(invoiceData);
        invoiceId = createdInv.id;
        toast({
          title: "Invoice Generated for Lab Order",
          description: `Invoice ${invoiceId} (${formatCurrency(totalOrderPrice, currency)}) created. Payment pending.`,
          duration: 7000,
        });
      } catch (error) {
        console.error("Error creating invoice for lab order via context:", error);
        toast({ title: "Invoice Error", description: "Could not generate invoice for the lab order.", variant: "destructive" });
        setIsSubmittingForm(false);
        return;
      }
    }

    const newLabOrderData: Omit<LabOrder, 'id'> = {
      patientId: patientForOrder.id,
      patientName: patientForOrder.name,
      orderDate: new Date().toISOString(),
      orderingDoctor: values.orderingDoctor,
      tests: testsForOrder,
      status: "Pending Sample",
      clinicalNotes: values.clinicalNotes,
      invoiceId: invoiceId,
      paymentStatus: totalOrderPrice > 0 ? "Pending Payment" : "Paid",
      linkedConsultationId: linkedConsultationIdFromQuery || undefined,
      linkedAppointmentId: linkedAppointmentIdFromQuery || undefined,
    };

    try {
      const createdLabOrder = await createLabOrder(newLabOrderData);

      logActivity({
        actorRole: actorRole || "System",
        actorName: actorName || "System",
        actionDescription: `Submitted Lab Order (${createdLabOrder.tests.map(t => t.name).join(', ')}) for ${createdLabOrder.patientName}`,
        targetEntityType: "Lab Order",
        targetEntityId: createdLabOrder.id,
        targetLink: `/dashboard/lab`,
        iconName: "FlaskConical",
        details: `Invoice: ${invoiceId || 'N/A'}`,
      });

      toast({
        title: "Lab Order Submitted",
        description: `Lab order for ${patientForOrder.name} has been successfully submitted. Order ID: ${createdLabOrder.id}`,
      });

      form.reset({
        orderingDoctor: (loggedInDoctorName && (userRole === ROLES.DOCTOR || userRole === ROLES.NURSE)) ? loggedInDoctorName : "",
        patientSearch: lockedPatient ? lockedPatient.name : "",
        selectedPatient: lockedPatient ? { id: lockedPatient.id, name: lockedPatient.name } : undefined,
        selectedTests: [],
        clinicalNotes: "",
      });
      setSearchedPatients([]);

      if (!lockedPatient) {
        form.setValue("selectedPatient", undefined);
        form.setValue("patientSearch", "");
      }

      if (userRole === ROLES.DOCTOR || userRole === ROLES.NURSE) {
        router.push(`/dashboard/patients/${patientForOrder.id}?action=lab_ordered`);
      } else {
        router.push("/dashboard/lab/incoming-orders");
      }

    } catch (error) {
      console.error("Error creating lab order via context:", error);
      toast({ title: "Order Submission Error", description: "Could not submit lab order.", variant: "destructive" });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const currentSelectedPatientName = useMemo(() => {
    if (lockedPatient) return lockedPatient.name;
    return form.getValues("selectedPatient")?.name;
  }, [lockedPatient, form.watch("selectedPatient")]);

  if (isLoadingTests) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3">Loading lab test options...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.back()} className="mb-2" disabled={isSubmittingForm || isSubmittingViaContext || isLoadingInvoices}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <Card className="max-w-3xl mx-auto shadow-lg">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <FlaskConical className="h-7 w-7 text-primary" />
            <CardTitle className="font-headline text-2xl">
              {lockedPatient ? `New Lab Order for ${lockedPatient.name}` : "Order Lab Tests"}
            </CardTitle>
          </div>
          <CardDescription>
            {lockedPatient ? `Creating lab order for patient ID: ${lockedPatient.id}` : "Select a patient and choose the required lab tests."}
            An invoice will be generated automatically for the ordered tests based on current pricing (in {currency}).
            {(userRole === ROLES.LAB_TECH) && (
              <p className="mt-2 text-xs text-orange-600 flex items-center"><Info className="h-3 w-3 mr-1"/> Note: Lab Technicians typically process orders received from clinicians. Direct order creation should only be done for clinician-authorized requests or specific protocols.</p>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {!lockedPatient && (
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
                        <ul className="mt-2 border rounded-md max-h-40 overflow-y-auto bg-card z-10 absolute w-full shadow-lg">
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
              )}
              {lockedPatient && (
                <div className="p-3 border rounded-md bg-muted/50">
                  <p className="text-sm font-medium text-foreground">Patient: {lockedPatient.name}</p>
                  <p className="text-xs text-muted-foreground">ID: {lockedPatient.id} &bull; Age: {lockedPatient.age} &bull; Gender: {lockedPatient.gender}</p>
                </div>
              )}

              <Separator />
              <FormField
                control={form.control}
                name="selectedTests"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-base font-headline flex items-center"><ClipboardList className="mr-2 h-5 w-5 text-primary"/>Select Lab Tests</FormLabel>
                    {availableLabTests.length === 0 && !isLoadingTests &&
                      <p className="text-sm text-destructive flex items-center">
                        <Info className="h-4 w-4 mr-2"/> No lab tests configured by Administrator. Please contact admin to add lab tests.
                      </p>
                    }
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                      {availableLabTests.map((test) => (
                        <FormField
                          key={test.id}
                          control={form.control}
                          name="selectedTests"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={test.id}
                                className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-accent/50 transition-colors"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(test.name)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), test.name])
                                        : field.onChange(
                                            (field.value || []).filter(
                                              (value) => value !== test.name
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-sm cursor-pointer">
                                  {test.name} ({formatCurrency(test.price || 0, currency)})
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField control={form.control} name="clinicalNotes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Clinical Notes for Lab (Optional)</FormLabel>
                  <FormControl><Textarea placeholder="e.g., Patient fasting for 12 hours. Check for specific markers..." {...field} rows={3} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="orderingDoctor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordering Doctor</FormLabel>
                  <FormControl><Input placeholder="Enter doctor's name" {...field} disabled={!!loggedInDoctorName && (userRole === ROLES.DOCTOR || userRole === ROLES.NURSE)} /></FormControl>
                  {!(userRole === ROLES.DOCTOR || userRole === ROLES.NURSE) && <FormDescription>Please ensure you are authorized by a clinician to place this order, or enter their name if ordering on their behalf.</FormDescription>}
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end pt-6">
                <Button type="submit" disabled={isSubmittingForm || isSubmittingViaContext || isLoadingInvoices || availableLabTests.length === 0} size="lg">
                  {(isSubmittingForm || isSubmittingViaContext || isLoadingInvoices) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Lab Order
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
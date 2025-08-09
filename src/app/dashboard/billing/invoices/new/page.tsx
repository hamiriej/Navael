"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, ArrowLeft, Trash2, DollarSign, FileText, Microscope, PillIcon, Loader2, Search, UserCircle, Library, BedDouble as BedDoubleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// --- EXISTING CONTEXT IMPORTS (NO CHANGES TO THESE) ---
import { usePatients, type Patient, type AugmentedPatient } from "@/contexts/patient-context";
import { useLabOrders, type LabOrder } from "@/contexts/lab-order-context"; // Uses API backend
import { usePharmacy, type Prescription } from "@/contexts/pharmacy-context"; // Uses API backend
import { useInvoices } from "@/contexts/invoice-context"; // This one is Firestore-backed (exception as per previous refactor)

// --- UTILITY IMPORTS ---
import { format, parseISO, differenceInDays } from "date-fns";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { formatCurrency } from "@/lib/utils";

// --- BASE INTERFACES (AS PROVIDED IN YOUR ORIGINAL CODE) ---
import type { Invoice as BaseInvoice } from "../../page";
import type { Admission } from "../../../admissions/page"; // Assuming Admission type is defined here

import type { Invoice } from "@/contexts/invoice-context";
// --- LOCAL MOCK DATA & INTERFACES (REVERSED TO ORIGINAL FOR CONSISTENCY WITH MOCK API PATTERN) ---
// These items do NOT have dedicated API-backed contexts provided, so their mocks remain local.

// Re-defining these interfaces based on original local mock usage
export interface OtherGeneralService {
  id: string;
  name: string;
  price: number;
}
export interface WardTariff {
  id: string;
  wardName: string;
  perDiemRate: number;
}
// Assuming a simplified mock Consultation structure used before
export interface MockConsultation {
  id: string;
  date: string;
  doctor: string;
  reason: string;
  patientId: string;
  price?: number;
}

// Reverted to original local mocks (as per instruction to maintain consistency)
const LOCAL_MOCK_OTHER_GENERAL_SERVICES: OtherGeneralService[] = [
  { id: "SERV_DRESSING_INV", name: "Wound Dressing - Small (Default)", price: 20.00 },
  { id: "SERV_INJECTION_INV", name: "Injection Administration (Default)", price: 10.00 },
];
const LOCAL_MOCK_WARD_TARIFFS_FOR_INVOICE: WardTariff[] = [
  { id: "WARD_GEN_INV", wardName: "General Ward (Default Pricing)", perDiemRate: 100.00 },
  { id: "WARD_PRIVATE_INV", wardName: "Private Room (Default Pricing)", perDiemRate: 250.00 },
];
const CONSULTATION_FEE = 75.00; // Still a constant for default consultation price

const ADMISSIONS_STORAGE_KEY = 'navael_admissions'; // Used for localStorage access

// Reverted to original mock function for consultations (as no API context provided)
const getMockConsultationsForPatient = (patientId: string): MockConsultation[] => [
  { id: "CONS001", date: "2024-07-10", doctor: "Dr. Smith", reason: "Annual Checkup", patientId: "P001", price: CONSULTATION_FEE },
  { id: "CONS002", date: "2024-07-01", doctor: "Dr. Jones", reason: "Follow-up", patientId: "P002", price: CONSULTATION_FEE },
].filter(c => c.patientId === patientId);


// --- ZOD SCHEMAS (UNCHANGED) ---
const lineItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  total: z.coerce.number(),
  sourceType: z.enum(['consultation', 'lab', 'prescription', 'general_service', 'hospital_stay', 'manual']).optional(),
  sourceId: z.string().optional(),
});

const invoiceSchema = z.object({
  patientSearch: z.string().optional(),
  selectedPatient: z.object({ id: z.string(), name: z.string() }).optional(),
  invoiceDate: z.date({ required_error: "Invoice date is required" }),
  dueDate: z.date({ required_error: "Due date is required" }),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required."),
  notes: z.string().optional(),
  subTotal: z.number(),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  taxAmount: z.number().optional().default(0),
  totalAmount: z.number(),
});

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;

// --- MAIN COMPONENT SETUP ---
export default function NewInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currency } = useAppearanceSettings();

  // --- CONTEXT CONSUMPTION ---
  const { patients: contextPatients } = usePatients();
  const { fetchLabOrdersForPatient, isLoadingLabOrders } = useLabOrders();
  const {
    fetchPrescriptionsForPatientId,
    isLoadingPrescriptions, medications: pharmacyInventory, addPrescription } = usePharmacy();
  const { createInvoice, isLoadingInvoices } = useInvoices();

  // --- LOCAL STATE (UNCHANGED, WILL BE POPULATED BY FETCH LOGIC) ---
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [searchedPatients, setSearchedPatients] = useState<AugmentedPatient[]>([]);
  // States for patient-specific billable items
  const [patientLabOrders, setPatientLabOrdersState] = useState<LabOrder[]>([]);
  const [patientUnbilledPrescriptions, setPatientUnbilledPrescriptionsState] = useState<Prescription[]>([]);
  const [patientConsultations, setPatientConsultations] = useState<MockConsultation[]>([]); // Using MockConsultation type
  const [patientAdmissions, setPatientAdmissions] = useState<Admission[]>([]);

  // States for general billable services
  const [availableOtherServices, setAvailableOtherServices] = useState<OtherGeneralService[]>([]);
  const [availableWardTariffs, setAvailableWardTariffs] = useState<WardTariff[]>([]);

  // --- REACT HOOK FORM INITIALIZATION (UNCHANGED) ---
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      patientSearch: "",
      selectedPatient: undefined,
      invoiceDate: new Date(),
      dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
      lineItems: [],
      notes: "",
      subTotal: 0,
      taxRate: 0,
      taxAmount: 0,
      totalAmount: 0,
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  // ... (Continued from Part 1)

  const currentSelectedPatientId = form.watch("selectedPatient.id");

  // Refactored: useEffect for fetching billable items (reverted to original mocks/localStorage where no API-backed context exists)
  useEffect(() => {
    // These remain local mocks as they do not have separate API-backed contexts like Patients/Labs/Pharmacy
    setAvailableOtherServices(LOCAL_MOCK_OTHER_GENERAL_SERVICES);
    setAvailableWardTariffs(LOCAL_MOCK_WARD_TARIFFS_FOR_INVOICE);

    if (currentSelectedPatientId) {
      // Fetch Lab Orders (from useLabOrders context - mock API-backed)
      if (!isLoadingLabOrders) {
        fetchLabOrdersForPatient(currentSelectedPatientId).then(orders => {
          setPatientLabOrdersState(orders.filter(order => order.paymentStatus !== "Paid"));
        });
      }
      // Fetch Prescriptions (from usePharmacy context - mock API-backed)
      if (!isLoadingPrescriptions) {
        fetchPrescriptionsForPatientId(currentSelectedPatientId).then(rxs => { // Using fetchPrescriptionsForPatientId
          setPatientUnbilledPrescriptionsState(rxs.filter(rx => rx.paymentStatus !== "Paid"));
        });
      }

      // Consultations (reverted to local mock function as no API context provided)
      setPatientConsultations(getMockConsultationsForPatient(currentSelectedPatientId));

      // Admissions (reverted to localStorage access as no API context provided)
      const allAdmissionsStored = localStorage.getItem(ADMISSIONS_STORAGE_KEY);
      if (allAdmissionsStored) {
        try {
          const allAdmissions: Admission[] = JSON.parse(allAdmissionsStored);
          setPatientAdmissions(allAdmissions.filter(adm => adm.patientId === currentSelectedPatientId));
        } catch (e) {
          console.error("Error loading patient admissions for invoice from localStorage:", e);
          setPatientAdmissions([]);
        }
      } else {
        setPatientAdmissions([]);
      }

    } else {
      // Clear all patient-specific states if no patient is selected
      setPatientLabOrdersState([]);
      setPatientUnbilledPrescriptionsState([]);
      setPatientConsultations([]);
      setPatientAdmissions([]);
    }
  }, [currentSelectedPatientId, fetchLabOrdersForPatient, isLoadingLabOrders, fetchPrescriptionsForPatientId, isLoadingPrescriptions]);

  // useEffect for calculating totals (this remains largely the same)
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      // Only recalculate if lineItems change or taxRate changes
      if (name?.startsWith("lineItems") || name === "taxRate") {
        const items = form.getValues("lineItems") || [];
        const subTotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);

        const currentTaxRateValue = form.getValues("taxRate");
        // Ensure taxRate is treated as a number, defaulting to 0 if not valid
        const numericTaxRate = (typeof currentTaxRateValue === 'number' && !isNaN(currentTaxRateValue))
          ? currentTaxRateValue
          : 0;

        const taxAmount = subTotal * (numericTaxRate / 100);
        const totalAmount = subTotal + taxAmount;

        // Set the calculated values, parsing to float and fixing decimals for financial accuracy
        form.setValue("subTotal", parseFloat(subTotal.toFixed(2)), { shouldValidate: true });
        form.setValue("taxAmount", parseFloat(taxAmount.toFixed(2)), { shouldValidate: true });
        form.setValue("totalAmount", parseFloat(totalAmount.toFixed(2)), { shouldValidate: true });
      }
    });
    // Cleanup function: unsubscribe from form changes when component unmounts
    return () => subscription.unsubscribe();
  }, [form]); // Dependency: 'form' instance (stable)

  // handlePatientSearch (remains mostly the same as contextPatients is already API-backed)
  const handlePatientSearch = (searchTerm: string) => {
    if (searchTerm) {
      setSearchedPatients(
        contextPatients.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) // Use p.name directly
      );
    } else {
      setSearchedPatients([]);
      form.setValue("selectedPatient", undefined);
    }
  };


  // addConsultationToInvoice (uses MockConsultation type and existing CONSULTATION_FEE)
  const addConsultationToInvoice = (consultation: MockConsultation) => {
    append({
      description: `Consultation with ${consultation.doctor} on ${format(parseISO(consultation.date), "PPP")} (${consultation.reason})`,
      quantity: 1,
      unitPrice: consultation.price || CONSULTATION_FEE,
      total: consultation.price || CONSULTATION_FEE,
      sourceType: 'consultation',
      sourceId: consultation.id,
    });
  };

  // addLabOrderToInvoice (uses LabOrder type from context)
  const addLabOrderToInvoice = (labOrder: LabOrder) => {
    labOrder.tests.forEach(test => {
      if (test.price) { // Only add if test has a price
        append({
          description: `Lab Test: ${test.name} (Order: ${labOrder.id})`,
          quantity: 1,
          unitPrice: test.price,
          total: test.price,
          sourceType: 'lab',
          sourceId: labOrder.id,
        });
      }
    });
  };

  // addPrescriptionToInvoice (uses Prescription type from context)
  const addPrescriptionToInvoice = (prescription: Prescription) => {
    // Find medication details from pharmacyInventory (also from context)
    const medicationDetails = pharmacyInventory.find(m => m.name === prescription.medicationName && m.dosage === prescription.dosage);
    const unitPrice = medicationDetails?.pricePerUnit || 0; // Default to 0 if not found
    append({
      description: `Medication: ${prescription.medicationName} ${prescription.dosage} (Rx ID: ${prescription.id})`,
      quantity: prescription.quantity,
      unitPrice: unitPrice,
      total: prescription.quantity * unitPrice,
      sourceType: 'prescription',
      sourceId: prescription.id,
    });
  };

  // addOtherGeneralServiceToInvoice (uses local OtherGeneralService type)
  const addOtherGeneralServiceToInvoice = (service: OtherGeneralService) => {
    append({
      description: service.name,
      quantity: 1,
      unitPrice: service.price,
      total: service.price,
      sourceType: 'general_service',
      sourceId: service.id,
    });
  };

  // addWardStayToInvoice (uses local WardTariff type and Admission type from import)
  const addWardStayToInvoice = (tariff: WardTariff) => {
    let quantity = 1;
    let description = `Hospital Stay: ${tariff.wardName}`;
    const selectedPatient = form.getValues("selectedPatient");

    if (selectedPatient && patientAdmissions.length > 0) {
      // Sort admissions to find the most recent or relevant one
      const sortedAdmissions = [...patientAdmissions].sort((a, b) => parseISO(b.admissionDate).getTime() - parseISO(a.admissionDate).getTime());
      // Find an admission that is either currently active or has a discharge date
      const relevantAdmission = sortedAdmissions.find(adm => adm.status === "Admitted" || adm.status === "Observation" || adm.dischargeDate);

      if (relevantAdmission) {
        const admissionDate = parseISO(relevantAdmission.admissionDate);
        let endDate = new Date(); // Default to today if still admitted (for calculating current stay)
        let dateInfo = ` (Admitted: ${format(admissionDate, "PPP")}`;

        if (relevantAdmission.dischargeDate) {
          endDate = parseISO(relevantAdmission.dischargeDate);
          dateInfo += ` - Discharged: ${format(endDate, "PPP")}`;
        } else {
          dateInfo += ` - Ongoing`; // Indicate ongoing stay
        }
        dateInfo += `)`;
        description += dateInfo;

        // Calculate days of stay; ensure at least 1 day if dates are valid
        const days = differenceInDays(endDate, admissionDate);
        quantity = Math.max(1, days);
      }
    }

    append({
      description: description,
      quantity: quantity,
      unitPrice: tariff.perDiemRate,
      total: quantity * tariff.perDiemRate,
      sourceType: 'hospital_stay',
      sourceId: tariff.id,
    });
  };
  const onSubmit = async (values: InvoiceFormValues) => {
    if (!values.selectedPatient) {
      form.setError("patientSearch", { type: "manual", message: "Please select a patient." });
      return;
    }
    setIsSubmittingForm(true);

    const newInvoiceData: Omit<Invoice, 'id'> = {
      patientId: values.selectedPatient.id,
      patientName: values.selectedPatient.name, // patient.name is available from selectedPatient (AugmentedPatient)
      date: format(values.invoiceDate, "yyyy-MM-dd"), // Ensure date is stored as ISO string
      dueDate: format(values.dueDate, "yyyy-MM-dd"), // Ensure date is stored as ISO string
      lineItems: values.lineItems,
      notes: values.notes,
      subTotal: values.subTotal,
      taxRate: values.taxRate,
      taxAmount: values.taxAmount,
      totalAmount: values.totalAmount,
      amountPaid: 0, // New invoices start with 0 paid
      status: "Pending Payment", // Default status for new invoices
    };

    try {
      const createdInvoice = await createInvoice(newInvoiceData);
      toast({
        title: "Invoice Created",
        description: `Invoice ${createdInvoice.id} for ${createdInvoice.patientName} has been successfully created.`,
      });
      // Reset form fields to default for a fresh start after successful submission
      form.reset({
        patientSearch: "",
        selectedPatient: undefined,
        invoiceDate: new Date(),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 30)), // Default 30 days from now
        lineItems: [],
        notes: "",
        subTotal: 0,
        taxRate: 0,
        taxAmount: 0,
        totalAmount: 0,
      });
      // Clear all state variables related to fetched services
      setSearchedPatients([]);
      setPatientLabOrdersState([]);
      setPatientUnbilledPrescriptionsState([]);
      setPatientConsultations([]);
      setPatientAdmissions([]);
      // Redirect to the main billing page
      router.push("/dashboard/billing");
    } catch (error) {
      console.error("Error creating invoice via context:", error);
      toast({ title: "Invoice Creation Error", description: "Could not create invoice.", variant: "destructive" });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Memoized value for the currently selected patient's name for display in the UI
  // This uses the 'name' property from AugmentedPatient, which is available in form.watch("selectedPatient")
  const currentSelectedPatientName = useMemo(() => {
    const selected = form.watch("selectedPatient");
    return selected ? selected.name : '';
  }, [form.watch("selectedPatient")]); // Re-evaluate when selectedPatient changes


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <PlusCircle className="mr-3 h-8 w-8 text-primary" /> Create New Invoice
          </h1>
          <p className="text-muted-foreground">Generate a new invoice for a patient or service. Current currency: {currency}</p>
        </div>
        <Button variant="outline" onClick={() => router.back()} disabled={isSubmittingForm || isLoadingInvoices}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Billing
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
                          onChange={(e) => {
                            field.onChange(e);
                            handlePatientSearch(e.target.value);
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
                              // p.name from patient-context is already AugmentedPatient.name
                              form.setValue("selectedPatient", { id: p.id, name: p.name });
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="invoiceDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Invoice Date</FormLabel>
                    <DatePicker selected={field.value} onSelect={field.onChange} />
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <DatePicker selected={field.value} onSelect={field.onChange} />
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl">Fetch Billable Services</CardTitle>
              <CardDescription>Select patient services to add to the invoice automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentSelectedPatientId ? (
                <>
                  {patientConsultations.length > 0 && (
                    <div>
                      <h3 className="text-md font-semibold mb-2 flex items-center"><FileText className="mr-2 h-5 w-5 text-blue-500" />Recent Consultations</h3>
                      <ul className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
                        {patientConsultations.map(c => (
                          <li key={c.id} className="text-xs flex justify-between items-center p-1 hover:bg-muted/50 rounded">
                            <span>{c.reason} with {c.doctor} on {c.date}</span> {/* Original mock consultation properties */}
                            <Button type="button" size="xs" variant="outline" onClick={() => addConsultationToInvoice(c)}>Add</Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {patientLabOrders.length > 0 && (
                    <div>
                      <h3 className="text-md font-semibold mb-2 flex items-center"><Microscope className="mr-2 h-5 w-5 text-green-500" />Unpaid Lab Orders</h3>
                      <ul className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
                        {patientLabOrders.map(order => (
                          <li key={order.id} className="text-xs flex justify-between items-center p-1 hover:bg-muted/50 rounded">
                            <span>Order {order.id} ({order.tests.map(t => t.name).join(', ')})</span>
                            <Button type="button" size="xs" variant="outline" onClick={() => addLabOrderToInvoice(order)}>Add All Tests</Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {patientUnbilledPrescriptions.length > 0 && (
                    <div>
                      <h3 className="text-md font-semibold mb-2 flex items-center"><PillIcon className="mr-2 h-5 w-5 text-purple-500" />Unpaid Prescriptions</h3>
                      <ul className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
                        {patientUnbilledPrescriptions.map(rx => (
                          <li key={rx.id} className="text-xs flex justify-between items-center p-1 hover:bg-muted/50 rounded">
                            <span>{rx.medicationName} {rx.dosage} (Qty: {rx.quantity})</span>
                            <Button type="button" size="xs" variant="outline" onClick={() => addPrescriptionToInvoice(rx)}>Add</Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(patientConsultations.length === 0 && patientLabOrders.length === 0 && patientUnbilledPrescriptions.length === 0 && currentSelectedPatientId) && (
                    <p className="text-sm text-muted-foreground">No recent unpaid services found for the selected patient.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a patient to fetch their billable services or add billable items manually from the sections below.</p>
              )}

              <Separator className="my-6" />

              <div>
                <h3 className="text-md font-semibold mb-2 flex items-center"><BedDoubleIcon className="mr-2 h-5 w-5 text-teal-500" />Billable Hospital Stays / Per Diem</h3>
                {availableWardTariffs.length > 0 ? (
                  <ul className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
                    {availableWardTariffs.map(tariff => (
                      <li key={tariff.id} className="text-xs flex justify-between items-center p-1 hover:bg-muted/50 rounded">
                        <span>{tariff.wardName} - {formatCurrency(tariff.perDiemRate, currency)} / day</span>
                        <Button type="button" size="xs" variant="outline" onClick={() => addWardStayToInvoice(tariff)}>Add</Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No Ward/Room Tariffs configured. Please set them up in Admin &gt; Service Pricing.</p>
                )}
              </div>

              <Separator className="my-6" />

              <div>
                <h3 className="text-md font-semibold mb-2 flex items-center"><Library className="mr-2 h-5 w-5 text-indigo-500" />Other General Services</h3>
                {availableOtherServices.length > 0 ? (
                  <ul className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
                    {availableOtherServices.map(service => (
                      <li key={service.id} className="text-xs flex justify-between items-center p-1 hover:bg-muted/50 rounded">
                        <span>{service.name} - {formatCurrency(service.price, currency)}</span>
                        <Button type="button" size="xs" variant="outline" onClick={() => addOtherGeneralServiceToInvoice(service)}>Add</Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No other general services configured. Please set them up in Admin &gt; Service Pricing.</p>
                )}
              </div>
            </CardContent>
          </Card>


          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl">Invoice Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              {fields.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-x-4 gap-y-2 items-end mb-4 p-3 border rounded-md">
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.description`}
                    render={({ field }) => (
                      <FormItem className="col-span-12 md:col-span-5">
                        {index === 0 && <FormLabel>Description</FormLabel>}
                        <FormControl><Input placeholder="Service or item description" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="col-span-4 md:col-span-2">
                        {index === 0 && <FormLabel>Quantity</FormLabel>}
                        <FormControl><Input type="number" placeholder="1" {...field} onChange={e => { field.onChange(e); update(index, { ...form.getValues(`lineItems.${index}`), quantity: Number(e.target.value), total: Number(e.target.value) * form.getValues(`lineItems.${index}.unitPrice`) }) }} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.unitPrice`}
                    render={({ field }) => (
                      <FormItem className="col-span-4 md:col-span-2">
                        {index === 0 && <FormLabel>Unit Price ({currency})</FormLabel>}
                        <FormControl><Input type="number" placeholder="0.00" {...field} step="0.01" onChange={e => { field.onChange(e); update(index, { ...form.getValues(`lineItems.${index}`), unitPrice: Number(e.target.value), total: Number(e.target.value) * form.getValues(`lineItems.${index}.quantity`) }) }} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.total`}
                    render={({ field }) => (
                      <FormItem className="col-span-4 md:col-span-2">
                        {index === 0 && <FormLabel>Total ({currency})</FormLabel>}
                        <FormControl><Input type="number" placeholder="0.00" {...field} readOnly className="bg-muted/50" /></FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="col-span-12 md:col-span-1 flex justify-end">
                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} className={index === 0 ? 'mt-6' : ''}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => append({ description: "", quantity: 1, unitPrice: 0, total: 0, sourceType: 'manual' })}>
                Add Line Item Manually
              </Button>
              {/* Display form errors related to lineItems array */}
              <FormMessage>{form.formState.errors.lineItems?.message || form.formState.errors.lineItems?.root?.message}</FormMessage>
            </CardContent>
            <CardFooter className="flex flex-col items-end space-y-2 pt-6">
              <div className="w-full max-w-xs grid grid-cols-2 gap-2 items-center">
                <FormLabel className="text-right">Subtotal:</FormLabel>
                <Input type="text" readOnly value={formatCurrency(form.getValues("subTotal") || 0, currency)} className="bg-muted/50 font-semibold text-right" />
              </div>
              <div className="w-full max-w-xs grid grid-cols-2 gap-2 items-center">
                <FormField control={form.control} name="taxRate" render={({ field }) => (
                  <FormItem className="flex items-center justify-end col-span-1">
                    <FormLabel htmlFor={field.name} className="text-right mr-2">Tax Rate (%):</FormLabel>
                    <FormControl>
                      <Input id={field.name} type="number" {...field} value={field.value ?? ''} className="w-20 text-right" step="0.1" />
                    </FormControl>
                  </FormItem>
                )} />
                <Input type="text" readOnly value={formatCurrency(form.getValues("taxAmount") || 0, currency)} className="bg-muted/50 text-right" />
              </div>
              <div className="w-full max-w-xs grid grid-cols-2 gap-2 items-center">
                <FormLabel className="text-right font-bold text-lg">Total Amount:</FormLabel>
                <Input type="text" readOnly value={formatCurrency(form.getValues("totalAmount") || 0, currency)} className="bg-muted/50 font-bold text-lg text-right" />
              </div>
            </CardFooter>
          </Card>

          <Card className="shadow-lg">
            <CardHeader><CardTitle className="font-headline">Notes</CardTitle></CardHeader>
            <CardContent>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormControl><Textarea placeholder="Optional notes for the invoice..." {...field} rows={3} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end pt-6">
            <Button type="submit" disabled={isSubmittingForm || isLoadingInvoices} size="lg">
              {(isSubmittingForm || isLoadingInvoices) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Manual Invoice
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}






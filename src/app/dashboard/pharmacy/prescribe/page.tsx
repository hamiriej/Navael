"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pill, Search, UserCircle, FileSignature, PackagePlus, AlertTriangle, Trash2, Info, DollarSign, ArrowLeft, RefreshCcw } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Separator } from "@/components/ui/separator";
import { usePatients, type Patient, type AugmentedPatient } from "@/contexts/patient-context";import { type Medication, type Prescription } from "../page";
import { type Invoice } from "../../billing/page";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { logActivity } from "@/lib/activityLog";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { formatCurrency } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { usePharmacy } from "@/contexts/pharmacy-context";
import { useInvoices } from "@/contexts/invoice-context";

const prescribedItemSchema = z.object({
  medicationId: z.string().min(1, "Medication must be selected"),
  medicationName: z.string(),
  dosage: z.string(),
  currentStock: z.number().optional(),
  stockStatus: z.string().optional(),
  pricePerUnit: z.number().optional(),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  instructions: z.string().max(500).optional(),
  isRefillable: z.boolean().optional().default(false),
  refillsRemaining: z.coerce.number().optional(),
});

const prescribeMedicationSchema = z.object({
  patientSearch: z.string().optional(),
  selectedPatient: z.object({ id: z.string(), name: z.string() }).optional(),
  prescribingDoctor: z.string().min(1, "Prescribing doctor's name is required"),
  prescribedItems: z.array(prescribedItemSchema).min(1, "At least one medication must be added to the prescription list."),
  currentMedicationSelection: z.string().optional(),
  currentQuantity: z.coerce.number().optional(),
  currentInstructions: z.string().optional(),
  currentRefillable: z.boolean().optional().default(false),
  currentRefillsRemaining: z.coerce.number().optional(),
  // Fields that were assumed to be on the form but not in schema, potentially for pre-filling from patient context
  pastMedicalHistory: z.string().optional(), // Added for clarity if it was being set
  allergies: z.string().optional(), // Added for clarity if it was being set
});

type PrescribeMedicationFormValues = z.infer<typeof prescribeMedicationSchema>;

export default function PrescribeMedicationPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { username: loggedInDoctorName, userRole: actorRole, username: actorName } = useAuth();
  const { currency } = useAppearanceSettings();
  const { getPatientById, isLoading: isLoadingPatients } = usePatients();
  const {
    medications: availableInventory,
    isLoadingMedications,
    addPrescription
  } = usePharmacy();
  const { createInvoice, isLoadingInvoices } = useInvoices();

  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [lockedPatientState, setLockedPatientState] = useState<AugmentedPatient | null>(null);  const [medicationSearchTerm, setMedicationSearchTerm] = useState("");
  const [selectedMedicationForConfig, setSelectedMedicationForConfig] = useState<Medication | null>(null);

  const patientIdFromQuery = searchParams.get("patientId");

  const form = useForm<PrescribeMedicationFormValues>({
    resolver: zodResolver(prescribeMedicationSchema),
    defaultValues: {
      prescribingDoctor: loggedInDoctorName || "",
      prescribedItems: [],
      currentQuantity: 1,
      currentInstructions: "",
      currentRefillable: false,
      currentRefillsRemaining: 0,
      pastMedicalHistory: "", // Initialize
      allergies: "",         // Initialize
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "prescribedItems"
  });

  // Effect to fetch patient data and set it to `lockedPatientState`
  useEffect(() => {
    let isActive = true;
    if (!patientIdFromQuery) {
      if (lockedPatientState) { // If there was a locked patient, and now no query ID, clear it
          setLockedPatientState(null);
      }
      return;
    }

    if (isLoadingPatients) return;

    // Only refetch if the current lockedPatientState is different from patientIdFromQuery
    if (lockedPatientState && lockedPatientState.id === patientIdFromQuery) {
      return;
    }

    const fetchAndSetPatient = async () => {
      try {
        const foundPatient = await getPatientById(patientIdFromQuery);
        if (isActive) {
          if (foundPatient) {
            setLockedPatientState(foundPatient);
          } else {
            toast({ title: "Patient Not Found", description: `Could not find patient with ID: ${patientIdFromQuery}.`, variant: "destructive" });
            setLockedPatientState(null);
          }
        }
      } catch (error) {
        if (isActive) {
          toast({ title: "Error Loading Patient", description: "Could not load patient details.", variant: "destructive" });
          setLockedPatientState(null);
        }
      }
    };

    fetchAndSetPatient();

    return () => { isActive = false; };
  }, [patientIdFromQuery, isLoadingPatients, getPatientById, toast, lockedPatientState]); // Added lockedPatientState as it's read

  // Effect to populate form when `lockedPatientState` or `loggedInDoctorName` changes
  useEffect(() => {
    if (lockedPatientState) {
      // Only set values if they are different from current form values to prevent unnecessary re-renders/loops
      if (form.getValues("selectedPatient")?.id !== lockedPatientState.id) {
        form.setValue("selectedPatient", { id: lockedPatientState.id, name: lockedPatientState.name }, { shouldValidate: true });
      }
      if (form.getValues("patientSearch") !== lockedPatientState.name) {
        form.setValue("patientSearch", lockedPatientState.name, { shouldValidate: true });
      }
      if (form.getValues("prescribingDoctor") !== (loggedInDoctorName || "")) {
        form.setValue("prescribingDoctor", loggedInDoctorName || "", { shouldValidate: true });
      }
      if (form.getValues("pastMedicalHistory") !== (lockedPatientState.medicalHistoryNotes || "")) {
         form.setValue("pastMedicalHistory", lockedPatientState.medicalHistoryNotes || "", { shouldValidate: true });
      }
      if (form.getValues("allergies") !== (lockedPatientState.allergies?.join(', ') || "")) {
        form.setValue("allergies", lockedPatientState.allergies?.join(', ') || "", { shouldValidate: true });
      }
      // Clear prescribedItems only if the patient ID truly changes.
      if (form.getValues("selectedPatient")?.id !== lockedPatientState.id && fields.length > 0) {
          form.setValue("prescribedItems", []);
      }
      form.clearErrors("patientSearch");
    } else if (!patientIdFromQuery) { // If no patientIdFromQuery, and lockedPatientState became null
      const currentSearch = form.getValues("patientSearch");
      const currentSelected = form.getValues("selectedPatient");
      if(currentSearch || currentSelected) { // Only reset if there was a patient before
        form.reset({
            prescribingDoctor: loggedInDoctorName || "",
            patientSearch: "",
            selectedPatient: undefined,
            prescribedItems: [],
            currentMedicationSelection: undefined,
            currentQuantity: 1,
            currentInstructions: "",
            currentRefillable: false,
            currentRefillsRemaining: 0,
            pastMedicalHistory: "",
            allergies: "",
        });
      }
    }
  }, [lockedPatientState, loggedInDoctorName, form, patientIdFromQuery, fields.length]); // Added fields.length


  const filteredInventory = useMemo(() => {
    if (isLoadingMedications) return [];
    if (!medicationSearchTerm) return availableInventory;
    return availableInventory.filter(med =>
      med.name.toLowerCase().includes(medicationSearchTerm.toLowerCase()) ||
      med.category.toLowerCase().includes(medicationSearchTerm.toLowerCase())
    );
  }, [availableInventory, medicationSearchTerm, isLoadingMedications]);

  const handleMedicationSelectionForConfig = useCallback((medicationId: string | undefined) => {
    if (medicationId) {
      const med = availableInventory.find(m => m.id === medicationId);
      setSelectedMedicationForConfig(med || null);
    } else {
      setSelectedMedicationForConfig(null);
    }
  }, [availableInventory]);


  const handleAddMedicationToPrescription = () => {
    const medId = form.getValues("currentMedicationSelection");
    const quantity = form.getValues("currentQuantity");
    const instructions = form.getValues("currentInstructions");
    const isRefillable = form.getValues("currentRefillable");
    const refillsRemaining = form.getValues("currentRefillsRemaining");

    if (!medId) {
      toast({ title: "No Medication Selected", description: "Please select a medication from the list.", variant: "destructive" });
      return;
    }
    if (!quantity || quantity < 1) {
      form.setError("currentQuantity", {type: "manual", message: "Quantity must be at least 1."});
      return;
    }

    const medicationDetails = availableInventory.find(m => m.id === medId);
    if (!medicationDetails) {
      toast({ title: "Error", description: "Selected medication details not found.", variant: "destructive" });
      return;
    }

    append({
      medicationId: medicationDetails.id,
      medicationName: medicationDetails.name,
      dosage: medicationDetails.dosage,
      currentStock: medicationDetails.stock,
      stockStatus: medicationDetails.status,
      pricePerUnit: medicationDetails.pricePerUnit,
      quantity: quantity,
      instructions: instructions || "",
      isRefillable: isRefillable,
      refillsRemaining: isRefillable ? (refillsRemaining || 0) : undefined,
    });

    if (medicationDetails.status === "Out of Stock") {
        toast({ title: "Out of Stock Alert", description: `${medicationDetails.name} is currently out of stock. Pharmacy will be notified.`, variant: "destructive", duration: 7000});
    } else if (medicationDetails.status === "Low Stock" && quantity > medicationDetails.stock) {
         toast({ title: "Low Stock Warning", description: `Order for ${medicationDetails.name} (Qty: ${quantity}) exceeds current stock (${medicationDetails.stock}). Pharmacy will be notified.`, variant: "destructive", duration: 7000});
    }

    form.setValue("currentMedicationSelection", undefined);
    setSelectedMedicationForConfig(null);
    form.setValue("currentQuantity", 1);
    form.setValue("currentInstructions", "");
    form.setValue("currentRefillable", false);
    form.setValue("currentRefillsRemaining", 0);
    setMedicationSearchTerm("");
  };

  const onSubmit = async (values: PrescribeMedicationFormValues) => {
    const patientToPrescribeFor = lockedPatientState || values.selectedPatient;

    if (!patientToPrescribeFor) {
        form.setError("patientSearch", { type: "manual", message: "Please select a patient if not pre-selected." });
        toast({ title: "Patient Required", description: "Please select a patient.", variant: "destructive"});
        return;
    }
    if (!values.prescribedItems || values.prescribedItems.length === 0) {
        toast({ title: "No Medications Added", description: "Please add at least one medication to the prescription list.", variant: "destructive"});
        return;
    }

    setIsSubmittingForm(true);

    let totalInvoiceAmount = 0;
    const invoiceLineItems = values.prescribedItems.map(item => {
        const itemTotal = item.quantity * (item.pricePerUnit || 0);
        totalInvoiceAmount += itemTotal;
        return {
            description: `Med: ${item.medicationName} (${item.dosage}) Qty: ${item.quantity}`,
            quantity: item.quantity,
            unitPrice: item.pricePerUnit || 0,
            total: itemTotal,
            sourceType: 'prescription' as 'prescription',
            sourceId: item.medicationId,
        };
    });

    let invoiceId: string | undefined;
    if (totalInvoiceAmount > 0) {
      const invoiceToCreate: Omit<Invoice, 'id'> = {
          patientId: patientToPrescribeFor.id,
          patientName: patientToPrescribeFor.name,
          date: format(new Date(), "yyyy-MM-dd"),
          dueDate: format(new Date(new Date().setDate(new Date().getDate() + 7)), "yyyy-MM-dd"),
          lineItems: invoiceLineItems,
          subTotal: totalInvoiceAmount,
          totalAmount: totalInvoiceAmount,
          amountPaid: 0,
          status: "Pending Payment",
      };
      try {
        const createdInv = await createInvoice(invoiceToCreate);
        invoiceId = createdInv.id;
        toast({
            title: "Invoice Generated for Medications",
            description: `Invoice ${invoiceId} (${formatCurrency(totalInvoiceAmount, currency)}) created. Payment pending.`,
            duration: 7000,
        });
      } catch (error) {
        console.error("Error creating invoice for prescription via context:", error);
        toast({ title: "Invoice Error", description: "Could not generate invoice for the prescription(s).", variant: "destructive"});
        setIsSubmittingForm(false);
        return;
      }
    }

    let allPrescriptionsCreatedSuccessfully = true;
    let createdPrescriptionsCount = 0;

    for (const item of values.prescribedItems) {
      const prescriptionData: Omit<Prescription, 'id'> = {
          patientId: patientToPrescribeFor.id,
          patientName: patientToPrescribeFor.name,
          medicationName: item.medicationName,
          dosage: item.dosage,
          quantity: item.quantity,
          instructions: item.instructions,
          prescribedBy: values.prescribingDoctor,
          date: new Date().toISOString(),
          status: "Pending",
          isBilled: totalInvoiceAmount > 0,
          invoiceId: invoiceId,
          paymentStatus: totalInvoiceAmount > 0 ? "Pending Payment" : "N/A",
          refillable: item.isRefillable || false,
          refillsRemaining: item.isRefillable ? (item.refillsRemaining || 0) : undefined,
      };
      try {
        await addPrescription(prescriptionData);
        createdPrescriptionsCount++;
      } catch (error) {
        allPrescriptionsCreatedSuccessfully = false;
        console.error("Failed to create prescription for item:", item.medicationName, error);
        toast({ title: "Prescription Error", description: `Could not save prescription for ${item.medicationName}.`, variant: "destructive"});
        break;
      }
    }

    if (allPrescriptionsCreatedSuccessfully && createdPrescriptionsCount > 0) {
        logActivity({
          actorRole: actorRole || "System",
          actorName: actorName || "System",
          actionDescription: `Prescribed ${createdPrescriptionsCount} medication(s) for ${patientToPrescribeFor.name}`,
          targetEntityType: "Prescription",
          targetEntityId: patientToPrescribeFor.id,
          targetLink: `/dashboard/patients/${patientToPrescribeFor.id}`,
          iconName: "Pill",
          details: values.prescribedItems.map(p => `${p.medicationName} ${p.dosage} (Qty: ${p.quantity})`).join('; '),
        });
        toast({ title: "Prescription(s) Submitted", description: `${createdPrescriptionsCount} medication(s) prescribed for ${patientToPrescribeFor.name}.`});
        form.reset({
            prescribingDoctor: loggedInDoctorName || "",
            patientSearch: lockedPatientState ? lockedPatientState.name : "",
            selectedPatient: lockedPatientState ? {id: lockedPatientState.id, name: lockedPatientState.name} : undefined,
            prescribedItems: [],
            currentMedicationSelection: undefined,
            currentQuantity: 1,
            currentInstructions: "",
            currentRefillable: false,
            currentRefillsRemaining: 0,
            pastMedicalHistory: lockedPatientState?.medicalHistoryNotes || "",
            allergies: lockedPatientState?.allergies?.join(", ") || "",
        });
        setSelectedMedicationForConfig(null);
        setMedicationSearchTerm("");
        router.push(`/dashboard/patients/${patientToPrescribeFor.id}?action=med_prescribed`);
    } else if (!allPrescriptionsCreatedSuccessfully) {
         toast({ title: "Partial Submission Error", description: "Some prescriptions may not have been saved. Please review.", variant: "destructive"});
    }

    setIsSubmittingForm(false);
  };

  const isRefillableChecked = form.watch("currentRefillable");

  if ((isLoadingPatients && patientIdFromQuery) || isLoadingMedications) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const currentPatientForDisplay = lockedPatientState || form.getValues("selectedPatient");

  return (
    <div className="space-y-6">
        <Button variant="outline" onClick={() => router.back()} className="mb-2" disabled={isSubmittingForm || isLoadingInvoices}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card className="max-w-3xl mx-auto shadow-lg">
        <CardHeader>
            <div className="flex items-center space-x-3">
            <FileSignature className="h-7 w-7 text-primary" />
            <CardTitle className="font-headline text-2xl">
                {currentPatientForDisplay ? `New Prescription for ${currentPatientForDisplay.name}` : "Prescribe Medication"}
            </CardTitle>
            </div>
            <CardDescription>
            {currentPatientForDisplay ? `Creating prescription for patient ID: ${currentPatientForDisplay.id}` : "Select patient, search for medications, and add them to the prescription list."}
            An invoice will be automatically generated for all prescribed medications (in {currency}).
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {currentPatientForDisplay && ( // This ensures the whole block renders only if currentPatientForDisplay is truthy
                <div className="p-3 border rounded-md bg-muted/50">
                <p className="text-sm font-medium text-foreground">Patient: {currentPatientForDisplay.name}</p>
                {/* ONLY use lockedPatientState for age/gender, as it's guaranteed AugmentedPatient */}
                {lockedPatientState && (
                <p className="text-xs text-muted-foreground">ID: {lockedPatientState.id} &bull; Age: {lockedPatientState.age} &bull; Gender: {lockedPatientState.gender}</p>
               )}
              {!lockedPatientState && currentPatientForDisplay && (
            <p className="text-xs text-muted-foreground">ID: {currentPatientForDisplay.id} &bull; Age: N/A &bull; Gender: N/A</p> // Fallback if only form data exists
            )}
           </div>
             )}
                {!currentPatientForDisplay && (
                <FormField
                    control={form.control}
                    name="patientSearch"
                    disabled
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><UserCircle className="mr-2 h-4 w-4"/>Search Patient (Currently Disabled)</FormLabel>
                        <Input placeholder="Navigate from Patient Profile to prescribe" {...field} disabled />
                        <FormDescription>To prescribe, please navigate from the patient's detail page. This field is auto-filled.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                )}

                <Separator />

                <div className="space-y-4 p-4 border rounded-md shadow-sm">
                    <h3 className="text-lg font-semibold font-headline text-primary flex items-center"><Pill className="mr-2 h-5 w-5"/>Add Medication to Prescription</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <FormItem>
                            <FormLabel>Search Medication from Inventory</FormLabel>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or category..."
                                    value={medicationSearchTerm}
                                    onChange={(e) => setMedicationSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </FormItem>
                        <FormField
                            control={form.control}
                            name="currentMedicationSelection"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Select Medication</FormLabel>
                                <Select
                                  onValueChange={(value) => {
                                    field.onChange(value);
                                    handleMedicationSelectionForConfig(value);
                                  }}
                                  value={field.value}
                                >
                                <FormControl><SelectTrigger><SelectValue placeholder="Choose a medication" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {filteredInventory.length > 0 ? filteredInventory.map(med => (
                                    <SelectItem key={med.id} value={med.id}>
                                        {med.name} ({med.dosage}) - Stock: {med.stock} ({med.status})
                                    </SelectItem>
                                    )) : <SelectItem value="no-match" disabled>No medications match search.</SelectItem>}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>

                    {selectedMedicationForConfig && (
                        <Card className="p-3 bg-muted/30">
                            <p className="text-sm font-medium">{selectedMedicationForConfig.name} ({selectedMedicationForConfig.dosage})</p>
                            <p className={`text-xs ${selectedMedicationForConfig.status === 'Out of Stock' ? 'text-destructive' : selectedMedicationForConfig.status === 'Low Stock' ? 'text-orange-600' : 'text-green-600'}`}>
                                Status: {selectedMedicationForConfig.status} (Current Stock: {selectedMedicationForConfig.stock}, Price/Unit: {formatCurrency(selectedMedicationForConfig.pricePerUnit, currency)})
                            </p>
                        </Card>
                    )}

                    <FormField control={form.control} name="currentQuantity" render={({ field }) => (
                        <FormItem> <FormLabel>Quantity</FormLabel> <FormControl><Input type="number" placeholder="e.g., 30" {...field} /></FormControl> <FormMessage /> </FormItem>
                    )} />

                    <FormField control={form.control} name="currentInstructions" render={({ field }) => (
                        <FormItem> <FormLabel>Instructions (Sig)</FormLabel> <FormControl><Textarea placeholder="e.g., Take one tablet by mouth twice daily." {...field} rows={2} /></FormControl> <FormMessage /> </FormItem>
                    )} />

                    <FormField
                        control={form.control}
                        name="currentRefillable"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="currentRefillable" />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel htmlFor="currentRefillable" className="cursor-pointer">
                                        Allow Refills for this Medication?
                                    </FormLabel>
                                </div>
                            </FormItem>
                        )}
                    />
                    {isRefillableChecked && (
                        <FormField
                            control={form.control}
                            name="currentRefillsRemaining"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center"><RefreshCcw className="mr-2 h-4 w-4"/>Number of Refills Allowed</FormLabel>
                                    <FormControl><Input type="number" placeholder="e.g., 2 (0 for none specified)" {...field} min={0} /></FormControl>
                                    <FormDescription>Enter 0 if no specific limit, or the exact number of refills.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    <Button type="button" variant="outline" onClick={handleAddMedicationToPrescription} disabled={!selectedMedicationForConfig}>
                        <PackagePlus className="mr-2 h-4 w-4"/>Add Drug to Prescription List
                    </Button>
                </div>

                <Separator />

                <div>
                    <h3 className="text-lg font-semibold font-headline text-primary mb-3">Current Prescription List ({fields.length} item(s))</h3>
                    {fields.length === 0 && <p className="text-sm text-muted-foreground">No medications added yet. Use the section above to add drugs.</p>}
                    <div className="space-y-3">
                        {fields.map((item, index) => (
                            <Card key={item.id} className="p-4 relative shadow">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-md">{item.medicationName} <span className="text-sm text-muted-foreground">({item.dosage})</span></p>
                                        <p className="text-sm">Quantity: {item.quantity} @ {formatCurrency(item.pricePerUnit || 0, currency)}/unit</p>
                                        {item.instructions && <p className="text-xs text-muted-foreground mt-1">Instructions: {item.instructions}</p>}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Refillable: {item.isRefillable ? `Yes (${item.refillsRemaining ?? 'Unlimited'} remaining)` : 'No'}
                                        </p>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="absolute top-2 right-2 text-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                                {(item.stockStatus === "Out of Stock" || (item.stockStatus === "Low Stock" && item.currentStock !== undefined && item.quantity > item.currentStock)) && (
                                    <Badge variant={item.stockStatus === "Out of Stock" ? "destructive" : "secondary"} className="mt-2 text-xs">
                                        <AlertTriangle className="h-3 w-3 mr-1"/> Stock Alert: {item.stockStatus} (Avail: {item.currentStock ?? 'N/A'}, Req: {item.quantity})
                                    </Badge>
                                )}
                            </Card>
                        ))}
                        <FormMessage>{form.formState.errors.prescribedItems?.message || form.formState.errors.prescribedItems?.root?.message}</FormMessage>
                    </div>
                </div>

                <FormField control={form.control} name="prescribingDoctor" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Prescribing Doctor</FormLabel>
                        <FormControl><Input {...field} disabled={!!loggedInDoctorName} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <div className="flex justify-end pt-6">
                <Button type="submit" disabled={isSubmittingForm || fields.length === 0 || isLoadingInvoices}>
                    {(isSubmittingForm || isLoadingInvoices) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit All Prescriptions
                </Button>
                </div>
            </form>
            </Form>
        </CardContent>
        </Card>
    </div>
  );
}

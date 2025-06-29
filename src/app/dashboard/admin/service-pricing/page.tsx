
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowLeft, DollarSign, Save, Settings, PlusCircle, Trash2, BedDouble } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { type Medication } from "../../pharmacy/page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { formatCurrency } from "@/lib/utils";
import { usePharmacy } from "@/contexts/pharmacy-context";

// Define the storage key locally for this page's API interaction if needed, though API routes manage their own keys.
export const LAB_TEST_PRICES_STORAGE_KEY_CLIENT_REF = 'navael_lab_test_prices'; // Reference, API will use its own

const API_BASE_URL = '/api/admin/pricing';

// --- Zod Schemas (can be shared or duplicated on API side if necessary) ---
const generalFeesSchema = z.object({
  consultationFee: z.coerce.number().min(0, "Fee cannot be negative"),
  checkupFee: z.coerce.number().min(0, "Fee cannot be negative"),
});
type GeneralFeesFormValues = z.infer<typeof generalFeesSchema>;

export interface EditableLabTest {
  id: string;
  name: string;
  price: number;
}

export interface OtherGeneralService {
  id: string;
  name: string;
  price: number;
}

export interface WardTariff {
  id: string;
  wardName: string; // Note: In a real system, this might be a wardId referencing a Ward entity
  perDiemRate: number;
}

interface EditableMedication extends Medication {} // Assuming Medication type is imported

const newLabTestSchema = z.object({
  name: z.string().min(1, "Test name is required"),
  price: z.coerce.number().min(0.01, "Price must be positive"),
});
type NewLabTestFormValues = z.infer<typeof newLabTestSchema>;

const newGeneralServiceSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  price: z.coerce.number().min(0.01, "Price must be positive"),
});
type NewGeneralServiceFormValues = z.infer<typeof newGeneralServiceSchema>;

const newWardTariffSchema = z.object({
    wardName: z.string().min(1, "Ward/Room Type name is required"),
    perDiemRate: z.coerce.number().min(0.01, "Per diem rate must be positive"),
});
type NewWardTariffFormValues = z.infer<typeof newWardTariffSchema>;

// --- API Service Functions ---
async function handlePricingApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `API Error: ${response.status} ${response.statusText}` }));
    console.error("API Error Response:", errorData);
    throw new Error(errorData.message || `API Error: ${response.status}`);
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

async function fetchPricingDataApi<T>(type: 'general-fees' | 'lab-tests' | 'other-services' | 'ward-tariffs'): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/${type}`);
  return handlePricingApiResponse<T>(response);
}

async function updatePricingDataApi<T>(type: 'general-fees' | 'lab-tests' | 'other-services' | 'ward-tariffs', data: T): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/${type}`, {
    method: 'POST', // or PUT, depending on backend API design for full updates
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handlePricingApiResponse<T>(response);
}

async function addPricingItemApi<T extends { id: string }>(type: 'lab-tests' | 'other-services' | 'ward-tariffs', item: Omit<T, 'id'>): Promise<T> {
    const response = await fetch(`${API_BASE_URL}/${type}/items`, { // Assumes a sub-route for adding items
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
    });
    return handlePricingApiResponse<T>(response);
}

async function deletePricingItemApi(type: 'lab-tests' | 'other-services' | 'ward-tariffs', itemId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/${type}/items/${itemId}`, { method: 'DELETE' });
    await handlePricingApiResponse<null>(response);
}


export default function ServicePricingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currency } = useAppearanceSettings();
  const { medications: pharmacyMedications, isLoadingMedications, updateMedicationInInventory } = usePharmacy();

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingFees, setIsSavingFees] = useState(false);
  const [isSavingLabPrices, setIsSavingLabPrices] = useState(false);
  const [isSavingMedPrices, setIsSavingMedPrices] = useState(false);
  const [isSavingOtherServices, setIsSavingOtherServices] = useState(false);
  const [isSavingWardTariffs, setIsSavingWardTariffs] = useState(false);

  const [editableLabTests, setEditableLabTests] = useState<EditableLabTest[]>([]);
  const [editableMedications, setEditableMedications] = useState<EditableMedication[]>([]);
  const [otherGeneralServices, setOtherGeneralServices] = useState<OtherGeneralService[]>([]);
  const [wardTariffs, setWardTariffs] = useState<WardTariff[]>([]);

  const [showNewLabTestDialog, setShowNewLabTestDialog] = useState(false);
  const [showNewGeneralServiceDialog, setShowNewGeneralServiceDialog] = useState(false);
  const [showNewWardTariffDialog, setShowNewWardTariffDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, name: string, type: 'lab' | 'service' | 'ward_tariff'} | null>(null);

  const feesForm = useForm<GeneralFeesFormValues>(); // Default values set in loadAllPricingData
  const newLabTestForm = useForm<NewLabTestFormValues>({ resolver: zodResolver(newLabTestSchema), defaultValues: { name: "", price: 0 }});
  const newGeneralServiceForm = useForm<NewGeneralServiceFormValues>({ resolver: zodResolver(newGeneralServiceSchema), defaultValues: { name: "", price: 0 }});
  const newWardTariffForm = useForm<NewWardTariffFormValues>({ resolver: zodResolver(newWardTariffSchema), defaultValues: { wardName: "", perDiemRate: 0 }});

  const loadAllPricingData = useCallback(async () => {
    setIsLoading(true);
    try {
        const [feesData, labTestsData, otherServData, tariffsData] = await Promise.all([
            fetchPricingDataApi<GeneralFeesFormValues>('general-fees'),
            fetchPricingDataApi<EditableLabTest[]>('lab-tests'),
            fetchPricingDataApi<OtherGeneralService[]>('other-services'),
            fetchPricingDataApi<WardTariff[]>('ward-tariffs'),
        ]);
        feesForm.reset(feesData);
        setEditableLabTests(labTestsData);
        setOtherGeneralServices(otherServData);
        setWardTariffs(tariffsData);
    } catch (e: any) {
        console.error("Error loading service pricing data:", e);
        toast({title: "Error", description: e.message || "Could not load pricing data.", variant: "destructive"});
        feesForm.reset({ consultationFee: 75, checkupFee: 50}); // Fallback defaults
        setEditableLabTests([]);
        setOtherGeneralServices([]);
        setWardTariffs([]);
    }
    setIsLoading(false);
  }, [feesForm, toast]);

  useEffect(() => { loadAllPricingData(); }, [loadAllPricingData]);
  useEffect(() => { setEditableMedications(pharmacyMedications as EditableMedication[]); }, [pharmacyMedications]);


  const onSaveGeneralFees = async (values: GeneralFeesFormValues) => {
    setIsSavingFees(true);
    try {
      await updatePricingDataApi('general-fees', values);
      toast({ title: "Success", description: "General service fees updated." });
    } catch (e: any) { toast({title: "Error", description: e.message || "Could not save general fees.", variant: "destructive"});}
    setIsSavingFees(false);
  };

  const handleLabPriceChange = (id: string, newPrice: string) => {
    setEditableLabTests(prev => prev.map(test => (test.id === id ? { ...test, price: parseFloat(newPrice) || 0 } : test)));
  };
  const onSaveLabTestPrices = async () => {
    setIsSavingLabPrices(true);
    try {
        await updatePricingDataApi('lab-tests', editableLabTests);
        toast({ title: "Success", description: "Lab test prices updated." });
    } catch (e: any) { toast({title: "Error", description: e.message || "Could not save lab test prices.", variant: "destructive"});}
    setIsSavingLabPrices(false);
  };

  const onAddNewLabTest = async (values: NewLabTestFormValues) => {
    try {
        const newTest = await addPricingItemApi<EditableLabTest>('lab-tests', values);
        setEditableLabTests(prev => [...prev, newTest]);
        toast({ title: "Lab Test Added", description: `${values.name} added.` });
        newLabTestForm.reset();
        setShowNewLabTestDialog(false);
    } catch (e: any) { toast({title: "Error", description: e.message || "Could not add lab test.", variant: "destructive"});}
  };

  const handleDeleteLabTest = async (id: string) => {
    try {
        await deletePricingItemApi('lab-tests', id);
        setEditableLabTests(prev => prev.filter(test => test.id !== id));
        toast({ title: "Lab Test Removed", variant: "destructive" });
        setItemToDelete(null);
    } catch (e: any) { toast({title: "Error", description: e.message || "Could not remove lab test.", variant: "destructive"});}
  };

  const handleMedicationPriceChange = (id: string, newPrice: string) => {
    setEditableMedications(prev => prev.map(med => (med.id === id ? { ...med, pricePerUnit: parseFloat(newPrice) || 0 } : med)));
  };
  const onSaveMedicationPrices = async () => {
    setIsSavingMedPrices(true);
    try {
        for (const med of editableMedications) {
            const originalMed = pharmacyMedications.find(m => m.id === med.id);
            if (originalMed && originalMed.pricePerUnit !== med.pricePerUnit) {
                await updateMedicationInInventory(med.id, { pricePerUnit: med.pricePerUnit });
            }
        }
        toast({ title: "Success", description: "Medication prices updated via Pharmacy Context." });
    } catch (e: any) { toast({title: "Error", description: e.message || "Could not save medication prices.", variant: "destructive"});}
    setIsSavingMedPrices(false);
  };

  const handleOtherServicePriceChange = (id: string, newPrice: string) => {
    setOtherGeneralServices(prev => prev.map(service => (service.id === id ? { ...service, price: parseFloat(newPrice) || 0 } : service)));
  };
  const onSaveOtherGeneralServices = async () => {
    setIsSavingOtherServices(true);
    try {
        await updatePricingDataApi('other-services', otherGeneralServices);
        toast({ title: "Success", description: "Other general service prices updated." });
    } catch (e: any) { toast({title: "Error", description: e.message || "Could not save other services.", variant: "destructive"});}
    setIsSavingOtherServices(false);
  };

  const onAddNewGeneralService = async (values: NewGeneralServiceFormValues) => {
    try {
        const newService = await addPricingItemApi<OtherGeneralService>('other-services', values);
        setOtherGeneralServices(prev => [...prev, newService]);
        toast({ title: "General Service Added", description: `${values.name} added.` });
        newGeneralServiceForm.reset();
        setShowNewGeneralServiceDialog(false);
    } catch (e: any) { toast({title: "Error", description: e.message || "Could not add service.", variant: "destructive"});}
  };

  const handleDeleteGeneralService = async (id: string) => {
    try {
        await deletePricingItemApi('other-services', id);
        setOtherGeneralServices(prev => prev.filter(service => service.id !== id));
        toast({ title: "General Service Removed", variant: "destructive" });
        setItemToDelete(null);
    } catch (e: any) { toast({title: "Error", description: e.message || "Could not remove service.", variant: "destructive"});}
  };

  const handleWardTariffRateChange = (id: string, newRate: string) => {
    setWardTariffs(prev => prev.map(tariff => (tariff.id === id ? { ...tariff, perDiemRate: parseFloat(newRate) || 0 } : tariff)));
  };
  const onSaveWardTariffs = async () => {
    setIsSavingWardTariffs(true);
    try {
        await updatePricingDataApi('ward-tariffs', wardTariffs);
        toast({ title: "Success", description: "Ward & Room Tariffs updated." });
    } catch (e: any) { toast({title: "Error", description: e.message || "Could not save ward tariffs.", variant: "destructive"});}
    setIsSavingWardTariffs(false);
  };

  const onAddNewWardTariff = async (values: NewWardTariffFormValues) => {
    try {
        const newTariff = await addPricingItemApi<WardTariff>('ward-tariffs', values);
        setWardTariffs(prev => [...prev, newTariff]);
        toast({ title: "Ward Tariff Added", description: `${values.wardName} tariff added.` });
        newWardTariffForm.reset();
        setShowNewWardTariffDialog(false);
    } catch (e: any) { toast({title: "Error", description: e.message || "Could not add ward tariff.", variant: "destructive"});}
  };

  const handleDeleteWardTariff = async (id: string) => {
    try {
        await deletePricingItemApi('ward-tariffs', id);
        setWardTariffs(prev => prev.filter(tariff => tariff.id !== id));
        toast({ title: "Ward Tariff Removed", variant: "destructive" });
        setItemToDelete(null);
    } catch (e: any) { toast({title: "Error", description: e.message || "Could not remove ward tariff.", variant: "destructive"});}
  };

  const handleDeleteConfirmation = async () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'lab') await handleDeleteLabTest(itemToDelete.id);
    else if (itemToDelete.type === 'service') await handleDeleteGeneralService(itemToDelete.id);
    else if (itemToDelete.type === 'ward_tariff') await handleDeleteWardTariff(itemToDelete.id);
  };

  if (isLoading || isLoadingMedications) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <DollarSign className="mr-3 h-8 w-8 text-primary" /> Service Pricing Management
          </h1>
          <p className="text-muted-foreground">Configure costs for services. Current currency: {currency}. Pricing data managed via API.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin Panel
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><Settings className="mr-2 h-5 w-5 text-primary"/>General Service Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...feesForm}>
            <form onSubmit={feesForm.handleSubmit(onSaveGeneralFees)} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={feesForm.control} name="consultationFee" render={({ field }) => (
                    <FormItem> <FormLabel>Consultation Fee ({currency})</FormLabel> <FormControl><Input type="number" step="0.01" {...field} /></FormControl> <FormMessage /> </FormItem>
                )} />
                <FormField control={feesForm.control} name="checkupFee" render={({ field }) => (
                    <FormItem> <FormLabel>Check-up Fee ({currency})</FormLabel> <FormControl><Input type="number" step="0.01" {...field} /></FormControl> <FormMessage /> </FormItem>
                )} />
              </div>
              <Button type="submit" disabled={isSavingFees}>
                {isSavingFees ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>} Save General Fees
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle className="font-headline flex items-center"><BedDouble className="mr-2 h-5 w-5 text-primary"/>Ward & Room Tariffs</CardTitle>
            <CardDescription>Manage per-diem rates (in {currency}).</CardDescription>
          </div>
          <AlertDialog open={showNewWardTariffDialog} onOpenChange={setShowNewWardTariffDialog}>
            <AlertDialogTrigger asChild><Button variant="outline"><PlusCircle className="mr-2 h-4 w-4"/> Add New Tariff</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Add New Ward/Room Tariff</AlertDialogTitle><AlertDialogDescription>Enter ward/room type and per-diem rate (in {currency}).</AlertDialogDescription></AlertDialogHeader>
              <Form {...newWardTariffForm}><form onSubmit={newWardTariffForm.handleSubmit(onAddNewWardTariff)} className="space-y-4">
                <FormField control={newWardTariffForm.control} name="wardName" render={({ field }) => (<FormItem><FormLabel>Ward/Room Type Name</FormLabel><FormControl><Input placeholder="e.g., General Ward" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={newWardTariffForm.control} name="perDiemRate" render={({ field }) => (<FormItem><FormLabel>Per Diem Rate ({currency})</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                <AlertDialogFooter><AlertDialogCancel type="button">Cancel</AlertDialogCancel><AlertDialogAction type="submit">Add Tariff</AlertDialogAction></AlertDialogFooter>
              </form></Form>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent>
          {wardTariffs.length > 0 ? (<div className="space-y-4"><Table><TableHeader><TableRow><TableHead>Ward/Room Type</TableHead><TableHead className="w-1/3">Per Diem Rate ({currency})</TableHead><TableHead className="w-1/6 text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {wardTariffs.map((tariff) => (<TableRow key={tariff.id}><TableCell>{tariff.wardName}</TableCell><TableCell><Input type="number" step="0.01" value={tariff.perDiemRate} onChange={(e) => handleWardTariffRateChange(tariff.id, e.target.value)} className="max-w-xs"/></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setItemToDelete({id: tariff.id, name: tariff.wardName, type: 'ward_tariff'})}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>))}
          </TableBody></Table><Button onClick={onSaveWardTariffs} disabled={isSavingWardTariffs}>{isSavingWardTariffs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>} Save Ward Tariff Changes</Button></div>)
          : <p className="text-muted-foreground text-center py-4">No ward/room tariffs configured.</p>}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-center">
            <div><CardTitle className="font-headline">Lab Test Pricing</CardTitle><CardDescription>Add, edit, or remove lab tests and their prices (in {currency}).</CardDescription></div>
            <AlertDialog open={showNewLabTestDialog} onOpenChange={setShowNewLabTestDialog}><AlertDialogTrigger asChild><Button variant="outline"><PlusCircle className="mr-2 h-4 w-4"/> Add New Lab Test</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Add New Lab Test</AlertDialogTitle><AlertDialogDescription>Enter name and price (in {currency}).</AlertDialogDescription></AlertDialogHeader>
                <Form {...newLabTestForm}><form onSubmit={newLabTestForm.handleSubmit(onAddNewLabTest)} className="space-y-4">
                    <FormField control={newLabTestForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Test Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={newLabTestForm.control} name="price" render={({ field }) => (<FormItem><FormLabel>Price ({currency})</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <AlertDialogFooter><AlertDialogCancel type="button">Cancel</AlertDialogCancel><AlertDialogAction type="submit">Add Test</AlertDialogAction></AlertDialogFooter>
                </form></Form>
            </AlertDialogContent></AlertDialog>
        </CardHeader>
        <CardContent>
          {editableLabTests.length > 0 ? (<div className="space-y-4"><Table><TableHeader><TableRow><TableHead>Test Name</TableHead><TableHead className="w-1/4">Price ({currency})</TableHead><TableHead className="w-1/6 text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {editableLabTests.map((test) => (<TableRow key={test.id}><TableCell>{test.name}</TableCell><TableCell><Input type="number" step="0.01" value={test.price} onChange={(e) => handleLabPriceChange(test.id, e.target.value)} className="max-w-xs"/></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setItemToDelete({id: test.id, name: test.name, type: 'lab'})}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>))}
          </TableBody></Table><Button onClick={onSaveLabTestPrices} disabled={isSavingLabPrices}>{isSavingLabPrices ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>} Save Lab Test Changes</Button></div>)
          : <p className="text-muted-foreground text-center py-4">No lab tests configured.</p>}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-center">
            <div><CardTitle className="font-headline">Other General Services</CardTitle><CardDescription>Manage prices for miscellaneous billable services (in {currency}).</CardDescription></div>
            <AlertDialog open={showNewGeneralServiceDialog} onOpenChange={setShowNewGeneralServiceDialog}><AlertDialogTrigger asChild><Button variant="outline"><PlusCircle className="mr-2 h-4 w-4"/> Add Service</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Add New General Service</AlertDialogTitle><AlertDialogDescription>Enter name and price (in {currency}).</AlertDialogDescription></AlertDialogHeader>
                <Form {...newGeneralServiceForm}><form onSubmit={newGeneralServiceForm.handleSubmit(onAddNewGeneralService)} className="space-y-4">
                    <FormField control={newGeneralServiceForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Service Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={newGeneralServiceForm.control} name="price" render={({ field }) => (<FormItem><FormLabel>Price ({currency})</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <AlertDialogFooter><AlertDialogCancel type="button">Cancel</AlertDialogCancel><AlertDialogAction type="submit">Add Service</AlertDialogAction></AlertDialogFooter>
                </form></Form>
            </AlertDialogContent></AlertDialog>
        </CardHeader>
        <CardContent>
          {otherGeneralServices.length > 0 ? (<div className="space-y-4"><Table><TableHeader><TableRow><TableHead>Service Name</TableHead><TableHead className="w-1/4">Price ({currency})</TableHead><TableHead className="w-1/6 text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {otherGeneralServices.map((service) => (<TableRow key={service.id}><TableCell>{service.name}</TableCell><TableCell><Input type="number" step="0.01" value={service.price} onChange={(e) => handleOtherServicePriceChange(service.id, e.target.value)} className="max-w-xs"/></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setItemToDelete({id: service.id, name: service.name, type: 'service'})}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>))}
          </TableBody></Table><Button onClick={onSaveOtherGeneralServices} disabled={isSavingOtherServices}>{isSavingOtherServices ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>} Save Other Service Changes</Button></div>)
          : <p className="text-muted-foreground text-center py-4">No other general services configured.</p>}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Medication Pricing</CardTitle>
          <CardDescription>Edit price per unit (in {currency}). Medications managed on Pharmacy page. Stock levels are not editable here.</CardDescription>
        </CardHeader>
        <CardContent>
            {editableMedications.length > 0 ? (<div className="space-y-4 max-h-[500px] overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Medication (Dosage)</TableHead><TableHead className="w-1/4">Price/Unit ({currency})</TableHead><TableHead>Current Stock</TableHead></TableRow></TableHeader><TableBody>
              {editableMedications.map((med) => (<TableRow key={med.id}><TableCell>{med.name} ({med.dosage})</TableCell><TableCell><Input type="number" step="0.01" value={med.pricePerUnit} onChange={(e) => handleMedicationPriceChange(med.id, e.target.value)} className="max-w-xs"/></TableCell><TableCell>{med.stock} ({med.status})</TableCell></TableRow>))}
            </TableBody></Table><Button onClick={onSaveMedicationPrices} disabled={isSavingMedPrices}>{isSavingMedPrices ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>} Save Medication Prices</Button></div>)
            : <p className="text-muted-foreground">No medications found. Manage inventory and add medications on the Pharmacy page.</p>}
        </CardContent>
      </Card>

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>Permanently delete "{itemToDelete?.name}"?</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirmation} className={buttonVariants({variant: "destructive"})}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    

"use client";

import { useEffect, useState, useCallback } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ArrowLeft, PlusCircle, Edit, Trash2, Hotel, Loader2, Bed } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
export const WARDS_BEDS_STORAGE_KEY = 'navael_wards_beds_data'; // Keep for other modules if they directly access bed status, but ward CRUD goes via API
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";
import { ROLES } from "@/lib/constants";

export interface Bed {
  id: string;
  label: string;
  wardId: string;
  status: "Available" | "Occupied" | "Needs Cleaning" | "Maintenance";
  patientId?: string;
  patientName?: string;
}

export interface Ward {
  id: string;
  name: string;
  description?: string;
  beds: Bed[];
  _actionDescription?: string; // Internal use from API
}

const wardFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Ward name is required").max(100, "Ward name too long"),
  description: z.string().max(500, "Description too long").optional(),
  desiredBedCount: z.coerce.number().min(0, "Number of beds cannot be negative").int("Number of beds must be a whole number").optional(),
});

type WardFormValues = z.infer<typeof wardFormSchema>;

const newBedFormSchema = z.object({
  bedLabel: z.string().min(1, "Bed label is required"),
});
type NewBedFormValues = z.infer<typeof newBedFormSchema>;

const API_BASE_URL = '/api/admin/wards'; // Using relative path for Next.js API routes

// --- Service-like functions (API-driven) ---
async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText || `API Error ${response.status}` }));
    console.error("API Error Data:", errorData);
    throw new Error(errorData.message || `API Error: ${response.status}`);
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

async function fetchWardsService(): Promise<Ward[]> {
  const response = await fetch(API_BASE_URL);
  return handleApiResponse<Ward[]>(response);
}

async function saveWardService(wardData: WardFormValues, editingWardId?: string): Promise<Ward> {
  const method = editingWardId ? 'PUT' : 'POST';
  const endpoint = editingWardId ? `${API_BASE_URL}/${editingWardId}` : API_BASE_URL;
  const response = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wardData),
  });
  return handleApiResponse<Ward>(response);
}

async function deleteWardService(wardId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/${wardId}`, { method: 'DELETE' });
  await handleApiResponse<null>(response); // Expect 204 No Content
}

async function addBedToWardService(wardId: string, bedData: NewBedFormValues): Promise<Ward> {
  const response = await fetch(`${API_BASE_URL}/${wardId}/beds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bedData),
  });
  return handleApiResponse<Ward>(response);
}

async function deleteBedFromWardService(wardId: string, bedId: string): Promise<Ward> {
  const response = await fetch(`${API_BASE_URL}/${wardId}/beds/${bedId}`, { method: 'DELETE' });
  return handleApiResponse<Ward>(response);
}
// --- End Service-like functions ---


export default function WardManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userRole, username: actorName } = useAuth();
  const [wards, setWards] = useState<Ward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingWard, setIsSubmittingWard] = useState(false);
  const [isWardDialogOpen, setIsWardDialogOpen] = useState(false);
  const [editingWard, setEditingWard] = useState<Ward | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{id: string, name: string, type: 'ward' | 'bed', wardId?: string, bed?: Bed} | null>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [isAddingBed, setIsAddingBed] = useState<Record<string, boolean>>({});

  const wardForm = useForm<WardFormValues>({
    resolver: zodResolver(wardFormSchema),
  });

  const newBedForms: Record<string, ReturnType<typeof useForm<NewBedFormValues>>> = {};
  wards.forEach(ward => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      newBedForms[ward.id] = useForm<NewBedFormValues>({
          resolver: zodResolver(newBedFormSchema),
          defaultValues: { bedLabel: "" },
      });
  });

  const loadWards = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedWards = await fetchWardsService();
      setWards(fetchedWards);
    } catch (error: any) {
      console.error("Failed to load wards:", error);
      setWards([]);
      toast({ title: "Error", description: error.message || "Could not load ward data.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]); 
  
  useEffect(() => { loadWards(); }, [loadWards]);
  
  const handleOpenWardDialog = (ward?: Ward) => {
    if (ward) {
      setEditingWard(ward);
      wardForm.reset({ id: ward.id, name: ward.name, description: ward.description || "", desiredBedCount: ward.beds.length });
    } else {
      setEditingWard(null);
      wardForm.reset({ name: "", description: "", desiredBedCount: 0 });
    }
    setIsWardDialogOpen(true);
  };

  const onWardSubmit = async (values: WardFormValues) => {
    setIsSubmittingWard(true);
    try {
      const result = await saveWardService(values, editingWard?.id);
      const actionDescription = result._actionDescription || (editingWard ? `Updated ward: ${values.name}` : `Added new ward: ${values.name}`);
      
      toast({ title: editingWard ? "Ward Updated" : "Ward Added", description: `Ward "${result.name}" processed successfully.` });
      logActivity({
        actorRole: userRole || ROLES.ADMIN,
        actorName: actorName || "Admin",
        actionDescription,
        targetEntityType: "Ward",
        targetEntityId: result.id,
        iconName: editingWard ? "Edit" : "PlusCircle",
      });
      setIsWardDialogOpen(false);
      loadWards(); 
    } catch (e: any) {
      console.error("Error saving ward:", e);
      toast({ title: "Save Error", description: e.message || "Could not save ward data.", variant: "destructive" });
    }
    setIsSubmittingWard(false);
  };

  const handleAddNewBed = async (wardId: string, bedValues: NewBedFormValues) => {
    setIsAddingBed(prev => ({ ...prev, [wardId]: true }));
    try {
      const updatedWard = await addBedToWardService(wardId, bedValues);
      toast({ title: "Bed Added", description: `Bed "${bedValues.bedLabel}" added to ward "${updatedWard.name}".` });
      logActivity({ actorRole: userRole || ROLES.ADMIN, actorName: actorName || "Admin", actionDescription: `Added bed ${bedValues.bedLabel} to ward ${updatedWard.name}`, targetEntityType: "Bed", targetEntityId: updatedWard.beds.find(b=>b.label === bedValues.bedLabel)?.id || "unknown_bed_id" , iconName: "Bed" });
      newBedForms[wardId]?.reset();
      loadWards(); 
    } catch (e: any) {
      console.error("Error saving new bed:", e);
      toast({ title: "Save Error", description: e.message || "Could not add bed.", variant: "destructive" });
    }
    setIsAddingBed(prev => ({ ...prev, [wardId]: false }));
  };

  const handleDeleteWard = async () => {
    if (!itemToDelete || itemToDelete.type !== 'ward') return;
    setIsProcessingDelete(true);
    try {
      await deleteWardService(itemToDelete.id);
      toast({ title: "Ward Deleted", description: `Ward "${itemToDelete.name}" has been removed.`, variant: "destructive" });
      logActivity({
        actorRole: userRole || ROLES.ADMIN,
        actorName: actorName || "Admin",
        actionDescription: `Deleted ward: ${itemToDelete.name} (ID: ${itemToDelete.id})`,
        targetEntityType: "Ward",
        targetEntityId: itemToDelete.id,
        iconName: "Trash2",
      });
      loadWards(); 
    } catch (e: any) {
      console.error("Error deleting ward:", e);
      toast({ title: "Delete Error", description: e.message || "Could not delete ward.", variant: "destructive" });
    }
    setItemToDelete(null);
    setIsProcessingDelete(false);
  };

  const handleDeleteBed = async () => {
    if (!itemToDelete || itemToDelete.type !== 'bed' || !itemToDelete.wardId || !itemToDelete.bed) return;
    const { wardId, bed } = itemToDelete;
    setIsProcessingDelete(true);
    try {
      await deleteBedFromWardService(wardId, bed.id);
      toast({ title: "Bed Deleted", description: `Bed "${bed.label}" has been removed.`, variant: "destructive" });
      logActivity({ actorRole: userRole || ROLES.ADMIN, actorName: actorName || "Admin", actionDescription: `Deleted bed ${bed.label} from ward (ID: ${wardId})`, targetEntityType: "Bed", targetEntityId: bed.id, iconName: "Trash2" });
      loadWards(); 
    } catch (e: any) {
      console.error("Error deleting bed:", e);
      toast({ title: "Delete Error", description: e.message || "Could not delete bed.", variant: "destructive" });
    }
    setItemToDelete(null);
    setIsProcessingDelete(false);
  };
  
  const handleDeleteConfirmation = async () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'ward') {
        await handleDeleteWard();
    } else if (itemToDelete.type === 'bed') {
        await handleDeleteBed();
    }
  };


  if (isLoading && wards.length === 0) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <Hotel className="mr-3 h-8 w-8 text-primary" /> Ward &amp; Bed Management
          </h1>
          <p className="text-muted-foreground">Define wards, set their bed capacity, and manage individual beds.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin Panel
          </Button>
          <Button onClick={() => handleOpenWardDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Ward
          </Button>
        </div>
      </div>

      {isLoading && wards.length > 0 && (
        <div className="flex justify-center items-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /> <span className="ml-2 text-muted-foreground">Refreshing wards...</span></div>
      )}

      {!isLoading && wards.length === 0 ? (
        <Card className="shadow-lg">
            <CardContent className="min-h-[200px] flex flex-col items-center justify-center bg-muted/30 rounded-md p-6">
              <Hotel className="h-24 w-24 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">No Wards Configured</p>
              <p className="text-sm text-muted-foreground">Click "Add New Ward" to define the first ward and its beds.</p>
            </CardContent>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-4">
          {wards.map((ward) => (
            <AccordionItem value={ward.id} key={ward.id} className="border rounded-lg shadow-md bg-card">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex justify-between items-center w-full">
                    <div className="flex flex-col items-start text-left">
                        <span className="font-medium text-lg text-primary">{ward.name}</span>
                        <span className="text-xs text-muted-foreground">{ward.description || "No description"}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Badge variant="secondary">Beds: {ward.beds.length}</Badge>
                        <DropdownMenu onOpenChange={(open) => { if(open) { /* Potentially stop accordion trigger */ }}}>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => handleOpenWardDialog(ward)}><Edit className="mr-2 h-4 w-4" />Edit Ward Details</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setItemToDelete({id: ward.id, name: ward.name, type: 'ward'})}><Trash2 className="mr-2 h-4 w-4" />Delete Ward</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-2">
                <div className="space-y-4">
                    <h4 className="text-md font-semibold text-muted-foreground">Manage Beds for {ward.name}</h4>
                    {ward.beds.length > 0 ? (
                        <div className="max-h-72 overflow-y-auto pr-2">
                        <Table>
                            <TableHeader><TableRow><TableHead>Bed Label</TableHead><TableHead>Current Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {ward.beds.map(bed => (
                                    <TableRow key={bed.id}>
                                        <TableCell className="font-medium">{bed.label}</TableCell>
                                        <TableCell><Badge variant={bed.status === "Occupied" ? "destructive" : bed.status === "Available" ? "default" : "secondary"}>{bed.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => setItemToDelete({id: bed.id, name: bed.label, type: 'bed', wardId: ward.id, bed: bed})} disabled={bed.status === "Occupied"}>
                                                <Trash2 className={`h-4 w-4 ${bed.status === "Occupied" ? "text-muted-foreground/50" : "text-destructive"}`}/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    ) : <p className="text-sm text-muted-foreground">No beds added to this ward yet.</p>}
                    
                    <Form {...(newBedForms[ward.id] || {})}>
                        <form onSubmit={newBedForms[ward.id]?.handleSubmit(values => handleAddNewBed(ward.id, values))} className="flex items-end gap-2 pt-4 border-t mt-4">
                            <FormField control={newBedForms[ward.id]?.control} name="bedLabel" render={({ field }) => (
                                <FormItem className="flex-grow"><FormLabel className="text-xs">New Bed Label</FormLabel><FormControl><Input placeholder="e.g., Bed 10, Room A-02" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <Button type="submit" variant="outline" size="sm" disabled={isAddingBed[ward.id] || !newBedForms[ward.id]?.formState.isValid}>
                                {isAddingBed[ward.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />} Add Bed
                            </Button>
                        </form>
                    </Form>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={isWardDialogOpen} onOpenChange={setIsWardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-headline">{editingWard ? "Edit Ward" : "Add New Ward"}</DialogTitle>
            <DialogDescription>{editingWard ? "Update ward details and desired bed count." : "Enter details for the new ward and set initial bed count."}</DialogDescription>
          </DialogHeader>
          <Form {...wardForm}>
            <form onSubmit={wardForm.handleSubmit(onWardSubmit)} className="space-y-4 py-4">
              <FormField control={wardForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Ward Name</FormLabel><FormControl><Input placeholder="e.g., General Ward A" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={wardForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="Brief description..." {...field} rows={2}/></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={wardForm.control} name="desiredBedCount" render={({ field }) => (
                <FormItem><FormLabel>Desired Number of Beds</FormLabel><FormControl><Input type="number" placeholder="e.g., 10" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} /></FormControl><FormDescription>The system will attempt to add/remove beds to match this number. Occupied beds will not be removed.</FormDescription><FormMessage /></FormItem>
              )} />
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingWard}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmittingWard}>
                  {isSubmittingWard && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingWard ? "Save Changes" : "Add Ward"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!itemToDelete} onOpenChange={(isOpen) => !isOpen && setItemToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle className="font-headline">Confirm Deletion</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to delete "{itemToDelete?.name}"? 
                    {itemToDelete?.type === 'ward' && wards.find(w => w.id === itemToDelete.id)?.beds.some(b => b.status === 'Occupied') === false && " This will also permanently delete all associated beds IF THEY ARE NOT OCCUPIED."}
                    {itemToDelete?.type === 'ward' && wards.find(w => w.id === itemToDelete.id)?.beds.some(b => b.status === 'Occupied') === true && <span className="font-semibold text-destructive"> This ward has occupied beds and cannot be deleted until beds are vacant.</span>}
                    {itemToDelete?.type === 'bed' && itemToDelete.bed?.status === 'Occupied' && <span className="font-semibold text-destructive"> This bed is occupied and cannot be deleted.</span>}
                    This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setItemToDelete(null)} disabled={isProcessingDelete}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleDeleteConfirmation} 
                    className={buttonVariants({variant: "destructive"})}
                    disabled={isProcessingDelete || (itemToDelete?.type === 'ward' && wards.find(w => w.id === itemToDelete.id)?.beds.some(b => b.status === 'Occupied')) || (itemToDelete?.type === 'bed' && itemToDelete.bed?.status === 'Occupied')}
                >
                    {isProcessingDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Yes, Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
    
// d:/projects/NavaelHospitalSystem/src/app/dashboard/pharmacy/page.tsx

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill, Search, PlusCircle, ListOrdered, MoreHorizontal, Edit, FileText, PackageSearch, CheckCircle, DollarSign, AlertTriangle, Send, ClipboardCheck, Eye, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import { ROLES } from "@/lib/constants";
import { logActivity } from "@/lib/activityLog";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { formatCurrency } from "@/lib/utils";
import { usePharmacy } from "@/contexts/pharmacy-context";


// Medication Interface - NO CHANGES NEEDED HERE (it was already correct with linkedAppointmentId)
export interface Medication {
  id: string;
  name: string;
  dosage: string;
  stock: number;
  category: string;
  expiryDate: string;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  supplier?: string;
  pricePerUnit: number;
}

// Prescription Interface - This was already correctly updated with linkedAppointmentId from your file
export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  medicationName: string;
  dosage: string;
  quantity: number;
  instructions?: string;
  prescribedBy: string;
  date: string;
  status: "Pending" | "Filled" | "Cancelled" | "Ready for Pickup" | "Dispensed";
  isBilled: boolean;
  invoiceId?: string;
  paymentStatus?: "Pending Payment" | "Paid" | "N/A";
  refillable: boolean; 
  refillsRemaining?: number; 
  linkedAppointmentId?: string; // <--- This was already here and is correct
}

export const PHARMACY_PRESCRIPTIONS_STORAGE_KEY = 'navael_pharmacy_prescriptions';
export const PHARMACY_MEDICATIONS_STORAGE_KEY = 'navael_pharmacy_medications';

const medicationStatusVariant = (status: Medication["status"]): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "In Stock") return "default";
  if (status === "Low Stock") return "secondary";
  if (status === "Out of Stock") return "destructive";
  return "default";
};

export const prescriptionStatusVariant = (status: Prescription["status"]): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "Pending") return "secondary";
  if (status === "Filled" || status === "Dispensed") return "default";
  if (status === "Cancelled") return "destructive";
  if (status === "Ready for Pickup") return "default";
  return "default";
};

export const paymentStatusBadgeVariant = (status?: Prescription["paymentStatus"]): BadgeProps["variant"] => {
  switch (status) {
    case "Paid": return "default";
    case "Pending Payment": return "secondary";
    default: return "outline";
  }
};

// ✨ NEW IMPORT: For the link icon in the table
import { Link as LinkIcon } from "lucide-react";


export default function PharmacyPage() {
  const { toast } = useToast();
  const { userRole, username: actorName } = useAuth();
  const { currency } = useAppearanceSettings();
  const { 
    medications, 
    prescriptions, 
    isLoadingMedications, 
    isLoadingPrescriptions,
    updateMedicationInInventory,
    updatePrescription,
  } = usePharmacy();

  const [searchTermPrescriptions, setSearchTermPrescriptions] = useState("");
  const [searchTermInventory, setSearchTermInventory] = useState("");
  const [prescriptionToPrint, setPrescriptionToPrint] = useState<Prescription | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});


  const filteredPrescriptions = useMemo(() => {
    return prescriptions.filter(rx =>
      rx.patientName.toLowerCase().includes(searchTermPrescriptions.toLowerCase()) ||
      rx.medicationName.toLowerCase().includes(searchTermPrescriptions.toLowerCase()) ||
      rx.id.toLowerCase().includes(searchTermPrescriptions.toLowerCase())
    ).sort((a,b) => {
      const order = ["Pending", "Ready for Pickup", "Filled", "Dispensed", "Cancelled"];
      if (userRole === ROLES.PHARMACIST) {
          return order.indexOf(a.status) - order.indexOf(b.status);
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [prescriptions, searchTermPrescriptions, userRole]);


  const filteredInventory = useMemo(() => {
    return medications.filter(med =>
      med.name.toLowerCase().includes(searchTermInventory.toLowerCase()) ||
      med.category.toLowerCase().includes(searchTermInventory.toLowerCase())
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [medications, searchTermInventory]);


  const handleDispenseMedication = async (prescriptionId: string) => {
    setActionLoading(prev => ({ ...prev, [prescriptionId]: true }));
    const targetRx = prescriptions.find(rx => rx.id === prescriptionId);
    if (!targetRx) {
        setActionLoading(prev => ({ ...prev, [prescriptionId]: false }));
        return;
    }

    if (targetRx.status !== "Ready for Pickup") {
      toast({ title: "Cannot Dispense", description: `Prescription must be 'Ready for Pickup'. Current status: ${targetRx.status}.`, variant: "destructive"});
      setActionLoading(prev => ({ ...prev, [prescriptionId]: false }));
      return;
    }

    if (targetRx.paymentStatus !== "Paid") {
      toast({ title: "Payment Pending", description: `Payment for prescription ${targetRx.patientName} (Rx ID: ${prescriptionId}) is still pending. Cannot dispense.`, variant: "destructive"});
      setActionLoading(prev => ({ ...prev, [prescriptionId]: false }));
      return;
    }

    const medicationDetails = medications.find(m => m.name === targetRx.medicationName && m.dosage === targetRx.dosage);
    if (!medicationDetails || medicationDetails.stock < targetRx.quantity) {
      toast({
          title: "Insufficient Stock",
          description: `Not enough ${targetRx.medicationName} in stock. Required: ${targetRx.quantity}, Available: ${medicationDetails?.stock ?? 0}.`,
          variant: "destructive"
      });
      setActionLoading(prev => ({ ...prev, [prescriptionId]: false }));
      return;
    }

    try {
        const newStock = medicationDetails.stock - targetRx.quantity;
        await updateMedicationInInventory(medicationDetails.id, { stock: newStock });
        await updatePrescription(prescriptionId, { status: "Dispensed" });

        toast({ title: "Medication Dispensed", description: `Prescription ${prescriptionId} for ${targetRx.patientName} marked as dispensed. Inventory updated.` });
        logActivity({ actorRole: userRole || ROLES.PHARMACIST, actorName: actorName || "System", actionDescription: `Dispensed ${targetRx.medicationName} for ${targetRx.patientName}`, targetEntityType: "Prescription", targetEntityId: prescriptionId, iconName: "ClipboardCheck"});
    } catch (error) {
        console.error("Dispense error:", error);
        toast({title: "Dispense Error", description: "Could not complete dispensing.", variant: "destructive"});
    } finally {
        setActionLoading(prev => ({ ...prev, [prescriptionId]: false }));
    }
  };

  const handleMarkReadyForPickup = async (prescriptionId: string) => {
     setActionLoading(prev => ({ ...prev, [prescriptionId]: true }));
     const targetRx = prescriptions.find(rx => rx.id === prescriptionId);
     if (!targetRx) {
        setActionLoading(prev => ({ ...prev, [prescriptionId]: false }));
        return;
     }

     if (targetRx.status !== "Pending") {
        toast({ title: "Invalid Action", description: `Only 'Pending' prescriptions can be marked 'Ready for Pickup'. Current status: ${targetRx.status}`, variant: "destructive"});
        setActionLoading(prev => ({ ...prev, [prescriptionId]: false }));
        return;
     }
     if (targetRx.paymentStatus !== "Paid") {
        toast({ title: "Payment Pending", description: `Payment for prescription ${targetRx.patientName} (Rx ID: ${prescriptionId}) is still pending.`, variant: "destructive"});
        setActionLoading(prev => ({ ...prev, [prescriptionId]: false }));
        return;
     }

     try {
        await updatePrescription(prescriptionId, { status: "Ready for Pickup" });
        toast({ title: "Prescription Ready", description: `Prescription ${prescriptionId} for ${targetRx.patientName} is now ready for pickup.` });
        logActivity({ actorRole: userRole || ROLES.PHARMACIST, actorName: actorName || "System", actionDescription: `Marked prescription ${targetRx.medicationName} for ${targetRx.patientName} as Ready for Pickup`, targetEntityType: "Prescription", targetEntityId: prescriptionId, iconName:"CheckCircle"});
     } catch (error) {
        console.error("Error marking ready for pickup:", error);
        toast({title: "Update Error", description: "Could not update prescription status.", variant: "destructive"});
     } finally {
        setActionLoading(prev => ({ ...prev, [prescriptionId]: false }));
     }
  }

  const handleCancelPrescription = async (prescriptionId: string) => {
     setActionLoading(prev => ({ ...prev, [prescriptionId]: true }));
     const targetRx = prescriptions.find(rx => rx.id === prescriptionId);
     if (!targetRx) {
        setActionLoading(prev => ({ ...prev, [prescriptionId]: false }));
        return;
     }
     try {
        await updatePrescription(prescriptionId, { status: "Cancelled" });
        toast({ title: "Prescription Cancelled", description: `Prescription ${prescriptionId} has been cancelled.`, variant: "destructive"});
        logActivity({ actorRole: userRole || ROLES.PHARMACIST, actorName: actorName || "System", actionDescription: `Cancelled prescription ID ${prescriptionId}`, targetEntityType: "Prescription", targetEntityId: prescriptionId, iconName:"XCircle"}); // Corrected icon name if XCircle exists
     } catch (error) {
        console.error("Error cancelling prescription:", error);
        toast({title: "Update Error", description: "Could not cancel prescription.", variant: "destructive"});
     } finally {
        setActionLoading(prev => ({ ...prev, [prescriptionId]: false }));
     }
  };

  const handleReportLowStock = (medication: Medication) => {
    logActivity({
        actorRole: userRole || ROLES.PHARMACIST,
        actorName: actorName || "System",
        actionDescription: `Reported low stock for ${medication.name} (${medication.dosage}). Current stock: ${medication.stock}.`,
        targetEntityType: "Medication Inventory",
        targetEntityId: medication.id,
        iconName: "AlertTriangle",
    });
    toast({
        title: "Low Stock Reported",
        description: `Low stock for ${medication.name} has been reported to the administrator. (Simulated)`,
    });
  };
  
  const handlePrintPrescription = () => {
    const printContent = document.getElementById('prescription-print-content');
    if (printContent) {
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = `<div style="font-family: sans-serif; padding: 20px;">${printContent.innerHTML}</div>`;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload();
    }
  };

  const isLoading = isLoadingMedications || isLoadingPrescriptions;
  const canManageInventory = userRole === ROLES.ADMIN || userRole === ROLES.PHARMACIST;
  const canPrescribe = userRole === ROLES.DOCTOR || userRole === ROLES.NURSE;
  const isPharmacist = userRole === ROLES.PHARMACIST;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <Pill className="mr-3 h-8 w-8 text-primary" /> Pharmacy Management
          </h1>
          <p className="text-muted-foreground">
            {isPharmacist ? "Manage medication dispensing, inventory, and incoming prescriptions." : "View medication inventory and prescription history."}
          </p>
        </div>
        <div className="flex items-center gap-2">
            {canPrescribe && (
                <Button asChild variant="outline">
                    <Link href="/dashboard/pharmacy/prescribe">
                        <Edit className="mr-2 h-4 w-4"/> New Prescription
                    </Link>
                </Button>
            )}
            {canManageInventory && (
                <Button asChild>
                <Link href="/dashboard/pharmacy/inventory/new">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Medication to Inventory
                </Link>
                </Button>
            )}
        </div>
      </div>
      
      {isLoading && (
        <div className="flex justify-center p-10 min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading pharmacy data...</span>
        </div>
      )}

      {!isLoading && (
        <>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Prescription Queue</CardTitle>
              <CardDescription>
                {isPharmacist ? "Process pending and ready prescriptions." : "View submitted prescriptions."}
              </CardDescription>
              <div className="pt-2">
                <Input
                  placeholder="Search prescriptions by patient, medication, or ID..."
                  className="max-w-sm"
                  value={searchTermPrescriptions}
                  onChange={(e) => setSearchTermPrescriptions(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPrescriptions && filteredPrescriptions.length === 0 ? (
                 <div className="flex items-center justify-center min-h-[200px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                     <p className="ml-2 text-muted-foreground">Loading prescriptions...</p>
                 </div>
              ) : filteredPrescriptions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Medication (Qty)</TableHead>
                    <TableHead>Prescribed By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    {/* ✨ ADDED TABLE HEAD: For the linked consultation */}
                    <TableHead>Linked Consultation</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrescriptions.map(rx => (
                    <TableRow key={rx.id}>
                      <TableCell className="font-medium">
                        <Link href={`/dashboard/patients/${rx.patientId}`} className="hover:underline text-primary">
                            {rx.patientName}
                          </Link>
                      </TableCell>
                      <TableCell>{rx.medicationName} {rx.dosage} ({rx.quantity})</TableCell>
                      <TableCell>{rx.prescribedBy}</TableCell>
                      <TableCell>{format(parseISO(rx.date), "PPP")}</TableCell>
                      <TableCell>
                        <Badge variant={paymentStatusBadgeVariant(rx.paymentStatus)} className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3"/>{rx.paymentStatus || "N/A"}
                        </Badge>
                        {rx.invoiceId && (
                            <Link href="/dashboard/billing" className="ml-1 text-xs text-primary hover:underline">
                              (Inv: {rx.invoiceId})
                            </Link>
                          )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={prescriptionStatusVariant(rx.status)}
                            className={rx.status === 'Ready for Pickup' ? 'bg-blue-500 text-white dark:bg-blue-600 dark:text-white' : (rx.status === 'Dispensed' ? 'bg-green-500 text-white dark:bg-green-600 dark:text-white' : '')}>
                            {rx.status}
                        </Badge>
                      </TableCell>
                      {/* ✨ ADDED TABLE CELL: Display linked consultation ID */}
                      <TableCell>
                        {rx.linkedAppointmentId ? (
                          <Link href={`/dashboard/consultations/${rx.linkedAppointmentId}/edit`} className="hover:underline text-primary text-xs flex items-center">
                            <LinkIcon className="h-3 w-3 mr-1"/> {rx.linkedAppointmentId.substring(0, 8)}...
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={actionLoading[rx.id]}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/pharmacy/prescriptions/${rx.id}/view`}>
                                <Eye className="mr-2 h-4 w-4" /> View Details
                              </Link>
                            </DropdownMenuItem>
                            <DialogTrigger asChild>
                                <DropdownMenuItem onClick={() => setPrescriptionToPrint(rx)}>
                                    <Printer className="mr-2 h-4 w-4" /> Print Prescription
                                </DropdownMenuItem>
                            </DialogTrigger>
                            {isPharmacist && rx.status === "Pending" &&
                                <DropdownMenuItem onClick={() => handleMarkReadyForPickup(rx.id)} disabled={rx.paymentStatus !== "Paid" || actionLoading[rx.id]}>
                                    {actionLoading[rx.id] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <CheckCircle className="mr-2 h-4 w-4 text-blue-600" />
                                    Mark Ready for Pickup
                                    {rx.paymentStatus !== "Paid" && " (Pay Pending)"}
                                </DropdownMenuItem>
                            }
                            {isPharmacist && rx.status === "Ready for Pickup" &&
                                <DropdownMenuItem onClick={() => handleDispenseMedication(rx.id)} disabled={rx.paymentStatus !== "Paid" || actionLoading[rx.id]}>
                                    {actionLoading[rx.id] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <ClipboardCheck className="mr-2 h-4 w-4 text-green-600" />
                                    Mark Dispensed & Update Stock
                                    {rx.paymentStatus !== "Paid" && " (Pay Pending)"}
                                </DropdownMenuItem>
                            }
                            {isPharmacist && rx.status !== "Cancelled" && rx.status !== "Dispensed" && 
                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleCancelPrescription(rx.id)} disabled={actionLoading[rx.id]}>
                                 {actionLoading[rx.id] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Cancel Prescription
                                </DropdownMenuItem>
                            }
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              ) : (
                <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/30 rounded-md p-6 text-center">
                  <Search className="h-20 w-20 text-muted-foreground/50 mb-4" />
                  <p className="text-lg text-muted-foreground">No Prescriptions Found</p>
                  <p className="text-sm text-muted-foreground">
                    {searchTermPrescriptions ? "Try adjusting your search." : (isPharmacist ? "No prescriptions awaiting processing." : "No prescriptions submitted yet.")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><PackageSearch className="mr-2 h-5 w-5 text-primary"/>Medication Inventory</CardTitle>
              <CardDescription>Search and manage current medication stock. Prices are in {currency}.</CardDescription>
              <div className="pt-2">
                <Input
                    placeholder="Search medications by name or category..."
                    className="max-w-sm"
                    value={searchTermInventory}
                    onChange={(e) => setSearchTermInventory(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingMedications && filteredInventory.length === 0 ? (
                 <div className="flex items-center justify-center min-h-[200px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                     <p className="ml-2 text-muted-foreground">Loading inventory...</p>
                 </div>
              ) : filteredInventory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Dosage</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Price/Unit ({currency})</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    {canManageInventory && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map(med => (
                    <TableRow key={med.id}>
                      <TableCell className="font-medium">{med.name}</TableCell>
                      <TableCell>{med.dosage}</TableCell>
                      <TableCell>{med.stock}</TableCell>
                      <TableCell>{formatCurrency(med.pricePerUnit, currency)}</TableCell>
                      <TableCell>{med.category}</TableCell>
                      <TableCell>{format(parseISO(med.expiryDate), "MMM yyyy")}</TableCell>
                      <TableCell>{med.supplier || "N/A"}</TableCell>
                      <TableCell><Badge variant={medicationStatusVariant(med.status)}>{med.status}</Badge></TableCell>
                      {canManageInventory && (
                        <TableCell className="text-right">
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/pharmacy/inventory/${med.id}/edit`}>
                                        <Edit className="mr-2 h-4 w-4"/>Edit Details
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => alert(`Adjusting stock for ${med.name}`)}><ListOrdered className="mr-2 h-4 w-4"/>Adjust Stock</DropdownMenuItem>
                                {(med.status === "Low Stock" || med.status === "Out of Stock") &&
                                    <DropdownMenuItem onClick={() => handleReportLowStock(med)}>
                                        <Send className="mr-2 h-4 w-4 text-orange-500"/> Report Low Stock to Admin
                                    </DropdownMenuItem>
                                }
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              ) : (
                <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/30 rounded-md p-6 text-center">
                  <Pill className="h-20 w-20 text-muted-foreground/50 mb-4" />
                  <p className="text-lg text-muted-foreground">No Medications in Inventory</p>
                  <p className="text-sm text-muted-foreground">
                    {searchTermInventory ? "Try adjusting your search." : (canManageInventory ? "Add new medications using the button above." : "Inventory is currently empty.")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

        <Dialog open={!!prescriptionToPrint} onOpenChange={(isOpen) => !isOpen && setPrescriptionToPrint(null)}>
            <DialogContent className="sm:max-w-lg" id="prescription-print-content-wrapper">
                <DialogHeader>
                    <DialogTitle className="font-headline text-xl text-center">Prescription</DialogTitle>
                    <DialogDescription className="text-center">
                        Navael Healthcare Clinic - Your Health, Our Priority
                    </DialogDescription>
                </DialogHeader>
                {prescriptionToPrint && (
                <div id="prescription-print-content" className="space-y-4 py-4 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b pb-2">
                        <p><strong className="text-muted-foreground">Patient:</strong></p>         <p className="font-semibold">{prescriptionToPrint.patientName}</p>
                        <p><strong className="text-muted-foreground">Patient ID:</strong></p>      <p>{prescriptionToPrint.patientId}</p>
                        <p><strong className="text-muted-foreground">Date:</strong></p>            <p>{format(parseISO(prescriptionToPrint.date), "MMMM d, yyyy")}</p>
                        <p><strong className="text-muted-foreground">Prescriber:</strong></p>     <p>{prescriptionToPrint.prescribedBy}</p>
                    </div>
                    
                    <div className="mt-4">
                        <div className="flex items-center">
                            <Pill className="h-5 w-5 text-primary mr-2" />
                            <h4 className="font-semibold text-md">{prescriptionToPrint.medicationName} <span className="text-muted-foreground">({prescriptionToPrint.dosage})</span></h4>
                        </div>
                        <p className="ml-7"><strong className="text-muted-foreground">Quantity:</strong> {prescriptionToPrint.quantity}</p>
                        {prescriptionToPrint.instructions && (
                            <p className="ml-7 mt-1"><strong className="text-muted-foreground">Instructions (Sig):</strong> {prescriptionToPrint.instructions}</p>
                        )}
                    </div>
                    <Separator className="my-4"/>
                     <div className="text-xs text-muted-foreground">
                        <p><strong>Rx ID:</strong> {prescriptionToPrint.id}</p>
                        <p className="mt-2"><strong>Important:</strong> Follow instructions carefully. Keep out of reach of children. If symptoms persist, consult your doctor.</p>
                    </div>

                </div>
                )}
                <DialogFooter className="sm:justify-end gap-2 mt-4">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Close</Button>
                    </DialogClose>
                    <Button type="button" onClick={handlePrintPrescription}><Printer className="mr-2 h-4 w-4"/>Print</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}

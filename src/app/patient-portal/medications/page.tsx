
"use client";

import { useEffect, useState } from "react";
import { usePatientAuth } from "@/contexts/patient-auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Pill, ArrowLeft, Eye, Printer, RefreshCw } from "lucide-react"; 
import { prescriptionStatusVariant, paymentStatusBadgeVariant } from "@/app/dashboard/pharmacy/page";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast"; 
import { usePharmacy, type Prescription } from "@/contexts/pharmacy-context";

export default function PatientMedicationsPage() {
  const { patientId, patientName, isLoading: authLoading } = usePatientAuth();
  const { fetchPrescriptionsForPatient, isLoadingPrescriptions, updatePrescription } = usePharmacy();
  const [patientPrescriptions, setPatientPrescriptionsState] = useState<Prescription[]>([]);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [selectedPrescriptionForView, setSelectedPrescriptionForView] = useState<Prescription | null>(null);
  const router = useRouter();
  const { toast } = useToast(); 
  const [isRequestingRefill, setIsRequestingRefill] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (patientId && !isLoadingPrescriptions) {
        setIsLoadingPageData(true);
        const fetchedRxs = await fetchPrescriptionsForPatient(patientId);
        setPatientPrescriptionsState(fetchedRxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setIsLoadingPageData(false);
      } else if (!patientId && !authLoading) {
        setIsLoadingPageData(false);
      }
    };
    loadData();
  }, [patientId, authLoading, isLoadingPrescriptions, fetchPrescriptionsForPatient]);

  const isLoading = authLoading || isLoadingPrescriptions || isLoadingPageData;

  const handleRequestRefill = async (prescriptionId: string) => {
    const prescriptionToRefill = patientPrescriptions.find(rx => rx.id === prescriptionId);
    if (!prescriptionToRefill || !prescriptionToRefill.refillable || (prescriptionToRefill.refillsRemaining !== undefined && prescriptionToRefill.refillsRemaining <= 0)) {
        toast({ title: "Refill Not Allowed", description: "This prescription is not eligible for a refill.", variant: "destructive" });
        return;
    }
    setIsRequestingRefill(true);
    try {
        const updatedRxData: Partial<Omit<Prescription, 'id'>> = {
            refillsRemaining: prescriptionToRefill.refillsRemaining !== undefined ? prescriptionToRefill.refillsRemaining - 1 : undefined,
        };
        if (updatedRxData.refillsRemaining === 0) {
            updatedRxData.refillable = false;
        }
        
        const updatedPrescription = await updatePrescription(prescriptionId, updatedRxData);
        if (updatedPrescription) {
            setPatientPrescriptionsState(prev => prev.map(p => p.id === prescriptionId ? updatedPrescription : p));
            toast({
                title: "Refill Requested",
                description: `Your request for a refill of ${updatedPrescription.medicationName} has been submitted.`,
            });
        }
    } catch (error) {
        toast({ title: "Refill Error", description: "Could not request refill.", variant: "destructive" });
    } finally {
        setIsRequestingRefill(false);
    }
  };

  const handlePrintPrescription = () => {
    const printContent = document.getElementById('patient-medication-print-content');
    if (printContent && selectedPrescriptionForView) {
      const originalContents = document.body.innerHTML;
      const headerContent = `<div style="padding:20px; font-family: sans-serif;"><h2>Prescription Details</h2><p>Patient: ${selectedPrescriptionForView?.patientName}</p><p>Date: ${format(parseISO(selectedPrescriptionForView.date), "PPP")}</p></div>`;
      document.body.innerHTML = headerContent + printContent.innerHTML;
      window.print();
      document.body.innerHTML = originalContents;
    }
  };


  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading your medication history...</p>
      </div>
    );
  }

  if (!patientId) {
     return (
      <div className="text-center py-10">
        <p className="text-lg text-muted-foreground">Please log in to view your medications.</p>
        <Button asChild className="mt-4">
            <Link href="/patient-portal/login">Go to Login</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-headline font-bold flex items-center">
                <Pill className="mr-3 h-7 w-7 text-primary" /> My Medications
            </h1>
            <p className="text-muted-foreground">View your prescribed medications, {patientName}.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>

      {isLoadingPageData && patientPrescriptions.length === 0 ? (
        <div className="flex justify-center items-center h-64">
             <Loader2 className="h-12 w-12 animate-spin text-primary" />
             <p className="ml-3 text-muted-foreground">Fetching your prescriptions...</p>
        </div>
      ) : patientPrescriptions.length > 0 ? (
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle>Your Prescriptions</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Medication</TableHead>
                    <TableHead>Prescriber</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Refills</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {patientPrescriptions.map((rx) => {
                      const isEligibleForRefill = rx.refillable && (rx.refillsRemaining !== undefined && rx.refillsRemaining > 0) && (rx.status === "Dispensed" || rx.status === "Filled");
                      return (
                        <TableRow key={rx.id}>
                            <TableCell>{format(parseISO(rx.date), "PPP")}</TableCell>
                            <TableCell>
                                <div className="font-medium">{rx.medicationName}</div>
                                <div className="text-xs text-muted-foreground">{rx.dosage} (Qty: {rx.quantity})</div>
                            </TableCell>
                            <TableCell>{rx.prescribedBy}</TableCell>
                            <TableCell><Badge variant={prescriptionStatusVariant(rx.status)}>{rx.status}</Badge></TableCell>
                            <TableCell>
                                <Badge variant={paymentStatusBadgeVariant(rx.paymentStatus)} className="text-xs">
                                   <DollarSign className="mr-1 h-3 w-3"/> {rx.paymentStatus || "N/A"}
                                </Badge>
                                {rx.invoiceId && <span className="text-xs text-muted-foreground ml-1">(Invoice: {rx.invoiceId})</span>}
                            </TableCell>
                            <TableCell>
                                {rx.refillable 
                                    ? (rx.refillsRemaining !== undefined ? `${rx.refillsRemaining} remaining` : "Allowed") 
                                    : "Not refillable"
                                }
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedPrescriptionForView(rx)}>
                                    <Eye className="mr-2 h-4 w-4" /> View
                                </Button>
                                {isEligibleForRefill && (
                                  <Button variant="default" size="sm" onClick={() => handleRequestRefill(rx.id)} disabled={isRequestingRefill}>
                                    {isRequestingRefill ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />} Request Refill
                                  </Button>
                                )}
                                {rx.refillable && rx.refillsRemaining === 0 && (
                                    <Badge variant="outline" className="text-xs">No Refills Left</Badge>
                                )}
                            </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
                </Table>
            </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md">
          <CardContent className="p-10 flex flex-col items-center justify-center text-center">
            <Pill className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg text-muted-foreground">You have no prescriptions on record.</p>
            <p className="text-sm text-muted-foreground">Prescribed medications will appear here.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedPrescriptionForView} onOpenChange={() => setSelectedPrescriptionForView(null)}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle className="font-headline text-xl">Prescription Details</DialogTitle>
                <DialogDescription>Rx ID: {selectedPrescriptionForView?.id}</DialogDescription>
            </DialogHeader>
            {selectedPrescriptionForView && (
            <div id="patient-medication-print-content" className="space-y-4 py-4 text-sm">
                <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 border-b pb-3">
                    <p className="font-medium text-muted-foreground">Patient:</p>         <p className="font-semibold">{selectedPrescriptionForView.patientName}</p>
                    <p className="font-medium text-muted-foreground">Date:</p>            <p>{format(parseISO(selectedPrescriptionForView.date), "MMMM d, yyyy")}</p>
                    <p className="font-medium text-muted-foreground">Prescriber:</p>     <p>{selectedPrescriptionForView.prescribedBy}</p>
                </div>
                
                <div className="mt-3">
                    <div className="flex items-center">
                        <Pill className="h-5 w-5 text-primary mr-2" />
                        <h4 className="font-semibold text-md">{selectedPrescriptionForView.medicationName} <span className="text-muted-foreground">({selectedPrescriptionForView.dosage})</span></h4>
                    </div>
                    <p className="ml-7"><strong className="text-muted-foreground">Quantity:</strong> {selectedPrescriptionForView.quantity}</p>
                    {selectedPrescriptionForView.instructions && (
                        <p className="ml-7 mt-1"><strong className="text-muted-foreground">Instructions (Sig):</strong> {selectedPrescriptionForView.instructions}</p>
                    )}
                    <p className="ml-7 mt-1"><strong className="text-muted-foreground">Refillable:</strong> {selectedPrescriptionForView.refillable ? 'Yes' : 'No'}</p>
                    {selectedPrescriptionForView.refillable && selectedPrescriptionForView.refillsRemaining !== undefined && (
                       <p className="ml-7"><strong className="text-muted-foreground">Refills Remaining:</strong> {selectedPrescriptionForView.refillsRemaining}</p>
                    )}
                </div>
                <Separator className="my-3"/>
                <div className="p-2 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground"><strong>Status:</strong> <Badge variant={prescriptionStatusVariant(selectedPrescriptionForView.status)}>{selectedPrescriptionForView.status}</Badge></p>
                    <p className="mt-1"><strong>Payment:</strong> <Badge variant={paymentStatusBadgeVariant(selectedPrescriptionForView.paymentStatus)}>{selectedPrescriptionForView.paymentStatus || "N/A"}</Badge>
                        {selectedPrescriptionForView.invoiceId && 
                            <Link href="/patient-portal/billing" className="ml-1 text-primary hover:underline">(Invoice: {selectedPrescriptionForView.invoiceId})</Link>
                        }
                    </p>
                </div>
            </div>
            )}
            <DialogFooter className="sm:justify-end gap-2 mt-2">
                <Button type="button" variant="outline" onClick={() => setSelectedPrescriptionForView(null)}>Close</Button>
                <Button type="button" onClick={handlePrintPrescription}><Printer className="mr-2 h-4 w-4"/>Print</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

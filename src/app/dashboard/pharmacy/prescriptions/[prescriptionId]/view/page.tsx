"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"; // <-- Added CardFooter
import { ArrowLeft, FileText, UserCircle, Pill, CalendarDays, CheckCircle, DollarSign, Info, Loader2, RefreshCw } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Prescription, prescriptionStatusVariant, paymentStatusBadgeVariant } from "../../../page";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { usePatients } from "@/contexts/patient-context";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { usePharmacy } from "@/contexts/pharmacy-context";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const DetailItem = ({ label, value, icon: Icon }: { label: string; value?: string; icon?: React.ElementType }) => {
  if (!value) return null;
  return (
    <div className="flex items-start text-sm mb-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mr-2 mt-0.5" />}
      <span className="font-medium text-muted-foreground w-32">{label}:</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
};

export default function ViewPrescriptionPage() {
  const router = useRouter();
  const params = useParams();
  const prescriptionId = params.prescriptionId as string;
  const { getPatientById } = usePatients();
  const { currency } = useAppearanceSettings();
  const { getPrescriptionById, isLoadingPrescriptions, updatePrescription } = usePharmacy();
  const { toast } = useToast();

  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [isRequestingRefill, setIsRequestingRefill] = useState(false);
  const [patient, setPatient] = useState<any | null>(null); // Use correct type if available

  useEffect(() => {
    const loadPrescription = async () => {
      if (prescriptionId) {
        const fetchedPrescription = await getPrescriptionById(prescriptionId);
        if (fetchedPrescription) {
          setPrescription(fetchedPrescription);
        } else {
          toast({ title: "Error", description: "Prescription not found.", variant: "destructive" });
          router.push("/dashboard/pharmacy");
        }
      }
    };
    loadPrescription();
  }, [prescriptionId, router, getPrescriptionById, toast]);

  useEffect(() => {
    const fetchPatient = async () => {
      if (prescription?.patientId) {
        const result = await getPatientById(prescription.patientId);
        setPatient(result || null);
      }
    };
    fetchPatient();
  }, [prescription?.patientId, getPatientById]);

  const handleRequestRefill = async () => {
    if (!prescription || !prescription.refillable || (prescription.refillsRemaining !== undefined && prescription.refillsRemaining <= 0)) {
        toast({ title: "Refill Not Allowed", description: "This prescription is not eligible for a refill.", variant: "destructive" });
        return;
    }
    setIsRequestingRefill(true);
    try {
        const updatedRxData: Partial<Omit<Prescription, 'id'>> = {
            refillsRemaining: prescription.refillsRemaining !== undefined ? prescription.refillsRemaining - 1 : undefined,
        };
        if (updatedRxData.refillsRemaining === 0) {
            updatedRxData.refillable = false;
        }
        const updatedPrescription = await updatePrescription(prescription.id, updatedRxData);
        if (updatedPrescription) {
            setPrescription(updatedPrescription);
            toast({
                title: "Refill Requested",
                description: `Refill request for ${updatedPrescription.medicationName} submitted.`,
            });
        }
    } catch (error) {
        toast({ title: "Refill Error", description: "Could not request refill.", variant: "destructive" });
    } finally {
        setIsRequestingRefill(false);
    }
  };

  if (isLoadingPrescriptions && !prescription) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
  }

  if (!prescription) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-destructive text-lg">Prescription not found.</p>
        <Button onClick={() => router.push("/dashboard/pharmacy")} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pharmacy
        </Button>
      </div>
    );
  }

  const isEligibleForRefillRequest = prescription.refillable && (prescription.refillsRemaining === undefined || prescription.refillsRemaining > 0) && (prescription.status === "Dispensed" || prescription.status === "Filled");

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
        <Button variant="outline" onClick={() => router.back()} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <FileText className="h-7 w-7 text-primary" />
                <CardTitle className="font-headline text-2xl">Prescription Details</CardTitle>
            </div>
            <Badge variant={prescriptionStatusVariant(prescription.status)} className="text-sm px-3 py-1">
                {prescription.status}
            </Badge>
          </div>
          <CardDescription>Rx ID: {prescription.id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-3 font-headline flex items-center"><UserCircle className="mr-2 h-5 w-5 text-primary"/>Patient Information</h3>
            <DetailItem label="Patient Name" value={prescription.patientName} />
            <DetailItem label="Patient ID" value={prescription.patientId} />
            {patient && (
                <>
                    <DetailItem label="Age" value={patient.age?.toString()} />
                    <DetailItem label="Gender" value={patient.gender} />
                </>
            )}
             <Button variant="link" asChild className="p-0 h-auto text-sm mt-1">
                <Link href={`/dashboard/patients/${prescription.patientId}`}>View Full Patient Profile</Link>
            </Button>
          </section>

          <Separator />

          <section>
            <h3 className="text-lg font-semibold mb-3 font-headline flex items-center"><Pill className="mr-2 h-5 w-5 text-primary"/>Medication Details</h3>
            <DetailItem label="Medication" value={prescription.medicationName} />
            <DetailItem label="Dosage" value={prescription.dosage} />
            <DetailItem label="Quantity" value={prescription.quantity.toString()} />
            <DetailItem label="Instructions (Sig)" value={prescription.instructions || "N/A"} />
          </section>

          <Separator />

          <section>
            <h3 className="text-lg font-semibold mb-3 font-headline flex items-center"><CalendarDays className="mr-2 h-5 w-5 text-primary"/>Prescription Information</h3>
            <DetailItem label="Prescribed By" value={prescription.prescribedBy} />
            <DetailItem label="Date Prescribed" value={format(parseISO(prescription.date), "PPP")} />
            <div className="flex items-center text-sm mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground mr-2 mt-0.5" />
                <span className="font-medium text-muted-foreground w-32">Payment Status:</span>
                <Badge variant={paymentStatusBadgeVariant(prescription.paymentStatus)}>{prescription.paymentStatus || "N/A"}</Badge>
            </div>
            {prescription.invoiceId && (
                <DetailItem label="Invoice ID" value={prescription.invoiceId} icon={Info} />
            )}
             {prescription.paymentStatus === "Pending Payment" && prescription.invoiceId && (
                 <Button variant="link" asChild className="p-0 h-auto text-sm mt-1">
                    <Link href={`/dashboard/billing`}>Go to Billing (Invoice: {prescription.invoiceId})</Link>
                </Button>
            )}
            <DetailItem label="Refillable" value={prescription.refillable ? 'Yes' : 'No'} />
            {prescription.refillable && prescription.refillsRemaining !== undefined && (
                <DetailItem label="Refills Remaining" value={prescription.refillsRemaining.toString()} />
            )}
          </section>

          {prescription.status === "Dispensed" && (
            <>
            <Separator />
             <section>
                <h3 className="text-lg font-semibold mb-3 font-headline flex items-center"><CheckCircle className="mr-2 h-5 w-5 text-green-600"/>Dispensing Information</h3>
                <p className="text-sm text-muted-foreground">This medication has been dispensed.</p>
            </section>
            </>
          )}

           {isEligibleForRefillRequest && (
                <CardFooter className="pt-6 border-t">
                    <Button onClick={handleRequestRefill} disabled={isRequestingRefill} className="w-full">
                        {isRequestingRefill ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Request Refill from Pharmacy
                    </Button>
                </CardFooter>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
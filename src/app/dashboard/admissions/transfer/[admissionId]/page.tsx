
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowLeft, BedDouble, Shuffle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { type Admission, ADMISSIONS_STORAGE_KEY } from "../../../admissions/page";
import { type Ward, type Bed as BedInterface, WARDS_BEDS_STORAGE_KEY } from "../../../inpatient/bed-management/page";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/contexts/auth-context";
import { Separator } from "@/components/ui/separator";

const transferSchema = z.object({
  newWardId: z.string().min(1, "New ward selection is required"),
  newBedId: z.string().min(1, "New bed selection is required"),
  transferReason: z.string().optional(),
});

type TransferFormValues = z.infer<typeof transferSchema>;

export default function TransferPatientPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const admissionId = params.admissionId as string;
  const { userRole, username: actorName } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [allWards, setAllWards] = useState<Ward[]>([]);
  const [availableBedsInNewWard, setAvailableBedsInNewWard] = useState<BedInterface[]>([]);

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      transferReason: "",
    },
  });

  useEffect(() => {
    setIsLoading(true);
    if (admissionId) {
      try {
        const storedAdmissions = localStorage.getItem(ADMISSIONS_STORAGE_KEY);
        const admissions: Admission[] = storedAdmissions ? JSON.parse(storedAdmissions) : [];
        const foundAdmission = admissions.find(a => a.id === admissionId);

        if (foundAdmission) {
          setAdmission(foundAdmission);
        } else {
          toast({ title: "Error", description: "Admission record not found.", variant: "destructive" });
          router.replace("/dashboard/admissions");
        }

        const storedWards = localStorage.getItem(WARDS_BEDS_STORAGE_KEY);
        setAllWards(storedWards ? JSON.parse(storedWards) : []);

      } catch (e) {
        console.error("Error loading data for transfer page:", e);
        toast({ title: "Load Error", description: "Could not load necessary data.", variant: "destructive"});
      }
    }
    setIsLoading(false);
  }, [admissionId, router, toast]);

  const selectedNewWardId = form.watch("newWardId");

  useEffect(() => {
    if (selectedNewWardId) {
      const selectedWard = allWards.find(w => w.id === selectedNewWardId);
      if (selectedWard) {
        // Filter out the current bed if the new ward is the same as the old one
        const beds = selectedWard.beds.filter(bed =>
          bed.status === "Available" || (bed.patientId === admission?.patientId && bed.label === admission?.bed)
        );
        setAvailableBedsInNewWard(beds);
      } else {
        setAvailableBedsInNewWard([]);
      }
      form.setValue("newBedId", ""); // Reset bed selection when ward changes
    } else {
      setAvailableBedsInNewWard([]);
    }
  }, [selectedNewWardId, allWards, form, admission]);

  const onSubmit = async (values: TransferFormValues) => {
    if (!admission) {
        toast({ title: "Error", description: "Admission details are missing.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    const newWard = allWards.find(w => w.id === values.newWardId);
    const newBed = newWard?.beds.find(b => b.id === values.newBedId);

    if (!newWard || !newBed) {
        toast({ title: "Error", description: "Selected new ward or bed not found.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }
    
    if (newBed.status === "Occupied" && newBed.patientId !== admission.patientId) {
        toast({ title: "Bed Occupied", description: `Bed ${newBed.label} in ${newWard.name} is already occupied. Please select another bed.`, variant: "destructive" });
        setIsSubmitting(false);
        return;
    }


    try {
        // 1. Update Admission Record
        let admissions: Admission[] = JSON.parse(localStorage.getItem(ADMISSIONS_STORAGE_KEY) || '[]');
        const admissionIndex = admissions.findIndex(a => a.id === admission.id);
        if (admissionIndex === -1) throw new Error("Admission not found for update.");
        
        const oldWardName = admission.room;
        const oldBedLabel = admission.bed;

        admissions[admissionIndex] = {
            ...admissions[admissionIndex],
            room: newWard.name,
            bed: newBed.label,
        };
        localStorage.setItem(ADMISSIONS_STORAGE_KEY, JSON.stringify(admissions));

        // 2. Update Bed Statuses
        let wards: Ward[] = JSON.parse(localStorage.getItem(WARDS_BEDS_STORAGE_KEY) || '[]');
        
        // Find and update old bed
        const oldWardIndex = wards.findIndex(w => w.name === oldWardName);
        if (oldWardIndex > -1) {
            const oldBedIndex = wards[oldWardIndex].beds.findIndex(b => b.label === oldBedLabel && b.patientId === admission.patientId);
            if (oldBedIndex > -1) {
                wards[oldWardIndex].beds[oldBedIndex].status = "Needs Cleaning"; // Or "Available"
                wards[oldWardIndex].beds[oldBedIndex].patientId = undefined;
                wards[oldWardIndex].beds[oldBedIndex].patientName = undefined;
            }
        }

        // Find and update new bed
        const newWardDBIndex = wards.findIndex(w => w.id === newWard.id);
        if (newWardDBIndex > -1) {
            const newBedDBIndex = wards[newWardDBIndex].beds.findIndex(b => b.id === newBed.id);
            if (newBedDBIndex > -1) {
                wards[newWardDBIndex].beds[newBedDBIndex].status = "Occupied";
                wards[newWardDBIndex].beds[newBedDBIndex].patientId = admission.patientId;
                wards[newWardDBIndex].beds[newBedDBIndex].patientName = admission.patientName;
            }
        }
        localStorage.setItem(WARDS_BEDS_STORAGE_KEY, JSON.stringify(wards));

        logActivity({
            actorRole: userRole || "System",
            actorName: actorName || "System User",
            actionDescription: `Transferred patient ${admission.patientName} from ${oldWardName}/${oldBedLabel} to ${newWard.name}/${newBed.label}. Reason: ${values.transferReason || 'Not specified'}.`,
            targetEntityType: "Admission",
            targetEntityId: admission.id,
            iconName: "Shuffle",
        });

        toast({ title: "Patient Transferred", description: `${admission.patientName} successfully transferred to ${newWard.name}, Bed ${newBed.label}.` });
        router.push("/dashboard/admissions");

    } catch (e: any) {
        console.error("Error during transfer process:", e);
        toast({ title: "Transfer Error", description: e.message || "Could not complete patient transfer.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
  }

  if (!admission) {
    return <div className="text-center py-10">Admission record not found or could not be loaded.</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
        <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admissions
        </Button>

        <Card className="shadow-lg">
            <CardHeader>
                <div className="flex items-center space-x-3">
                    <BedDouble className="h-7 w-7 text-primary" />
                    <CardTitle className="font-headline text-2xl">Transfer Patient: {admission.patientName}</CardTitle>
                </div>
                <CardDescription>
                    Patient ID: {admission.patientId} | Admission ID: {admission.id}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-6 p-3 border rounded-md bg-muted/50 text-sm">
                    <p><span className="font-medium">Current Ward:</span> {admission.room}</p>
                    <p><span className="font-medium">Current Bed:</span> {admission.bed}</p>
                    <p><span className="font-medium">Admission Reason:</span> {admission.reasonForAdmission || "N/A"}</p>
                </div>

                <Separator className="my-6" />
                <h3 className="text-lg font-semibold font-headline text-primary mb-4 flex items-center"><Shuffle className="mr-2 h-5 w-5"/>New Placement</h3>

                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="newWardId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Select New Ward</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Choose a new ward" /></SelectTrigger></FormControl>
                                <SelectContent>
                                {allWards.map(ward => (
                                    <SelectItem key={ward.id} value={ward.id}>{ward.name}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="newBedId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Select Available Bed in New Ward</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedNewWardId || availableBedsInNewWard.length === 0}>
                                <FormControl><SelectTrigger><SelectValue placeholder={!selectedNewWardId ? "Select new ward first" : (availableBedsInNewWard.length === 0 ? "No beds available/suitable" : "Choose an available bed")} /></SelectTrigger></FormControl>
                                <SelectContent>
                                {availableBedsInNewWard.map(bed => (
                                    <SelectItem key={bed.id} value={bed.id}>{bed.label} {bed.patientId === admission.patientId && bed.label === admission.bed ? "(Current Bed)" : ""}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            {availableBedsInNewWard.length === 0 && selectedNewWardId && <FormDescription className="text-destructive">No available beds in this ward, or current bed is the only option.</FormDescription>}
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField control={form.control} name="transferReason" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Reason for Transfer (Optional)</FormLabel>
                            <FormControl><Textarea placeholder="e.g., Patient condition improved, moved to step-down unit." {...field} rows={3} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    
                    <div className="flex justify-end pt-6">
                    <Button type="submit" disabled={isSubmitting} size="lg">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shuffle className="mr-2 h-4 w-4" />}
                        Confirm Transfer
                    </Button>
                    </div>
                </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}

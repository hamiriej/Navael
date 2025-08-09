// src/app/dashboard/patients/[patientId]/page.tsx

"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge as ShadBadge, type BadgeProps as ShadBadgeProps } from "@/components/ui/badge";
import { ArrowLeft, UserCircle, Phone, Mail, ShieldAlert, PlusCircle, Edit, Pill, ListChecks, BriefcaseMedical, FileText, CalendarDays, MapPin, Users as EmergencyIcon, MessageSquareText, FlaskConical, History, Sparkles, Loader2, Brain, FileQuestion, AlertTriangle, Eye, DollarSign, Printer, BookOpen, HeartPulse, ClipboardCheck, Clock, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import Image from 'next/image';
import { useAuth } from "@/contexts/auth-context";
import { ROLES } from "@/lib/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summarizePatientHistory, type SummarizePatientHistoryInput } from "@/ai/flows/summarize-patient-history-flow";
import { diagnosePatientCondition, type DiagnosePatientConditionInput, type DiagnosePatientConditionOutput } from "@/ai/flows/diagnose-patient-condition-flow";
import { generatePatientEducation, type GeneratePatientEducationInput, type GeneratePatientEducationOutput } from "@/ai/flows/generate-patient-education-flow";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { usePatients, type Patient, type AugmentedPatient } from "@/contexts/patient-context";
import { format, parseISO, isFuture, isToday as checkIsTodayDate, formatDistanceToNow, isValid } from "date-fns";
import { type Appointment, statusBadgeVariant as getAppointmentStatusVariant, paymentStatusBadgeVariant as getAppointmentPaymentStatusVariant } from '../../appointments/page';
import { useAppointments } from "@/contexts/appointment-context";
import {getLabStatusVariant, paymentStatusBadgeVariant as getLabPaymentStatusBadgeVariant } from '../../lab/page';
import { useLabOrders } from "@/contexts/lab-order-context"; // Keep this import
import { useConsultations } from "@/contexts/consultation-context";
import { type Consultation } from '../../consultations/page';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { formatCurrency } from "@/lib/utils";
import { getActivityLog, type ActivityLogItem, logActivity } from "@/lib/activityLog";
import { IconRenderer } from "../../page";
import { cn } from "@/lib/utils";
import type { VitalSignRecord } from "../../inpatient/record-vitals/[admissionId]/page";
import type { Admission } from "../../admissions/page";
import { type Prescription, prescriptionStatusVariant as getPrescriptionStatusVariant, paymentStatusBadgeVariant as getPrescriptionPaymentStatusVariant } from '../../pharmacy/page';
import { usePharmacy } from "@/contexts/pharmacy-context";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"; // Added for MAR actions
import type { LabTest, LabOrder } from "@/app/dashboard/lab/types";

const VITAL_SIGNS_STORAGE_KEY = 'navael_vital_signs';
const ADMISSIONS_STORAGE_KEY = 'navael_admissions';

export interface MAR_Entry {
  id: string;
  prescriptionId: string;
  patientId: string;
  admissionId: string;
  medicationName: string;
  dosage: string;
  route?: string;
  frequency?: string;
  scheduledTime?: string;
  administrationTime: string; // ISO string
  administeredBy: string;
  status: "Administered" | "Missed" | "Refused" | "Held";
  notes?: string;
}

export const NAVAEL_MAR_ENTRIES_STORAGE_KEY = 'navael_mar_entries';


const DetailItem = ({ label, value, icon: Icon }: { label: string; value?: React.ReactNode; icon?: React.ElementType }) => {
  if (!value && typeof value !== 'number' && typeof value !== 'boolean') return null;
  return (
    <div className="flex items-start space-x-3">
      {Icon && <Icon className="h-5 w-5 text-primary flex-shrink-0 mt-1" />}
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-md text-foreground">{value}</p>
      </div>
    </div>
  );
};


export default function PatientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const patientIdParams = params.patientId;
  const patientId = Array.isArray(patientIdParams) ? patientIdParams[0] : patientIdParams;

  const searchParams = useSearchParams();
  const activityLogRef = useRef<HTMLDivElement>(null);

  const { getPatientById, isLoading: isLoadingPatientsContext } = usePatients();
  const { userRole, username: actorName, staffId: actorId } = useAuth();
  
  const { appointments: allSystemAppointments, isLoadingAppointments, getAppointmentsForPatient } = useAppointments();
  // --- CHANGE STARTS HERE ---
  // Changed fetchLabOrdersForPatientId to fetchLabOrdersForPatient as defined in your context
  const { labOrders: allSystemLabOrders, isLoadingLabOrders, fetchLabOrdersForPatient } = useLabOrders();
  // --- CHANGE ENDS HERE ---

  const { prescriptions: allSystemPrescriptions, isLoadingPrescriptions, fetchPrescriptionsForPatientId } = usePharmacy();
  const { consultations: allSystemConsultations, isLoadingConsultations, fetchConsultationsForPatient } = useConsultations();

  const [patient, setPatient] = useState<AugmentedPatient | null>(null);
  const [isLoadingPatientData, setIsLoadingPatientData] = useState(true);

  const [patientPrescriptionsState, setPatientPrescriptionsState] = useState<Prescription[]>([]);
  const [upcomingAppointmentsState, setUpcomingAppointmentsState] = useState<Appointment[]>([]);
  const [recentConsultationsState, setRecentConsultationsState] = useState<Consultation[]>([]);
  const [patientLabOrdersState, setPatientLabOrdersState] = useState<LabOrder[]>([]);
  const [selectedLabOrderForModal, setSelectedLabOrderForModal] = useState<LabOrder | null>(null);
  const [fullActivityLog, setFullActivityLog] = useState<ActivityLogItem[]>([]);
  const [vitalSignsHistory, setVitalSignsHistory] = useState<VitalSignRecord[]>([]);

  const { toast } = useToast();
  const { currency } = useAppearanceSettings();

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const [currentSymptoms, setCurrentSymptoms] = useState<string>("");
  const [aiDiagnosis, setAiDiagnosis] = useState<DiagnosePatientConditionOutput | null>(null);
  const [isLoadingDiagnosis, setIsLoadingDiagnosis] = useState(false);

  const [educationConditionInput, setEducationConditionInput] = useState<string>("");
  const [educationLanguageLevel, setEducationLanguageLevel] = useState<GeneratePatientEducationInput["languageLevel"]>("Standard");
  const [generatedEducationMaterial, setGeneratedEducationMaterial] = useState<GeneratePatientEducationOutput | null>(null);
  const [isGeneratingEducation, setIsGeneratingEducation] = useState(false);

  const [allSystemVitals, setAllSystemVitals] = useState<VitalSignRecord[]>([]);
  const [allSystemAdmissions, setAllSystemAdmissions] = useState<Admission[]>([]);
  const [marEntries, setMarEntries] = useState<MAR_Entry[]>([]);
  const [activeAdmission, setActiveAdmission] = useState<Admission | null>(null);

  const [marActionDialog, setMarActionDialog] = useState<{open: boolean, prescription?: Prescription, action?: MAR_Entry["status"]}>({open: false});
  const [marActionNotes, setMarActionNotes] = useState("");
  const [isProcessingMarAction, setIsProcessingMarAction] = useState(false);

  const isLoadingOverall = isLoadingPatientsContext || isLoadingPatientData || isLoadingAppointments || isLoadingLabOrders || isLoadingPrescriptions || isLoadingConsultations;

  useEffect(() => {
    const action = searchParams.get('action');
    const view = searchParams.get('view');

    if (patient && action === 'lab_ordered') {
      toast({ title: "Lab Order Submitted", description: `Lab order successfully submitted for ${patient.name}.` });
      router.replace(`/dashboard/patients/${patient.id}`, { scroll: false });
    } else if (patient && action === 'med_prescribed') {
      toast({ title: "Medication Prescribed", description: `Medication successfully prescribed for ${patient.name}.` });
      router.replace(`/dashboard/patients/${patient.id}`, { scroll: false });
    }

    if (view === 'activity' && activityLogRef.current) {
      setTimeout(() => activityLogRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
     if (view === 'vitals' && document.getElementById('vital-signs-history')) {
      setTimeout(() => document.getElementById('vital-signs-history')?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
    if (view === 'mar' && document.getElementById('medication-administration-record')) {
      setTimeout(() => document.getElementById('medication-administration-record')?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [searchParams, patient, toast, router]);

  

 useEffect(() => {
    let active = true;

    const loadPatientAndRelatedData = async () => {
        if (!active || !patientId || typeof patientId !== 'string') {
            if (active) setIsLoadingPatientData(false); 
            if (patientId) toast({ title: "Error", description: "Invalid Patient ID provided.", variant: "destructive" });
            setPatient(null);
            return;
        }
        
        if (isLoadingPatientsContext) { 
            if (active) setIsLoadingPatientData(true); // Ensure local loading reflects context dependency
            return; 
        }
        
        if (active) setIsLoadingPatientData(true);
        try {
            const newPatientData = await getPatientById(patientId);
            if (!active) return;

            setPatient(newPatientData || null);

            if (!newPatientData) {
                toast({ title: "Patient Not Found", description: `Could not find patient with ID ${patientId}.`, variant: "destructive" });
            } else {
                // --- CHANGE STARTS HERE ---
                // Changed fetchLabOrdersForPatientId to fetchLabOrdersForPatient
                const [orders, rxs, consults, apps] = await Promise.all([
                    fetchLabOrdersForPatient(patientId).then((data: LabOrder[]) => active ? data : []),
                    // --- CHANGE ENDS HERE ---
                    fetchPrescriptionsForPatientId(patientId).then((data: Prescription[]) => active ? data : []),
                    fetchConsultationsForPatient(patientId).then((data: Consultation[]) => active ? data.sort((a,b) => new Date(b.consultationDate).getTime() - new Date(a.consultationDate).getTime()).slice(0,3) : []),
                    getAppointmentsForPatient(patientId).then((data: Appointment[]) => {
                        if (!active) return [];
                        const today = new Date(); today.setHours(0,0,0,0);
                        return data.filter(app => (isFuture(parseISO(app.date)) || checkIsTodayDate(parseISO(app.date))) && (app.status === "Scheduled" || app.status === "Confirmed" || app.status === "Arrived"))
                                   .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.time.localeCompare(b.time))
                                   .slice(0, 3);
                    })
                ]);

                if (active) {
                    setPatientLabOrdersState(orders);
                    setPatientPrescriptionsState(rxs);
                    setRecentConsultationsState(consults);
                    setUpcomingAppointmentsState(apps);
                }
            }
        } catch (error) {
            if (active) {
                console.error("Error fetching patient details and related data:", error);
                toast({ title: "Error Loading Patient Data", description: "Could not load some patient data components.", variant: "destructive" });
                setPatient(null);
            }
        } finally {
            if (active) {
                setIsLoadingPatientData(false);
            }
        }
    };

    loadPatientAndRelatedData();

    return () => { active = false; };
  }, [
      patientId, 
      getPatientById, 
      isLoadingPatientsContext, 
      // --- CHANGE STARTS HERE ---
      // Changed fetchLabOrdersForPatientId to fetchLabOrdersForPatient in dependency array
      fetchLabOrdersForPatient, 
      // --- CHANGE ENDS HERE ---
      fetchPrescriptionsForPatientId, 
      fetchConsultationsForPatient, 
      getAppointmentsForPatient, 
      toast
  ]);


  useEffect(() => {
    const safeJsonParse = <T extends any>(key: string, defaultValue: T[] = []): T[] => {
      if (typeof window === 'undefined') return defaultValue;
      try {
        const storedValue = localStorage.getItem(key);
        if (storedValue) {
          const parsed = JSON.parse(storedValue);
          return Array.isArray(parsed) ? parsed : defaultValue;
        }
      } catch (e) { console.warn(`Failed to parse ${key} from localStorage, returning default. Error:`, e); }
      return defaultValue;
    };

    setAllSystemVitals(safeJsonParse<VitalSignRecord>(VITAL_SIGNS_STORAGE_KEY));
    setAllSystemAdmissions(safeJsonParse<Admission>(ADMISSIONS_STORAGE_KEY));
   setMarEntries(safeJsonParse<MAR_Entry>(NAVAEL_MAR_ENTRIES_STORAGE_KEY));
  }, []);






  useEffect(() => {
    if (patient && patient.id) {
      setVitalSignsHistory
          (allSystemVitals
             .filter(vital => vital.patientId === patient.id)
                .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

      const currentPatient = patient;
      const fetchActivityLogData = async function fetchActivityLog() {
      const allActivity = await getActivityLog();
      
      setFullActivityLog(allActivity
      .filter((log: ActivityLogItem) =>
      log.targetEntityId === patient.id || 
      (log.actionDescription && log.actionDescription.toLowerCase().includes(patient.name.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(patient.name.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(patient.id.toLowerCase()))
    ))}// (log.actionDescription && log.actionDescription.toLowerCase().includes(patient.name.toLowerCase())) || (log.details && log.details.toLowerCase().includes(patient.name.toLowerCase())) || (log.details && log.details.toLowerCase().includes(patient.id.toLowerCase()))).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const currentAdmission = allSystemAdmissions.find(adm => adm.patientId === patient.id && (adm.status === "Admitted" || adm.status === "Observation"));
      setActiveAdmission(currentAdmission || null);
      
      if (currentAdmission) {
        setMarEntries(prevAllMar => prevAllMar.filter(entry => entry.admissionId === currentAdmission.id));
      } else {
        setMarEntries([]);
      }

      const canSeeSensitiveData = userRole === ROLES.DOCTOR || userRole === ROLES.NURSE || userRole === ROLES.ADMIN;
      if (canSeeSensitiveData && !aiSummary && !isLoadingSummary) { 
        setIsLoadingSummary(true);
        summarizePatientHistory({ patientId: patient.id, medicalHistoryNotes: patient.medicalHistoryNotes, allergies: patient.allergies, currentMedications: patient.currentMedications, }).then(result => { setAiSummary(result.summary); }).catch(error => { console.error("Error fetching AI summary:", error); toast({ title: "AI Summary Error", description: "Could not generate patient summary.", variant: "destructive", }); setAiSummary("Failed to load summary."); }).finally(() => { setIsLoadingSummary(false); });
      } else if (!canSeeSensitiveData) {
        setAiSummary(null);
      }
    } else {
      setVitalSignsHistory([]);
      setFullActivityLog([]);
      setActiveAdmission(null);
      setMarEntries([]);
      setAiSummary(null);
    }
  }, [patient, userRole, allSystemVitals, allSystemAdmissions, toast, aiSummary, isLoadingSummary]);

  const handleGetAIDiagnosis = async () => {
    if (!patient) return;
    if (!currentSymptoms.trim()) {
      toast({ title: "Input Required", description: "Please enter current symptoms.", variant: "destructive" });
      return;
    }
    setIsLoadingDiagnosis(true);
    setAiDiagnosis(null);
    try {
      const input: DiagnosePatientConditionInput = { patientId: patient.id, medicalHistoryNotes: patient.medicalHistoryNotes, currentSymptoms: currentSymptoms, allergies: patient.allergies, currentMedications: patient.currentMedications, age: patient.age, gender: patient.gender as DiagnosePatientConditionInput["gender"], };
      const result = await diagnosePatientCondition(input);
      setAiDiagnosis(result);
    } catch (error) {
      console.error("Error fetching AI diagnosis:", error);
      toast({ title: "AI Diagnosis Error", description: "Could not generate diagnostic suggestions.", variant: "destructive", });
      setAiDiagnosis({ possibleConditions: [], disclaimer: "Failed to load diagnostic suggestions." });
    } finally {
      setIsLoadingDiagnosis(false);
    }
  };

  const handleGeneratePatientEducation = async () => {
    if (!patient) return;
    if (!educationConditionInput.trim()) {
        toast({ title: "Condition Required", description: "Please enter a medical condition.", variant: "destructive"});
        return;
    }
    setIsGeneratingEducation(true);
    setGeneratedEducationMaterial(null);
    try {
        const input: GeneratePatientEducationInput = { condition: educationConditionInput, patientAge: patient.age, languageLevel: educationLanguageLevel, };
        const result = await generatePatientEducation(input);
        setGeneratedEducationMaterial(result);
        toast({title: "Education Material Generated"});
    } catch (error: any) {
        console.error("Error generating patient education material:", error);
        toast({ title: "AI Education Error", description: error.message || "Could not generate material.", variant: "destructive"});
    } finally {
        setIsGeneratingEducation(false);
    }
  };

  const handleMarAction = (prescription: Prescription, action: MAR_Entry["status"]) => {
    setMarActionDialog({ open: true, prescription, action });
    setMarActionNotes("");
  };

  const submitMarAction = () => {
    if (!marActionDialog.prescription || !marActionDialog.action || !activeAdmission || !actorName) {
      toast({title: "Error", description: "Missing information to record MAR entry.", variant: "destructive"});
      return;
    }
    setIsProcessingMarAction(true);

    const newMarEntry: MAR_Entry = {
      id: `MAR-${Date.now()}`,
      prescriptionId: marActionDialog.prescription.id,
      patientId: activeAdmission.patientId,
      admissionId: activeAdmission.id,
      medicationName: marActionDialog.prescription.medicationName,
      dosage: marActionDialog.prescription.dosage,
      administrationTime: new Date().toISOString(),
      administeredBy: actorName,
      status: marActionDialog.action,
      notes: marActionNotes,
    };

    try {
      const currentMarEntriesFromStorage: MAR_Entry[] = JSON.parse(localStorage.getItem(NAVAEL_MAR_ENTRIES_STORAGE_KEY) || '[]');
      currentMarEntriesFromStorage.unshift(newMarEntry);
      localStorage.setItem(NAVAEL_MAR_ENTRIES_STORAGE_KEY, JSON.stringify(currentMarEntriesFromStorage));
      setMarEntries(currentMarEntriesFromStorage.filter(entry => entry.admissionId === activeAdmission.id));


      logActivity({
        actorRole: userRole || "System",
        actorName: actorName,
        actionDescription: `${marActionDialog.action} ${newMarEntry.medicationName} for ${patient?.name}`,
        targetEntityType: "MAR Entry",
        targetEntityId: newMarEntry.id,
        targetLink: `/dashboard/patients/${patient?.id}?view=mar`,
        iconName: "ClipboardCheck",
        details: marActionNotes ? `Notes: ${marActionNotes}` : undefined,
      });

      toast({title: "MAR Entry Recorded", description: `${newMarEntry.medicationName} ${marActionDialog.action.toLowerCase()}.`});
      setMarActionDialog({open: false});
    } catch (error) {
      console.error("Error saving MAR entry:", error);
      toast({title: "Save Error", description: "Could not save MAR entry.", variant: "destructive"});
    } finally {
      setIsProcessingMarAction(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
      return parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
    }
    if (name.length > 0) return name.substring(0, 2).toUpperCase();
    return "P";
  };

  const canPerformClinicalActions = userRole === ROLES.DOCTOR || userRole === ROLES.NURSE;
  const canViewSensitiveMedicalInfo = userRole === ROLES.DOCTOR || userRole === ROLES.NURSE || userRole === ROLES.ADMIN;
  const isPharmacistOnlyView = userRole === ROLES.PHARMACIST;
  const isReceptionistOnlyView = userRole === ROLES.RECEPTIONIST;


  const urgencyVariant = (urgency?: 'Low' | 'Medium' | 'High'): ShadBadgeProps["variant"] => {
    if (urgency === "High") return "destructive";
    if (urgency === "Medium") return "secondary";
    return "default";
  };

  const handlePrintPatientSummary = () => {
    window.print();
  };

  const handlePrintMAR = () => {
    if (!patient || !activeAdmission) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        const dueMedsHtml = patientPrescriptionsState
            .filter(rx => rx.status === "Filled" || rx.status === "Ready for Pickup")
            .map(rx => `<li>${rx.medicationName} ${rx.dosage} (Instructions: ${rx.instructions || 'N/A'})</li>`)
            .join('');

        const administeredMedsHtml = marEntries
            .sort((a, b) => new Date(b.administrationTime).getTime() - new Date(a.administrationTime).getTime())
            .map(entry => `
                <tr>
                    <td>${format(parseISO(entry.administrationTime), 'Pp dd/MM/yy')}</td>
                    <td>${entry.medicationName} ${entry.dosage}</td>
                    <td>${entry.status}</td>
                    <td>${entry.administeredBy}</td>
                    <td>${entry.notes || '---'}</td>
                </tr>
            `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>MAR - ${patient.name}</title>
                    <style>
                        body { font-family: sans-serif; margin: 20px; }
                        h1, h2 { color: #333; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.9em; }
                        th { background-color: #f2f2f2; }
                        .header-info p { margin: 2px 0; }
                        ul { padding-left: 20px; }
                    </style>
                </head>
                <body>
                    <h1>Medication Administration Record</h1>
                    <div class="header-info">
                        <p><strong>Patient:</strong> ${patient.name} (ID: ${patient.id})</p>
                        <p><strong>Admission ID:</strong> ${activeAdmission.id}</p>
                        <p><strong>Admission Date:</strong> ${format(parseISO(activeAdmission.admissionDate), 'PPP')}</p>
                        <p><strong>Printed:</strong> ${format(new Date(), 'PPP p')}</p>
                    </div>

                    <h2>Medications Currently Prescribed & Due (Based on Active Prescriptions)</h2>
                    ${dueMedsHtml.length > 0 ? `<ul>${dueMedsHtml}</ul>` : '<p>No medications currently marked as due based on active prescriptions.</p>'}

                    <h2>Administration History for this Admission</h2>
                    ${administeredMedsHtml.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Medication</th>
                                    <th>Status</th>
                                    <th>Administered By</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>${administeredMedsHtml}</tbody>
                        </table>
                    ` : '<p>No administration history recorded for this admission yet.</p>'}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
  };

  const isMedicationPendingAdminToday = (prescription: Prescription): boolean => {
    if (!activeAdmission) return false;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const hasBeenAdministeredToday = marEntries.some(entry =>
      entry.prescriptionId === prescription.id &&
      entry.admissionId === activeAdmission.id &&
      format(parseISO(entry.administrationTime), "yyyy-MM-dd") === todayStr &&
      entry.status === "Administered"
    );
    return !hasBeenAdministeredToday;
  };


  

  // src/app/dashboard/patients/[patientId]/page.tsx
// ... (Part 4 ends here) ...

  if (isLoadingOverall) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="container mx-auto p-4 text-center">
         <Alert variant="destructive" className="max-w-lg mx-auto">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Patient Not Found</AlertTitle>
          <AlertDescription>
            The patient with ID <span className="font-semibold">{patientId}</span> could not be found.
            They may have been removed or the ID is incorrect.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push("/dashboard/patients")} variant="outline" className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Patients List
        </Button>
      </div>
    );
  }

  const shouldShowFullActivityLog = searchParams.get('view') === 'activity';
  const shouldShowVitalsHistory = searchParams.get('view') === 'vitals';
  const shouldShowMAR = searchParams.get('view') === 'mar';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl md:text-3xl font-headline font-bold text-center md:text-left flex-grow">Patient Profile</h1>
        <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintPatientSummary}>
                <Printer className="mr-2 h-4 w-4" /> Print Summary
            </Button>
            <Button asChild variant="default">
            <Link href={`/dashboard/patients/${patient.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit Patient
            </Link>
            </Button>
        </div>
      </div>

      <Card className="shadow-xl overflow-hidden">
        <div className="bg-muted/30 p-6 flex flex-col md:flex-row items-center gap-6 border-b">
          <Avatar className="h-24 w-24 border-4 border-background shadow-md">
            <AvatarImage
              src={patient.profilePictureUrl || "https://placehold.co/100x100.png"}
              alt={patient.name}
              data-ai-hint="profile avatar"
            />
            <AvatarFallback className="text-3xl">{getInitials(patient.name)}</AvatarFallback>
          </Avatar>
          <div className="text-center md:text-left">
            <CardTitle className="text-3xl font-headline text-primary">{patient.name}</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">Patient ID: {patient.id}  &bull; Status: <ShadBadge variant={patient.status === "Active" ? "default" : patient.status === "Pending" ? "secondary" : "destructive"}>{patient.status}</ShadBadge></CardDescription>
          </div>
        </div>

        <CardContent className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="font-headline flex items-center"><UserCircle className="mr-2 text-primary"/>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DetailItem label="Date of Birth" value={patient.dateOfBirth && isValid(parseISO(patient.dateOfBirth)) ? format(parseISO(patient.dateOfBirth), "PPP") : "N/A"} icon={CalendarDays} />
                <DetailItem label="Age" value={`${patient.age} years`} />
                <DetailItem label="Gender" value={patient.gender} />
              </CardContent>
            </Card>
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="font-headline flex items-center"><Phone className="mr-2 text-primary"/>Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DetailItem label="Phone Number" value={patient.contactNumber} icon={Phone} />
                <DetailItem label="Email Address" value={patient.email} icon={Mail} />
                <DetailItem
                  label="Address"
                  value={patient.address && patient.address.line1 ? `${patient.address.line1}${patient.address.line2 ? `, ${patient.address.line2}` : ''}, ${patient.address.city}, ${patient.address.state} ${patient.address.postalCode}` : "Address not available"}
                  icon={MapPin}
                />
              </CardContent>
            </Card>
             <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="font-headline flex items-center"><EmergencyIcon className="mr-2 text-primary"/>Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <DetailItem label="Name" value={patient.emergencyContact?.name || "N/A"} />
                    <DetailItem label="Relationship" value={patient.emergencyContact?.relationship || "N/A"} />
                    <DetailItem label="Phone Number" value={patient.emergencyContact?.number || "N/A"} icon={Phone}/>
                </CardContent>
              </Card>
             {patient.insurance && (
              <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="font-headline flex items-center"><ListChecks className="mr-2 text-primary"/>Insurance Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <DetailItem label="Provider" value={patient.insurance.provider} />
                    <DetailItem label="Policy Number" value={patient.insurance.policyNumber} />
                </CardContent>
              </Card>
            )}
          </div>






          <div className="space-y-6">
            {(canViewSensitiveMedicalInfo && !isPharmacistOnlyView && !isReceptionistOnlyView) && (
                <>
                    <Card className="shadow-md">
                        <CardHeader>
                            <CardTitle className="font-headline flex items-center"><Sparkles className="mr-2 text-primary"/>AI Health Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoadingSummary && ( <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2"/><p className="text-muted-foreground">Generating summary...</p></div> )}
                            {!isLoadingSummary && aiSummary && ( <p className="text-sm text-foreground whitespace-pre-line">{aiSummary}</p> )}
                            {!isLoadingSummary && !aiSummary && ( <p className="text-sm text-muted-foreground">Could not load AI summary.</p> )}
                        </CardContent>
                    </Card>
                    {(userRole === ROLES.DOCTOR || userRole === ROLES.NURSE) && (
                    <Accordion type="single" collapsible className="w-full shadow-md rounded-lg border bg-card">
                        <AccordionItem value="ai-tools">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline"><div className="flex items-center"><Sparkles className="mr-3 h-6 w-6 text-primary" /><span className="font-headline text-lg">AI Clinical Assistants</span></div></AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 pt-0">
                                <Accordion type="single" collapsible className="w-full" defaultValue="ai-diagnosis-tool">
                                    <AccordionItem value="ai-diagnosis-tool"><AccordionTrigger className="text-md font-semibold hover:no-underline text-primary/90"><Brain className="mr-2 h-5 w-5"/>AI Diagnostic Assistant</AccordionTrigger>
                                        <AccordionContent className="pt-3"><div className="space-y-4">
                                            <Textarea placeholder="Enter current symptoms or reason for visit..." value={currentSymptoms} onChange={(e) => setCurrentSymptoms(e.target.value)} rows={3} className="mb-3"/>
                                            <Button onClick={handleGetAIDiagnosis} disabled={isLoadingDiagnosis || !currentSymptoms.trim()} className="w-full">{isLoadingDiagnosis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileQuestion className="mr-2 h-4 w-4" />}Get AI Diagnostic Suggestions</Button>
                                            {isLoadingDiagnosis && ( <div className="flex items-center justify-center p-4 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Generating suggestions...</div> )}
                                            {aiDiagnosis && ( <div className="mt-4 space-y-4">
                                                <Alert variant={aiDiagnosis.urgency === "High" ? "destructive" : "default"} className="border-l-4"><AlertTriangle className="h-5 w-5" /><AlertTitle className="font-semibold">Disclaimer</AlertTitle><AlertDescription className="text-xs">{aiDiagnosis.disclaimer}</AlertDescription></Alert>
                                                {aiDiagnosis.urgency && ( <div className="flex items-center"><p className="text-sm font-medium mr-2">Assessed Urgency:</p><ShadBadge variant={urgencyVariant(aiDiagnosis.urgency)}>{aiDiagnosis.urgency}</ShadBadge></div> )}
                                                {aiDiagnosis.possibleConditions.length > 0 && ( <div><h4 className="font-semibold mb-2 text-md">Possible Conditions:</h4><ul className="space-y-3">{aiDiagnosis.possibleConditions.map((cond, index) => ( <li key={index} className="p-3 border rounded-md bg-background/70"><div className="flex justify-between items-start"><p className="font-medium text-foreground">{cond.name}</p><ShadBadge variant={cond.likelihood === "High" ? "destructive" : cond.likelihood === "Medium" ? "secondary" : "outline"}>{cond.likelihood}</ShadBadge></div><p className="text-xs text-muted-foreground mt-1">{cond.reasoning}</p></li> ))}</ul></div> )}
                                                {aiDiagnosis.suggestedNextSteps && aiDiagnosis.suggestedNextSteps.length > 0 && ( <div><h4 className="font-semibold mb-2 text-md">Suggested Next Steps:</h4><ul className="list-disc list-inside pl-1 space-y-1 text-sm">{aiDiagnosis.suggestedNextSteps.map((step, index) => (<li key={index}>{step}</li>))}</ul></div> )}
                                            </div> )}
                                        </div></AccordionContent>
                                    </AccordionItem>
                                    <AccordionItem value="ai-patient-education"><AccordionTrigger className="text-md font-semibold hover:no-underline text-primary/90"><BookOpen className="mr-2 h-5 w-5"/>AI Patient Education Generator</AccordionTrigger>
                                        <AccordionContent className="pt-3"><div className="space-y-4">
                                            <Input placeholder="Enter diagnosis/condition for education material..." value={educationConditionInput} onChange={(e) => setEducationConditionInput(e.target.value)} className="mb-2"/>
                                            <Select value={educationLanguageLevel} onValueChange={(value) => setEducationLanguageLevel(value as GeneratePatientEducationInput["languageLevel"])}><SelectTrigger><SelectValue placeholder="Select language level" /></SelectTrigger><SelectContent><SelectItem value="Simple">Simple</SelectItem><SelectItem value="Standard">Standard</SelectItem><SelectItem value="Detailed">Detailed</SelectItem></SelectContent></Select>
                                            <Button onClick={handleGeneratePatientEducation} disabled={isGeneratingEducation || !educationConditionInput.trim()} className="w-full">{isGeneratingEducation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Generate Education Material</Button>
                                            {isGeneratingEducation && <div className="flex items-center justify-center p-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2"/>Generating material...</div>}
                                            {generatedEducationMaterial && ( <Card className="mt-4 bg-background/70 max-h-96 overflow-y-auto"><CardHeader className="pb-2 pt-4"><CardTitle className="text-lg">{generatedEducationMaterial.title}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
                                                <div><h5 className="font-semibold">Explanation:</h5><p className="whitespace-pre-line">{generatedEducationMaterial.explanation}</p></div>
                                                {generatedEducationMaterial.symptomsToWatch && generatedEducationMaterial.symptomsToWatch.length > 0 && ( <div><h5 className="font-semibold">Symptoms to Watch:</h5><ul className="list-disc pl-5 space-y-1">{generatedEducationMaterial.symptomsToWatch.map((s, i) => <li key={`sym-${i}`}>{s}</li>)}</ul></div> )}
                                                {generatedEducationMaterial.careTips && generatedEducationMaterial.careTips.length > 0 && ( <div><h5 className="font-semibold">Care Tips:</h5><ul className="list-disc pl-5 space-y-1">{generatedEducationMaterial.careTips.map((tip, i) => <li key={`tip-${i}`}>{tip}</li>)}</ul></div> )}
                                                {generatedEducationMaterial.whenToSeekHelp && generatedEducationMaterial.whenToSeekHelp.length > 0 && ( <div><h5 className="font-semibold">When to Seek Further Help:</h5><ul className="list-disc pl-5 space-y-1">{generatedEducationMaterial.whenToSeekHelp.map((help, i) => <li key={`help-${i}`}>{help}</li>)}</ul></div> )}
                                                <p className="text-xs italic mt-3 pt-2 border-t border-muted">{generatedEducationMaterial.disclaimer}</p>
                                            </CardContent></Card> )}
                                        </div></AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                    )}
                    <Card className="shadow-md">
                    <CardHeader><CardTitle className="font-headline flex items-center"><BriefcaseMedical className="mr-2 text-primary"/>Medical Overview</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <DetailItem label="Allergies" value={patient.allergies && patient.allergies.length > 0 ? patient.allergies.join(', ') : "None Reported"} icon={ShieldAlert}/>
<div><div className="flex items-center mb-2"><Pill className="h-5 w-5 text-primary flex-shrink-0 mr-3" /><p className="text-sm font-medium text-muted-foreground">Current Medications</p></div>{patient.currentMedications && patient.currentMedications.length > 0 ? ( <ul className="list-disc list-inside pl-1 space-y-1">{patient.currentMedications.map((med, index) => ( <li key={index} className="text-md text-foreground">{med.name} ({med.dosage}) - {med.frequency}</li> ))}</ul> ) : <p className="text-md text-foreground">None Reported</p>}</div>                        <DetailItem label="Key Medical History" value={patient.medicalHistoryNotes || "No significant history notes."} icon={FileText}/>
                    </CardContent>
                    </Card>
                </>
            )}
            {(!canViewSensitiveMedicalInfo || isPharmacistOnlyView || isReceptionistOnlyView) && ( <Card className="shadow-md"><CardHeader><CardTitle className="font-headline flex items-center text-orange-600"><ShieldAlert className="mr-2 text-orange-500"/>Access Restricted</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Detailed medical information, AI summaries, and diagnostic tools are restricted. Your role ({userRole}) has limited access to this patient's sensitive clinical data to maintain confidentiality.</p></CardContent></Card> )}
            {canPerformClinicalActions && ( <Card className="shadow-md"><CardHeader><CardTitle className="font-headline flex items-center"><PlusCircle className="mr-2 text-primary"/>Clinical Actions</CardTitle></CardHeader><CardContent className="space-y-3">
                <Button asChild variant="outline" className="w-full justify-start"><Link href={`/dashboard/consultations/new?patientId=${patient.id}`}><MessageSquareText className="mr-2 h-4 w-4" /> Start New Consultation</Link></Button>
                <Button asChild variant="outline" className="w-full justify-start"><Link href={`/dashboard/lab/order?patientId=${patient.id}`}><FlaskConical className="mr-2 h-4 w-4" /> Order Lab Test</Link></Button>
                <Button asChild variant="outline" className="w-full justify-start"><Link href={`/dashboard/pharmacy/prescribe?patientId=${patient.id}`}><Pill className="mr-2 h-4 w-4" /> Prescribe Medication</Link></Button>
                <Button asChild variant="outline" className="w-full justify-start"><Link href={`/dashboard/appointments/new?patientId=${patient.id}`}><CalendarDays className="mr-2 h-4 w-4" /> Book New Appointment</Link></Button>
            </CardContent></Card> )}
          </div>







          <div className="space-y-6">
            <Card className="shadow-md"><CardHeader><CardTitle className="font-headline flex items-center"><History className="mr-2 text-primary"/>Patient Journey</CardTitle></CardHeader><CardContent className="space-y-4">
                <DetailItem label="Last Visit" value={patient.lastVisit && isValid(parseISO(patient.lastVisit)) ? format(parseISO(patient.lastVisit), "PPP") : "N/A"}/>
                <Separator className="my-3" />
                <div><h4 className="font-semibold text-md mb-2">Upcoming Appointments</h4>{upcomingAppointmentsState.length > 0 ? ( <ul className="space-y-2">{upcomingAppointmentsState.map(app => ( <li key={app.id} className="text-sm p-2 border rounded-md bg-muted/20">
                    <div className="flex justify-between items-start"><div><span className="font-medium">{format(parseISO(app.date), "MMM d, yyyy")} at {app.time}</span><p className="text-xs text-muted-foreground">{app.type} with {app.providerName}</p></div><ShadBadge variant={getAppointmentStatusVariant(app.status)}>{app.status}</ShadBadge></div>
                    <div className="flex justify-between items-center mt-1"><span className="text-xs text-muted-foreground">Payment:</span><ShadBadge variant={getAppointmentPaymentStatusVariant(app.paymentStatus)}>{app.paymentStatus || "N/A"}</ShadBadge></div>
                    {app.invoiceId && ( <Link href="/dashboard/billing" className="text-xs text-primary hover:underline">(Invoice ID: {app.invoiceId})</Link> )}</li> ))}</ul> ) : ( <p className="text-sm text-muted-foreground">No upcoming appointments scheduled.</p> )}</div>
                <Separator className="my-3" />
                <div><h4 className="font-semibold text-md mb-2">Recent Lab Orders</h4>{patientLabOrdersState.length > 0 ? ( <ul className="space-y-2 max-h-60 overflow-y-auto">{patientLabOrdersState.map(order => ( <li key={order.id} className="text-sm p-2 border rounded-md bg-muted/20">
                    <div className="flex justify-between items-center"><span className="font-medium">Order ID: {order.id}</span><ShadBadge variant={getLabStatusVariant(order.status)}>{order.status}</ShadBadge></div>
                    <div className="flex justify-between items-center mt-1"><span className="text-xs text-muted-foreground">Payment:</span><ShadBadge variant={getLabPaymentStatusBadgeVariant(order.paymentStatus)} >{order.paymentStatus || "N/A"}</ShadBadge></div>
                    {order.invoiceId && ( <Link href="/dashboard/billing" className="text-xs text-primary hover:underline">(Invoice ID: {order.invoiceId})</Link> )}
                    <p className="text-xs text-muted-foreground">Tests: {order.tests.map(t => t.name).join(', ')}</p><p className="text-xs text-muted-foreground">Ordered: {order.orderDate ? format(parseISO(order.orderDate), "MMM d, yyyy") : "N/A"}</p>
                    {(order.status === "Results Ready" || order.status === "Cancelled") && ( <Dialog open={selectedLabOrderForModal?.id === order.id} onOpenChange={(isOpen) => { if (!isOpen) setSelectedLabOrderForModal(null); }}><DialogTrigger asChild><Button variant="link" size="xs" className="p-0 h-auto text-primary mt-1" onClick={() => setSelectedLabOrderForModal(order)}><Eye className="mr-1 h-3 w-3"/>View Full Report</Button></DialogTrigger><DialogContent className="sm:max-w-2xl md:max-w-3xl"><DialogHeader><DialogTitle className="font-headline text-xl">Lab Report Details - Order ID: {order.id}</DialogTitle><DialogDescription>Patient: {order.patientName} (ID: {order.patientId}) <br />Ordered By: {order.orderingDoctor} on {new Date(order.orderDate).toLocaleDateString()}</DialogDescription></DialogHeader><div className="max-h-[60vh] overflow-y-auto pr-2"><Table><TableHeader><TableRow><TableHead>Test Name</TableHead><TableHead>Result</TableHead><TableHead>Ref. Range</TableHead><TableHead>Price ({currency})</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{order.tests.map(test => ( <TableRow key={test.id}><TableCell className="font-medium">{test.name}</TableCell><TableCell>{test.result || "N/A"}</TableCell><TableCell>{test.referenceRange || "N/A"}</TableCell><TableCell>{test.price ? formatCurrency(test.price, currency) : 'N/A'}</TableCell><TableCell><ShadBadge variant={getLabStatusVariant(test.status)}>{test.status}</ShadBadge></TableCell></TableRow> ))}
</TableBody></Table></div><DialogFooter className="gap-2"><Button onClick={() => setSelectedLabOrderForModal(null)} variant="outline">Close</Button><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/>Print Report</Button></DialogFooter></DialogContent></Dialog> )}</li> ))}</ul> ) : ( <p className="text-sm text-muted-foreground">No lab orders found for this patient.</p> )}</div>
                <Separator className="my-3" />
                <div><h4 className="font-semibold text-md mb-2">Recent Consultations</h4>{recentConsultationsState.length > 0 ? ( <ul className="space-y-2">{recentConsultationsState.map(con => ( <li key={con.id} className="text-sm p-2 border rounded-md bg-muted/20">
                    <div className="flex justify-between items-center"><span className="font-medium">{format(parseISO(con.consultationDate), "MMM d, yyyy HH:mm")}</span></div>
                    <p className="text-xs text-muted-foreground">With: {con.doctorName}</p><p className="text-xs text-muted-foreground truncate">Reason: {con.reason || con.presentingComplaint}</p>
                    <Button variant="link" size="xs" asChild className="p-0 h-auto text-primary"><Link href={`/dashboard/consultations/${con.id}/edit`}><Eye className="mr-1 h-3 w-3"/>View Note</Link></Button></li> ))}</ul> ) : ( <p className="text-sm text-muted-foreground">No recent consultations found.</p> )}</div>
            </CardContent></Card>

            <Card className="shadow-md" id="medication-administration-record">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="font-headline flex items-center"><ClipboardCheck className="mr-2 text-primary"/>Medication Administration Record (MAR)</CardTitle>
                        {activeAdmission && <Button variant="outline" size="sm" onClick={handlePrintMAR}><Printer className="mr-2 h-4 w-4"/>Print MAR</Button>}
                    </div>
                     <CardDescription>
                        {activeAdmission ? `For current admission (ID: ${activeAdmission.id}, Admitted: ${format(parseISO(activeAdmission.admissionDate), 'PPP')})` : "No active admission found. MAR is shown for admitted patients."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!activeAdmission && <p className="text-muted-foreground">Patient is not currently admitted.</p>}
                    {activeAdmission && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold mb-2 text-md">Medications Due for Administration (from Active Prescriptions)</h4>
                                {patientPrescriptionsState.filter(rx => rx.status === "Filled" || rx.status === "Ready for Pickup").length > 0 ? (
                                    <ul className="space-y-2">
                                        {patientPrescriptionsState.filter(rx => rx.status === "Filled" || rx.status === "Ready for Pickup").map(rx => {
                                            const isPendingToday = isMedicationPendingAdminToday(rx);
                                            return (
                                                <li key={rx.id} className={`p-3 border rounded-md flex justify-between items-center ${isPendingToday ? 'bg-amber-50 border-amber-200' : 'bg-muted/30'}`}>
                                                    <div>
                                                        <span className="font-medium flex items-center">{rx.medicationName} ({rx.dosage}) {isPendingToday && <Clock className="h-4 w-4 ml-2 text-amber-600" aria-label="Pending Administration Today"/>}</span>
                                                        <p className="text-xs text-muted-foreground">Instructions: {rx.instructions || "N/A"}</p>
                                                        <p className="text-xs text-muted-foreground">Prescribed by: {rx.prescribedBy} on {format(parseISO(rx.date), 'PPP')}</p>
                                                    </div>
                                                    {(canPerformClinicalActions && (userRole === ROLES.DOCTOR || userRole === ROLES.NURSE)) && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Actions</Button></DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuItem onClick={() => handleMarAction(rx, "Administered")}>Administer</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleMarAction(rx, "Held")}>Hold Medication</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleMarAction(rx, "Refused")}>Record Patient Refusal</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleMarAction(rx, "Missed")}>Record as Missed Dose</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : ( <p className="text-sm text-muted-foreground">No active prescriptions requiring administration at this time.</p> )}
                            </div>
                            <Separator/>
                            <div>
                                <h4 className="font-semibold mb-2 text-md">Administration History for this Admission</h4>
                                {marEntries.length > 0 ? (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Medication</TableHead><TableHead>Status</TableHead><TableHead>By</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {marEntries
                                              .sort((a,b) => new Date(b.administrationTime).getTime() - new Date(a.administrationTime).getTime())
                                              .map(entry => (
                                                <TableRow key={entry.id}>
                                                    <TableCell className="text-xs">{format(parseISO(entry.administrationTime), 'Pp')}</TableCell>
                                                    <TableCell>{entry.medicationName} {entry.dosage}</TableCell>
                                                    <TableCell><ShadBadge variant={entry.status === "Administered" ? "default" : "secondary"}>{entry.status}</ShadBadge></TableCell>
                                                    <TableCell className="text-xs">{entry.administeredBy}</TableCell>
                                                    <TableCell className="text-xs max-w-[150px] truncate" title={entry.notes}>{entry.notes || "---"}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (<p className="text-sm text-muted-foreground">No administration history recorded for this admission yet.</p>)}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>


            <Card className="shadow-md"><CardHeader><CardTitle className="font-headline flex items-center"><Pill className="mr-2 text-primary"/>Prescription History</CardTitle></CardHeader><CardContent>{patientPrescriptionsState.length > 0 ? ( <div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Medication</TableHead><TableHead>Date</TableHead><TableHead>Rx Status</TableHead><TableHead>Payment</TableHead></TableRow></TableHeader><TableBody>{patientPrescriptionsState.map(rx => ( <TableRow key={rx.id}>
                    <TableCell><div className="font-medium">{rx.medicationName}</div><div className="text-xs text-muted-foreground">{rx.dosage} (Qty: {rx.quantity})</div></TableCell>
                    <TableCell>{isValid(parseISO(rx.date)) ? format(parseISO(rx.date), "PPP") : "Invalid Date"}</TableCell>
                    <TableCell><ShadBadge variant={getPrescriptionStatusVariant(rx.status)}>{rx.status}</ShadBadge></TableCell>
                    <TableCell><ShadBadge variant={getPrescriptionPaymentStatusVariant(rx.paymentStatus)}><DollarSign className="h-3 w-3 mr-1" />{rx.paymentStatus || "N/A"}</ShadBadge>{rx.invoiceId && ( <Link href="/dashboard/billing" className="ml-1 text-xs text-primary hover:underline">(Inv: {rx.invoiceId})</Link> )}
                    </TableCell></TableRow> ))}
              </TableBody></Table></div> ) : ( <p className="text-muted-foreground text-sm">No prescription history found for this patient.</p> )}
              </CardContent>
            </Card>





            <Card className="shadow-md" id="vital-signs-history">
                <CardHeader><CardTitle className="font-headline flex items-center"><HeartPulse className="mr-2 text-primary"/>Vital Signs History</CardTitle></CardHeader>
                <CardContent>{vitalSignsHistory.length > 0 ? ( <div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Temp (°C)</TableHead><TableHead>HR (bpm)</TableHead><TableHead>RR</TableHead><TableHead>BP (mmHg)</TableHead><TableHead>SpO₂ (%)</TableHead><TableHead>Recorded By</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader><TableBody>{vitalSignsHistory.map(vital => ( <TableRow key={vital.id}>
                    <TableCell className="text-xs">{isValid(parseISO(vital.timestamp)) ? format(parseISO(vital.timestamp), "MMM d, yy HH:mm") : "Invalid Date"}</TableCell>
                    <TableCell>{vital.temperature || "N/A"}</TableCell><TableCell>{vital.heartRate || "N/A"}</TableCell><TableCell>{vital.respiratoryRate || "N/A"}</TableCell><TableCell>{(vital.systolicBP && vital.diastolicBP) ? `${vital.systolicBP}/${vital.diastolicBP}` : "N/A"}</TableCell><TableCell>{vital.oxygenSaturation || "N/A"}</TableCell><TableCell className="text-xs">{vital.recordedBy}</TableCell><TableCell className="text-xs max-w-[150px] truncate" title={vital.notes}>{vital.notes || "---"}</TableCell></TableRow> ))}
                </TableBody></Table></div> ) : ( <p className="text-muted-foreground text-sm">No vital signs recorded for this patient yet.</p> )}
                </CardContent>
            </Card>

          </div>
        </CardContent>
      </Card>

        {(shouldShowFullActivityLog || shouldShowVitalsHistory || shouldShowMAR) && (
            <Card className="shadow-xl" ref={activityLogRef}>
                <CardHeader><CardTitle className="font-headline text-2xl flex items-center"><History className="mr-3 text-primary"/>Full Activity Log for {patient.name}</CardTitle><CardDescription>All recorded system interactions related to this patient.</CardDescription></CardHeader>
                <CardContent>{fullActivityLog.length > 0 ? ( <ul className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">{fullActivityLog.map(log => ( <li key={log.id} className="flex items-start space-x-3 p-3 border rounded-md bg-muted/50 shadow-sm">
                    <IconRenderer iconName={log.iconName} className="mt-1 text-primary" />
                    <div className="flex-grow"><p className="text-sm font-medium text-foreground">{log.actionDescription}</p><p className="text-xs text-muted-foreground">{isValid(parseISO(log.timestamp)) ? formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true }) : "Invalid Date"} by {log.actorName} ({log.actorRole})</p>{log.details && <p className="text-xs text-muted-foreground mt-1 bg-background/50 p-1 rounded border border-border/50">{log.details}</p>}</div></li> ))}</ul> ) : ( <p className="text-muted-foreground text-center py-4">No specific activity logged for this patient.</p> )}
                </CardContent>
            </Card>
        )}

        <Dialog open={marActionDialog.open} onOpenChange={(open) => { if (!open) setMarActionDialog({open: false}); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record MAR Action: {marActionDialog.prescription?.medicationName}</DialogTitle>
                    <DialogDescription>
                        Patient: {patient?.name} <br/>
                        Action: <span className="font-semibold">{marActionDialog.action}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Textarea
                        placeholder={
                            marActionDialog.action === "Held" ? "Reason for holding (required)" :
                            marActionDialog.action === "Administered" ? "Administration notes (optional)" :
                            marActionDialog.action === "Refused" ? "Reason for refusal (optional)" :
                            "Notes (optional)"
                        }
                        value={marActionNotes}
                        onChange={(e) => setMarActionNotes(e.target.value)}
                        rows={3}
                    />
                    {(marActionDialog.action === "Held" && !marActionNotes.trim()) &&
                        <p className="text-xs text-destructive">Reason is required for holding medication.</p>
                    }
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setMarActionDialog({open: false})}>Cancel</Button>
                    <Button
                        onClick={submitMarAction}
                        disabled={isProcessingMarAction || (marActionDialog.action === "Held" && !marActionNotes.trim())}
                    >
                        {isProcessingMarAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Confirm {marActionDialog.action}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}

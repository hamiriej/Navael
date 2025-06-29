
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parse, isValid as isValidDate } from "date-fns";
import { CalendarIcon, Loader2, NotebookPen, Search, Tag, Briefcase, AlertTriangle, DollarSign, ArrowLeft } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { usePatients, type Patient } from "@/contexts/patient-context";
import { type Invoice } from "../../billing/page"; 
import { type Shift } from "../../staff-schedule/schedule.lib"; // Kept type Shift
import { ROLES, type Role } from "@/lib/constants";
import { useSearchParams, useRouter } from "next/navigation";
import { Alert, AlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";
import { getAllStaffUsers, type MockUser } from "../../admin/user-management/page";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/contexts/auth-context";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { useAppointments } from "@/contexts/appointment-context";
import { useInvoices } from "@/contexts/invoice-context"; // Import useInvoices

const SERVICE_FEES_STORAGE_KEY = 'navael_service_fees'; 

const appointmentTypes = ["Check-up", "Consultation", "Follow-up", "Procedure"] as const;

const DEFAULT_CONSULTATION_PRICE = 75.00;
const DEFAULT_CHECKUP_PRICE = 50.00;


const appointmentBookingSchema = z.object({
  patientSearch: z.string().min(1, "Patient search is required"),
  selectedPatient: z.object({ id: z.string(), name: z.string() }).optional(),
  providerType: z.nativeEnum(ROLES, { errorMap: () => ({ message: "Please select a provider type."}) }),
  selectedProvider: z.string().min(1, "Provider is required"),
  appointmentDate: z.date({ required_error: "Appointment date is required" }),
  timeSlot: z.string().min(1, "Time slot is required"),
  appointmentType: z.enum(appointmentTypes, { required_error: "Appointment type is required" }),
});

type AppointmentBookingFormValues = z.infer<typeof appointmentBookingSchema>;

const mockTimeSlots = [
  "08:00 AM", "08:30 AM",
  "09:00 AM", "09:30 AM",
  "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM",
  "01:00 PM", "01:30 PM",
  "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM",
  "04:00 PM", "04:30 PM",
  "05:00 PM", "05:30 PM",
  "06:00 PM"
];
const bookableProviderRoles: Role[] = [ROLES.DOCTOR, ROLES.NURSE];

export default function NewAppointmentPage() {
  const { toast } = useToast();
  const { patients, getPatientById } = usePatients();
  const { userRole: actorRole, username: actorName } = useAuth();
  const { currency } = useAppearanceSettings();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { createAppointment, appointments: currentAppointments } = useAppointments();
  const { createInvoice, isLoadingInvoices } = useInvoices(); // Use InvoiceContext

  const [isSubmittingForm, setIsSubmittingForm] = useState(false); 
  const [searchedPatients, setSearchedPatients] = useState<Patient[]>([]);
  const [availableProviders, setAvailableProviders] = useState<MockUser[]>([]);
  const [selectedProviderType, setSelectedProviderType] = useState<Role | null>(null);
  const [selectedProviderOffice, setSelectedProviderOffice] = useState<string | null>(null);
  const [providerScheduleWarning, setProviderScheduleWarning] = useState<string | null>(null);
  const [currentSchedule, setCurrentSchedule] = useState<Shift[]>([]); // Initialize with empty array
  const [allStaff, setAllStaff] = useState<MockUser[]>([]);
  const [serviceFees, setServiceFees] = useState({
    consultationFee: DEFAULT_CONSULTATION_PRICE,
    checkupFee: DEFAULT_CHECKUP_PRICE,
  });


  useEffect(() => {
    setAllStaff(getAllStaffUsers());
    try {
      const storedFees = localStorage.getItem(SERVICE_FEES_STORAGE_KEY);
      if (storedFees) {
        const parsedFees = JSON.parse(storedFees);
        setServiceFees({
          consultationFee: parsedFees.consultationFee || DEFAULT_CONSULTATION_PRICE,
          checkupFee: parsedFees.checkupFee || DEFAULT_CHECKUP_PRICE,
        });
      }
    } catch (e) {
      console.error("Error loading service fees for appointments:", e);
    }
  }, []);


  useEffect(() => {
    // currentSchedule will remain empty unless populated by a future API call (not implemented here)
    // Removed loading from STAFF_SCHEDULE_STORAGE_KEY
  }, []);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SERVICE_FEES_STORAGE_KEY && event.newValue) {
        try {
          const parsedFees = JSON.parse(event.newValue);
          setServiceFees({
            consultationFee: parsedFees.consultationFee || DEFAULT_CONSULTATION_PRICE,
            checkupFee: parsedFees.checkupFee || DEFAULT_CHECKUP_PRICE,
          });
        } catch (e) { console.error("Error updating service fees from storage event", e); }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);


  const form = useForm<AppointmentBookingFormValues>({
    resolver: zodResolver(appointmentBookingSchema),
    defaultValues: {
      patientSearch: "",
      providerType: undefined,
      selectedProvider: undefined,
      timeSlot: undefined,
      appointmentType: undefined,
    },
  });

  const patientIdFromQuery = searchParams.get("patientId");
  const aiPatientName = searchParams.get("aiPatientName");
  const aiProviderName = searchParams.get("aiProviderName");
  const aiDate = searchParams.get("aiDate");
  const aiTime = searchParams.get("aiTime");
  const aiType = searchParams.get("aiType");

  useEffect(() => {
    if (patientIdFromQuery && !aiPatientName) {
        const patient = getPatientById(patientIdFromQuery);
        if (patient) {
            form.setValue("selectedPatient", { id: patient.id, name: patient.name });
            form.setValue("patientSearch", patient.name);
        } else {
            toast({ title: "Patient Not Found", description: `Could not find patient with ID: ${patientIdFromQuery}. Please search manually.`, variant: "destructive", duration: 7000});
        }
    } else if (aiPatientName) {
        const patientFromAI = patients.find(p => p.name.toLowerCase() === aiPatientName.toLowerCase());
        if (patientFromAI) {
            form.setValue("selectedPatient", { id: patientFromAI.id, name: patientFromAI.name });
            form.setValue("patientSearch", patientFromAI.name);
        } else {
            form.setValue("patientSearch", aiPatientName);
            toast({ title: "Patient Not Matched", description: `AI suggested patient "${aiPatientName}" not found in records. Please search manually or register.`, variant: "destructive", duration: 7000});
        }
    }

    if (aiProviderName && allStaff.length > 0) {
        const providerFromAI = allStaff.find(s => s.name.toLowerCase() === aiProviderName.toLowerCase() && bookableProviderRoles.includes(s.role as Role) && s.status === "Active");
        if (providerFromAI) {
            form.setValue("providerType", providerFromAI.role as Role);
            setSelectedProviderType(providerFromAI.role as Role);
            setTimeout(() => { 
              form.setValue("selectedProvider", providerFromAI.id);
              setSelectedProviderOffice(providerFromAI.officeNumber || null);
            }, 0);
        } else {
            toast({ title: "Provider Not Matched", description: `AI suggested provider "${aiProviderName}" not found, not active, or not a bookable role. Please select manually.`, variant: "destructive", duration: 7000});
        }
    }

    if (aiDate) {
        const parsedDate = parse(aiDate, "yyyy-MM-dd", new Date());
        if (isValidDate(parsedDate)) {
            form.setValue("appointmentDate", parsedDate);
        } else {
            toast({ title: "Date Needs Review", description: `AI suggested date "${aiDate}" could not be parsed. Please select the date manually.`, duration: 7000 });
        }
    }

    if (aiTime) {
        const matchedTimeSlot = mockTimeSlots.find(slot => slot.toLowerCase().includes(aiTime.toLowerCase()));
        if (matchedTimeSlot) {
            form.setValue("timeSlot", matchedTimeSlot);
        } else {
             form.setValue("timeSlot", aiTime);
             toast({ title: "Time Needs Review", description: `AI suggested time "${aiTime}". Please select a valid time slot from the list.`, duration: 7000 });
        }
    }
    if (aiType && appointmentTypes.includes(aiType as typeof appointmentTypes[number])) {
        form.setValue("appointmentType", aiType as typeof appointmentTypes[number]);
    } else if (aiType) {
        toast({ title: "Appointment Type Needs Review", description: `AI suggested type "${aiType}". Please select a valid type.`, duration: 7000});
    }

}, [patientIdFromQuery, aiPatientName, aiProviderName, aiDate, aiTime, aiType, getPatientById, form, patients, toast, allStaff]);


  const currentProviderType = form.watch("providerType");
  const currentSelectedProviderId = form.watch("selectedProvider");
  const currentAppointmentDate = form.watch("appointmentDate");

  useEffect(() => {
    if (currentProviderType) {
      setSelectedProviderType(currentProviderType);
      setAvailableProviders(allStaff.filter(staff => staff.role === currentProviderType && staff.status === 'Active'));
      form.setValue("selectedProvider", "");
      setSelectedProviderOffice(null);
      setProviderScheduleWarning(null);
    } else {
      setAvailableProviders([]);
      setSelectedProviderType(null);
      setSelectedProviderOffice(null);
      setProviderScheduleWarning(null);
    }
  }, [currentProviderType, form, allStaff]);

  useEffect(() => {
    setProviderScheduleWarning(null);
    if (currentSelectedProviderId) {
      const provider = allStaff.find(s => s.id === currentSelectedProviderId);
      setSelectedProviderOffice(provider?.officeNumber || null);
      if (provider && currentAppointmentDate && currentSchedule.length > 0) { 
        const dateString = format(currentAppointmentDate, "yyyy-MM-dd");
        const providerShiftsOnDate = currentSchedule.filter(
          (shift: Shift) => shift.staffId === currentSelectedProviderId && shift.date === dateString
        );
        if (providerShiftsOnDate.length === 0 || providerShiftsOnDate.every(s => s.shiftType === "Day Off")) {
          setProviderScheduleWarning(`${provider.name} does not appear to be scheduled on ${format(currentAppointmentDate, "PPP")}.`);
        }
      }
    } else {
      setSelectedProviderOffice(null);
    }
  }, [currentSelectedProviderId, currentAppointmentDate, currentSchedule, form, allStaff]);

  const handlePatientSearch = (searchTerm: string) => {
    if (searchTerm) {
      setSearchedPatients(
        patients.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } else {
      setSearchedPatients([]);
    }
  };

  const onSubmit = async (values: AppointmentBookingFormValues) => {
    if (!values.selectedPatient) {
        form.setError("patientSearch", { type: "manual", message: "Please select a patient from search results." });
        return;
    }
    setIsSubmittingForm(true);

    const providerDetails = allStaff.find(staff => staff.id === values.selectedProvider);
    if (!providerDetails) {
        toast({ title: "Error", description: "Selected provider not found.", variant: "destructive" });
        setIsSubmittingForm(false);
        return;
    }
    const providerName = providerDetails.name;
    const appointmentDateFormatted = format(values.appointmentDate, "yyyy-MM-dd");

    const conflictingAppointment = currentAppointments.find(app =>
        app.providerName === providerName &&
        app.date === appointmentDateFormatted &&
        app.time === values.timeSlot &&
        (app.status === "Scheduled" || app.status === "Confirmed" || app.status === "Arrived")
    );

    if (conflictingAppointment) {
        toast({
            title: "Booking Conflict",
            description: `${providerName} is already booked for ${appointmentDateFormatted} at ${values.timeSlot}. Please choose a different time or provider.`,
            variant: "destructive",
            duration: 7000,
        });
        setIsSubmittingForm(false);
        return;
    }

    let invoiceId: string | undefined = undefined;
    let paymentStatus: "Pending Payment" | "Paid" | "N/A" = "N/A";
    let servicePrice = 0;

    if (values.appointmentType === "Consultation" || values.appointmentType === "Check-up") {
      servicePrice = values.appointmentType === "Consultation" ? serviceFees.consultationFee : serviceFees.checkupFee;
      const invoiceData: Omit<Invoice, 'id'> = {
        patientId: values.selectedPatient.id,
        patientName: values.selectedPatient.name,
        date: format(new Date(), "yyyy-MM-dd"),
        dueDate: format(new Date(new Date().setDate(new Date().getDate() + 30)), "yyyy-MM-dd"),
        lineItems: [{
          description: `${values.appointmentType} with ${providerName}`,
          quantity: 1,
          unitPrice: servicePrice,
          total: servicePrice,
          sourceType: 'manual',
        }],
        subTotal: servicePrice,
        totalAmount: servicePrice,
        amountPaid: 0,
        status: "Pending Payment",
      };
      try {
        const createdInv = await createInvoice(invoiceData);
        invoiceId = createdInv.id;
        paymentStatus = "Pending Payment";
        toast({
          title: "Invoice Generated",
          description: `Invoice ${invoiceId} for ${values.appointmentType} (${formatCurrency(servicePrice, currency)}) created. Payment pending.`,
          duration: 7000,
        });
      } catch (error) {
        console.error("Error creating invoice via context:", error);
        toast({ title: "Invoice Error", description: "Could not generate invoice for the appointment.", variant: "destructive"});
        setIsSubmittingForm(false);
        return;
      }
    }

    const newAppointmentData = {
      patientId: values.selectedPatient.id,
      patientName: values.selectedPatient.name,
      providerName: providerName,
      date: appointmentDateFormatted,
      time: values.timeSlot,
      type: values.appointmentType,
      status: "Scheduled" as const,
      invoiceId: invoiceId,
      paymentStatus: paymentStatus,
    };

    try {
      const createdAppt = await createAppointment(newAppointmentData);
      console.log("New Appointment Data:", createdAppt);
      toast({
        title: "Appointment Booked",
        description: `${values.appointmentType} for ${values.selectedPatient.name} with ${createdAppt.providerName} on ${format(values.appointmentDate, "PPP")} at ${values.timeSlot} has been successfully booked.`,
      });
      form.reset({
          patientSearch: "",
          selectedPatient: undefined,
          providerType: undefined,
          selectedProvider: undefined,
          appointmentDate: undefined,
          timeSlot: undefined,
          appointmentType: undefined,
      });
      setSearchedPatients([]);
      setAvailableProviders([]);
      setSelectedProviderType(null);
      setSelectedProviderOffice(null);
      setProviderScheduleWarning(null);
    } catch (error) {
      console.error("Error creating appointment via context:", error);
      toast({ title: "Booking Error", description: "Could not book appointment.", variant: "destructive" });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const currentSelectedPatientName = useMemo(() => {
    return form.getValues("selectedPatient")?.name;
  }, [form.watch("selectedPatient")]);


  return (
    <div className="space-y-6">
        <Button variant="outline" onClick={() => router.back()} className="mb-4" disabled={isSubmittingForm || isLoadingInvoices}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
            <div className="flex items-center space-x-2">
            <NotebookPen className="h-6 w-6 text-primary" />
            <CardTitle className="font-headline text-2xl">Book New Appointment</CardTitle>
            </div>
            <CardDescription>Fill in the details below to schedule an appointment. For consultations (fee: {formatCurrency(serviceFees.consultationFee, currency)}) and check-ups (fee: {formatCurrency(serviceFees.checkupFee, currency)}), an invoice will be generated automatically.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                control={form.control}
                name="patientSearch"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Search Patient</FormLabel>
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
                            disabled={!!patientIdFromQuery}
                        />
                        </FormControl>
                    </div>
                    {searchedPatients.length > 0 && !patientIdFromQuery && (
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

                <FormField
                control={form.control}
                name="providerType"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Provider Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select provider type" /></SelectTrigger></FormControl>
                        <SelectContent>
                        {bookableProviderRoles.map(role => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="selectedProvider"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Provider Name</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProviderType || availableProviders.length === 0}>
                        <FormControl><SelectTrigger><SelectValue placeholder={!selectedProviderType ? "Select provider type first" : "Select a provider"} /></SelectTrigger></FormControl>
                        <SelectContent>
                        {availableProviders.map(provider => (
                            <SelectItem key={provider.id} value={provider.id}>{provider.name} ({provider.role})</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    {availableProviders.length === 0 && selectedProviderType && <FormDescription>No active {selectedProviderType}s found.</FormDescription>}
                    {selectedProviderOffice && (
                        <FormDescription className="flex items-center text-sm text-muted-foreground mt-1">
                        <Briefcase className="mr-2 h-4 w-4 text-primary/80" /> Office: {selectedProviderOffice}
                        </FormDescription>
                    )}
                    <FormMessage />
                    </FormItem>
                )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="appointmentDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Appointment Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1)) } initialFocus />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name="timeSlot" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Time Slot</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a time slot" /></SelectTrigger></FormControl>
                        <SelectContent>
                        {mockTimeSlots.map(ts => <SelectItem key={ts} value={ts}>{ts}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )} />
                </div>

                {providerScheduleWarning && (
                <Alert variant="default" className="border-yellow-500 text-yellow-700 bg-yellow-50">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <AlertTitle className="font-semibold text-yellow-700">Schedule Note</AlertTitle>
                    <ShadAlertDescription className="text-yellow-600">
                    {providerScheduleWarning} Booking can proceed but please verify with provider if needed.
                    </ShadAlertDescription>
                </Alert>
                )}


                <FormField control={form.control} name="appointmentType" render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Tag className="mr-2 h-4 w-4 text-muted-foreground"/>Appointment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select appointment type" /></SelectTrigger></FormControl>
                    <SelectContent>
                        {appointmentTypes.map(type => <SelectItem key={type} value={type}>{type} ({type === "Consultation" || type === "Check-up" ? <span className="inline-flex items-center"><DollarSign className="h-3 w-3 mr-1"/>Invoice Auto-Generated</span> : "Invoice Manual"})</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )} />

                <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmittingForm || isLoadingInvoices}>
                    {(isSubmittingForm || isLoadingInvoices) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Book Appointment
                </Button>
                </div>
            </form>
            </Form>
        </CardContent>
        </Card>
    </div>
  );
}


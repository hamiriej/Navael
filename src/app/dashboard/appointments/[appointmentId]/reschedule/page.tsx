
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { type Appointment } from "../../page"; // Use type from main page
import { getAllStaffUsers, type MockUser } from "@/app/dashboard/admin/user-management/page";
import { ROLES, type Role } from "@/lib/constants";
import { CalendarIcon as CalendarLucideIcon } from "lucide-react";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/contexts/auth-context";
import { useAppointments } from "@/contexts/appointment-context"; // Import useAppointments

const appointmentTypes = ["Check-up", "Consultation", "Follow-up", "Procedure"] as const;
const mockTimeSlots = [
  "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM",
  "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
  "05:00 PM", "05:30 PM", "06:00 PM"
];
const bookableProviderRoles: Role[] = [ROLES.DOCTOR, ROLES.NURSE];

const rescheduleSchema = z.object({
  providerId: z.string().min(1, "Provider is required"),
  appointmentDate: z.date({ required_error: "New appointment date is required" }),
  timeSlot: z.string().min(1, "New time slot is required"),
  appointmentType: z.enum(appointmentTypes, { required_error: "Appointment type is required" }),
  rescheduleReason: z.string().optional(),
});

type RescheduleFormValues = z.infer<typeof rescheduleSchema>;

export default function RescheduleAppointmentPage() {
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.appointmentId as string;
  const { toast } = useToast();
  const { userRole: actorRole, username: actorName } = useAuth();
  const { fetchAppointmentById, updateAppointment, isLoadingAppointments } = useAppointments(); // Use context

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<MockUser[]>([]);

  const form = useForm<RescheduleFormValues>({
    resolver: zodResolver(rescheduleSchema),
  });

  useEffect(() => {
    const loadData = async () => {
      const staff = getAllStaffUsers().filter(s => bookableProviderRoles.includes(s.role) && s.status === 'Active');
      setAvailableProviders(staff);

      if (appointmentId) {
        const currentAppointment = await fetchAppointmentById(appointmentId); // Use context
        if (currentAppointment) {
          setAppointment(currentAppointment);
          const provider = staff.find(s => s.name === currentAppointment.providerName);
          form.reset({
            providerId: provider?.id || "",
            appointmentDate: parseISO(currentAppointment.date),
            timeSlot: currentAppointment.time,
            appointmentType: currentAppointment.type,
            rescheduleReason: "",
          });
        } else {
          toast({ title: "Error", description: "Appointment not found.", variant: "destructive" });
          router.replace("/dashboard/appointments");
        }
      }
    };
    loadData();
  }, [appointmentId, form, router, toast, fetchAppointmentById]);

  const onSubmit = async (values: RescheduleFormValues) => {
    if (!appointment) return;
    setIsSubmitting(true);

    const providerDetails = availableProviders.find(p => p.id === values.providerId);
    if (!providerDetails) {
        toast({ title: "Error", description: "Selected provider not found.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }

    const newAppointmentDate = format(values.appointmentDate, "yyyy-MM-dd");

    const updatedAppointmentData: Partial<Omit<Appointment, 'id'>> = {
      providerName: providerDetails.name,
      date: newAppointmentDate,
      time: values.timeSlot,
      type: values.appointmentType,
      status: "Scheduled",
    };

    try {
      const updatedAppt = await updateAppointment(appointmentId, updatedAppointmentData); // Use context
      if (updatedAppt) {
        logActivity({
          actorRole: actorRole || "System",
          actorName: actorName || "System",
          actionDescription: `Rescheduled appointment ${appointment.id} for ${appointment.patientName} to ${newAppointmentDate} at ${values.timeSlot} with ${providerDetails.name}. Reason: ${values.rescheduleReason || 'Not provided'}.`,
          targetEntityType: "Appointment",
          targetEntityId: appointment.id,
          iconName: "CalendarClock",
        });

        toast({
          title: "Appointment Rescheduled",
          description: `Appointment for ${appointment.patientName} has been successfully rescheduled.`,
        });
        router.push("/dashboard/appointments");
      } else {
        toast({ title: "Update Error", description: "Could not update appointment via context.", variant: "destructive"});
      }
    } catch (e) {
      console.error("Error saving rescheduled appointment:", e);
      toast({ title: "Save Error", description: "Could not save rescheduled appointment.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingAppointments || !appointment) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
       <Button variant="outline" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Appointments
        </Button>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Reschedule Appointment</CardTitle>
          <CardDescription>
            Modifying appointment for: <span className="font-semibold">{appointment.patientName}</span> (ID: {appointment.id})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-3 border rounded-md bg-muted/50 text-sm">
            <p><span className="font-medium">Current Provider:</span> {appointment.providerName}</p>
            <p><span className="font-medium">Current Date & Time:</span> {format(parseISO(appointment.date), "PPP")} at {appointment.time}</p>
            <p><span className="font-medium">Current Type:</span> {appointment.type}</p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="providerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Provider</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select new provider" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {availableProviders.map(provider => (
                          <SelectItem key={provider.id} value={provider.id}>{provider.name} ({provider.role})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="appointmentDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>New Appointment Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                            {field.value ? format(field.value, "PPP") : <span>Pick a new date</span>}
                            <CalendarLucideIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="timeSlot" render={({ field }) => (
                    <FormItem>
                    <FormLabel>New Time Slot</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select new time slot" /></SelectTrigger></FormControl>
                        <SelectContent>
                        {mockTimeSlots.map(ts => <SelectItem key={ts} value={ts}>{ts}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="appointmentType" render={({ field }) => (
                <FormItem>
                    <FormLabel>Appointment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select appointment type" /></SelectTrigger></FormControl>
                    <SelectContent>
                        {appointmentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="rescheduleReason" render={({ field }) => (
                <FormItem>
                    <FormLabel>Reason for Reschedule (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Enter reason if any..." {...field} rows={3} /></FormControl>
                    <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

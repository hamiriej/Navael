"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Lightbulb, NotebookPen, MoreHorizontal, Clock, UserCircle, Tag, Eye, Edit, Trash2, CheckCircle, DollarSign, Printer, CheckSquare, Loader2, AlertTriangle as AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { ROLES } from "@/lib/constants";
import { useState, useMemo, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isBefore } from "date-fns";
import { usePatients } from "@/contexts/patient-context";
import { useAppointments } from "@/contexts/appointment-context";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog"; // Or wherever your AlertDialog components are defined
import { onSnapshot } from "firebase/firestore";


export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  providerName: string;
  time: string;
  date: string; // YYYY-MM-DD format
  type: "Check-up" | "Consultation" | "Follow-up" | "Procedure";
  status: "Scheduled" | "Confirmed" | "Cancelled" | "Completed" | "Arrived";
  invoiceId?: string;
  paymentStatus?: "Pending Payment" | "Paid" | "N/A";
}

export const APPOINTMENTS_STORAGE_KEY = "navael_appointments";

export const statusBadgeVariant = (status: Appointment["status"]): BadgeProps["variant"] => {
  switch (status) {
    case "Scheduled": return "secondary";
    case "Confirmed": return "default";
    case "Arrived": return "default";
    case "Cancelled": return "destructive";
    case "Completed": return "outline";
    default: return "default";
  }
};

export const paymentStatusBadgeVariant = (status?: Appointment["paymentStatus"]): BadgeProps["variant"] => {
  switch (status) {
    case "Paid": return "default";
    case "Pending Payment": return "secondary";
    default: return "outline";
  }
};

export default function AppointmentsPage() {
  const { userRole, username } = useAuth();
  const { toast } = useToast();
  const { getPatientById, updatePatient } = usePatients();
  const { 
    appointments, 
    isLoadingAppointments, 
    cancelAppointment, 
    updateAppointment,
    error: appointmentsError,
    fetchAppointments
  } = useAppointments();
  
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [appointmentToPrint, setAppointmentToPrint] = useState<Appointment | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const displayedAppointments = useMemo(() => {
    if (!userRole) return [];
    const sortedAppointments = [...appointments].sort((a, b) => {
        const aDate = parseISO(a.date);
        const bDate = parseISO(b.date);
        const now = new Date();
        now.setHours(0,0,0,0);
        const aIsUpcoming = aDate >= now && a.status !== "Completed" && a.status !== "Cancelled";
        const bIsUpcoming = bDate >= now && b.status !== "Completed" && b.status !== "Cancelled";
        if (aIsUpcoming && !bIsUpcoming) return -1;
        if (!aIsUpcoming && bIsUpcoming) return 1;
        if (aIsUpcoming && bIsUpcoming) {
            const dateComparison = aDate.getTime() - bDate.getTime();
            if (dateComparison !== 0) return dateComparison;
            return a.time.localeCompare(b.time);
        }
        const dateComparison = bDate.getTime() - aDate.getTime();
        if (dateComparison !== 0) return dateComparison;
        return a.time.localeCompare(b.time);
    });
    if (userRole === ROLES.DOCTOR || userRole === ROLES.NURSE) {
      return sortedAppointments.filter(app => app.providerName === username);
    }
    return sortedAppointments;
  }, [appointments, userRole, username]);

  const handleConfirmCancelAppointment = async () => {
    if (appointmentToCancel) {
      setActionLoading(true);
      try {
        await cancelAppointment(appointmentToCancel.id);
        toast({
          title: "Appointment Cancelled",
          description: `Appointment for ${appointmentToCancel.patientName} has been cancelled.`,
          variant: "destructive"
        });
      } catch (error: any) {
        toast({
            title: "Cancellation Failed",
            description: error.message || "Could not cancel the appointment.",
            variant: "destructive"
        });
      }
      setAppointmentToCancel(null);
      setActionLoading(false);
    }
  };

  const handleCheckInAppointment = async (appointmentId: string) => {
    setActionLoading(true);
    const appToUpdate = appointments.find(app => app.id === appointmentId);
    if (appToUpdate) {
      try {
        await updateAppointment(appointmentId, { status: "Arrived" });
        toast({
          title: "Patient Checked In",
          description: `Patient ${appToUpdate.patientName} has been marked as arrived.`,
        });
      } catch (error: any) {
         toast({ title: "Check-in Failed", description: error.message || "Could not check in patient.", variant: "destructive"});
      }
    }
    setActionLoading(false);
  };

  const handleCompleteVisit = async (appointmentId: string) => {
    setActionLoading(true);
    const appToUpdate = appointments.find(app => app.id === appointmentId);
    if (appToUpdate && appToUpdate.status === "Arrived") {
      try {
        await updateAppointment(appointmentId, { status: "Completed" });
        const patient = await getPatientById(appToUpdate.patientId); 
        if (patient) {
          const appointmentDate = parseISO(appToUpdate.date);
          const lastVisitDate = patient.lastVisit ? parseISO(patient.lastVisit) : null;
          if (!lastVisitDate || isBefore(lastVisitDate, appointmentDate)) {
            await updatePatient(patient.id, { ...patient, lastVisit: appToUpdate.date });
          }
        }
        toast({
          title: "Visit Completed",
          description: `Appointment for ${appToUpdate.patientName} marked as completed.`,
        });
      } catch (error: any) {
         toast({ title: "Completion Failed", description: error.message || "Could not complete visit.", variant: "destructive"});
      }
    }
    setActionLoading(false);
  };

  const handlePrintSlip = () => {
    const printContent = document.getElementById('appointment-slip-content');
    if (printContent) {
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = printContent.innerHTML;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload(); 
    }
  };

  const canManageAppointments = userRole === ROLES.RECEPTIONIST || userRole === ROLES.ADMIN;

  if (isLoadingAppointments && displayedAppointments.length === 0) {
    return (
      <div className="flex items-center justify-center p-10 min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" /> 
        <p className="ml-3 text-muted-foreground">Loading appointments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <CalendarDays className="mr-3 h-8 w-8 text-primary" /> Appointments
          </h1>
          <p className="text-muted-foreground">Manage and view appointments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/schedule-optimizer">
             <Button variant="outline">
                <Lightbulb className="mr-2 h-4 w-4" />
                Optimize Schedule
             </Button>
          </Link>
          {canManageAppointments && (
            <Link href="/dashboard/appointments/new">
              <Button>
                <NotebookPen className="mr-2 h-4 w-4" /> Book New Appointment
              </Button>
            </Link>
          )}
        </div>
      </div>

      {appointmentsError && (
        <Alert variant="destructive" className="my-4">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Error Fetching Appointments</AlertTitle>
          <ShadAlertDescription>
            {appointmentsError} Please try again.
            <Button variant="link" onClick={() => fetchAppointments()} className="p-0 h-auto ml-2">Retry</Button>
          </ShadAlertDescription>
        </Alert>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Upcoming & Recent Appointments</CardTitle>
          <CardDescription>
            A list of scheduled appointments, sorted by date. {(userRole === ROLES.DOCTOR || userRole === ROLES.NURSE) && "Showing appointments assigned to you."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAppointments && displayedAppointments.length === 0 ? (
             <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading...</p>
             </div>
          ) : !isLoadingAppointments && appointmentsError === null && displayedAppointments.length === 0 ? (
             <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/30 rounded-md p-6 text-center">
              <CalendarDays className="h-24 w-24 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">
                {(userRole === ROLES.DOCTOR || userRole === ROLES.NURSE) ? "No upcoming appointments assigned to you." : "No Upcoming Appointments"}
              </p>
              {canManageAppointments && (
                <p className="text-sm text-muted-foreground mt-1">
                    Use the button above to book a new appointment.
                </p>
              )}
            </div>
          ) : displayedAppointments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><UserCircle className="inline-block mr-1 h-4 w-4 text-muted-foreground"/>Patient</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead><Clock className="inline-block mr-1 h-4 w-4 text-muted-foreground"/>Date & Time</TableHead>
                  <TableHead><Tag className="inline-block mr-1 h-4 w-4 text-muted-foreground"/>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><DollarSign className="inline-block mr-1 h-4 w-4 text-muted-foreground"/>Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedAppointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/patients/${appointment.patientId}`} className="hover:underline text-primary">
                        {appointment.patientName}
                      </Link>
                    </TableCell>
                    <TableCell>{appointment.providerName}</TableCell>
                    <TableCell>{format(parseISO(appointment.date), "PPP")} at {appointment.time}</TableCell>
                    <TableCell>{appointment.type}</TableCell>
                    <TableCell>
                      <Badge
                        variant={statusBadgeVariant(appointment.status)}
                        className={appointment.status === 'Arrived' ? 'bg-green-500 text-white dark:bg-green-600 dark:text-white' : (appointment.status === "Completed" ? "bg-blue-500 text-white dark:bg-blue-600 dark:text-white" : "")}
                      >
                        {appointment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={paymentStatusBadgeVariant(appointment.paymentStatus)}>
                        {appointment.paymentStatus || "N/A"}
                      </Badge>
                      {appointment.invoiceId && (
                        <Link href="/dashboard/billing" className="ml-1 text-xs text-primary hover:underline">
                          (ID: {appointment.invoiceId})
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                       <AlertDialog open={appointmentToCancel?.id === appointment.id} onOpenChange={(isOpen) => { if (!isOpen) setAppointmentToCancel(null); }}>
                        <Dialog open={appointmentToPrint?.id === appointment.id} onOpenChange={(isOpen) => { if (!isOpen) setAppointmentToPrint(null); }}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={actionLoading}>
                              {actionLoading && <Loader2 className="h-4 w-4 animate-spin"/>}
                              {!actionLoading && <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                             <DropdownMenuItem asChild>
                                <Link href={`/dashboard/patients/${appointment.patientId}`}>
                                    <Eye className="mr-2 h-4 w-4"/>View Patient Details
                                </Link>
                            </DropdownMenuItem>
                            {canManageAppointments && (appointment.status === "Scheduled" || appointment.status === "Confirmed") && (
                                appointment.paymentStatus === "Paid" ? (
                                <DropdownMenuItem onClick={() => handleCheckInAppointment(appointment.id)} disabled={actionLoading}>
                                    <CheckCircle className="mr-2 h-4 w-4 text-green-600"/> Check-in Patient
                                </DropdownMenuItem>
                                ) : (
                                     <DropdownMenuItem disabled>
                                        <CheckCircle className="mr-2 h-4 w-4 text-muted-foreground"/> Check-in (Payment Pending)
                                    </DropdownMenuItem>
                                )
                            )}
                            {canManageAppointments && appointment.status === "Arrived" && (
                                <DropdownMenuItem onClick={() => handleCompleteVisit(appointment.id)} disabled={actionLoading}>
                                    <CheckSquare className="mr-2 h-4 w-4 text-blue-600"/> Complete Visit
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild>
                                <Link href={`/dashboard/appointments/${appointment.id}/reschedule`}>
                                    <Edit className="mr-2 h-4 w-4"/>Reschedule
                                </Link>
                            </DropdownMenuItem>
                             <DialogTrigger asChild>
                                <DropdownMenuItem onClick={() => setAppointmentToPrint(appointment)}>
                                    <Printer className="mr-2 h-4 w-4" /> Print Slip
                                </DropdownMenuItem>
                            </DialogTrigger>
                            {(appointment.status === "Scheduled" || appointment.status === "Confirmed" || appointment.status === "Arrived") && (
                              <>
                                <DropdownMenuSeparator />
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                                    onClick={() => setAppointmentToCancel(appointment)}
                                    disabled={actionLoading}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Cancel Appointment
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                         <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action will cancel the appointment for {appointmentToCancel?.patientName}.
                                This cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setAppointmentToCancel(null)} disabled={actionLoading}>Keep Appointment</AlertDialogCancel>
                                <AlertDialogAction onClick={handleConfirmCancelAppointment} className={buttonVariants({variant: "destructive"})} disabled={actionLoading}>
                                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Confirm Cancellation
                                </AlertDialogAction>
                            </AlertDialogFooter>
                         </AlertDialogContent>
                         <DialogContent className="sm:max-w-md" id="appointment-slip-content-wrapper">
                            <DialogHeader>
                                <DialogTitle className="font-headline text-lg">Appointment Slip</DialogTitle>
                                <DialogDescription>Please present this slip upon arrival.</DialogDescription>
                            </DialogHeader>
                            {appointmentToPrint && (
                            <div id="appointment-slip-content" className="space-y-3 py-4">
                                <h3 className="text-center text-xl font-semibold text-primary">{appointmentToPrint.type}</h3>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-b py-3 my-2">
                                    <p className="font-medium">Patient:</p>         <p>{appointmentToPrint.patientName}</p>
                                    <p className="font-medium">Appointment ID:</p>   <p>{appointmentToPrint.id}</p>
                                    <p className="font-medium">Provider:</p>        <p>{appointmentToPrint.providerName}</p>
                                    <p className="font-medium">Date:</p>            <p>{format(parseISO(appointmentToPrint.date), "MMMM d, yyyy")}</p>
                                    <p className="font-medium">Time:</p>            <p>{appointmentToPrint.time}</p>
                                    <p className="font-medium">Status:</p>          <p><Badge variant={statusBadgeVariant(appointmentToPrint.status)}>{appointmentToPrint.status}</Badge></p>
                                </div>
                                <p className="text-xs text-muted-foreground text-center">Navael Healthcare Clinic - Thank you!</p>
                            </div>
                            )}
                            <DialogFooter className="sm:justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setAppointmentToPrint(null)}>Close</Button>
                                <Button type="button" onClick={handlePrintSlip}><Printer className="mr-2 h-4 w-4"/>Print</Button>
                            </DialogFooter>
                         </DialogContent>
                        </Dialog>
                       </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null }
        </CardContent>
      </Card>
    </div>
  );
}

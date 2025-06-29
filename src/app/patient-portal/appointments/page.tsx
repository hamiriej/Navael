"use client";

import { useEffect, useState, useMemo } from "react";
import { usePatientAuth } from "@/contexts/patient-auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarDays, ArrowLeft, Eye } from "lucide-react";
import { type Appointment, statusBadgeVariant as getAppointmentStatusVariant, paymentStatusBadgeVariant as getAppointmentPaymentStatusVariant } from "@/app/dashboard/appointments/page";
import { format, parseISO, isBefore, isToday as checkIsTodayDate, isFuture } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DollarSign } from "lucide-react";
import { useAppointments } from "@/contexts/appointment-context";

export default function PatientAppointmentsPage() {
  const { patientId, patientName, isLoading: authLoading } = usePatientAuth();
  const { appointments: allSystemAppointments, isLoadingAppointments: isLoadingSystemAppointments, getAppointmentsForPatient } = useAppointments();
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadPatientAppointments = async () => {
      if (patientId && !isLoadingSystemAppointments) {
        setIsLoadingPageData(true);
        const fetchedAppointments = await getAppointmentsForPatient(patientId);
        setPatientAppointments(fetchedAppointments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.time.localeCompare(a.time)));
        setIsLoadingPageData(false);
      } else if (!patientId && !authLoading) {
        setIsLoadingPageData(false);
      }
    };
    loadPatientAppointments();
  }, [patientId, authLoading, isLoadingSystemAppointments, getAppointmentsForPatient]);

  const isLoading = authLoading || isLoadingSystemAppointments || isLoadingPageData;

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading your appointments...</p>
      </div>
    );
  }

  if (!patientId) {
     return (
      <div className="text-center py-10">
        <p className="text-lg text-muted-foreground">Please log in to view your appointments.</p>
        <Button asChild className="mt-4">
            <Link href="/patient-portal/login">Go to Login</Link>
        </Button>
      </div>
    );
  }

  const upcomingAppointments = patientAppointments.filter(app => (isFuture(parseISO(app.date)) || checkIsTodayDate(parseISO(app.date))) && (app.status === "Scheduled" || app.status === "Confirmed" || app.status === "Arrived"));
  const pastAppointments = patientAppointments.filter(app => isBefore(parseISO(app.date), new Date()) && !checkIsTodayDate(parseISO(app.date)) || app.status === "Completed" || app.status === "Cancelled");


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-headline font-bold flex items-center">
                <CalendarDays className="mr-3 h-7 w-7 text-primary" /> My Appointments
            </h1>
            <p className="text-muted-foreground">View your upcoming and past appointments, {patientName}.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Upcoming Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingPageData && upcomingAppointments.length === 0 ? (
            <div className="flex items-center justify-center p-4 min-h-[100px]">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2"/>
                <p className="text-muted-foreground">Checking for upcoming appointments...</p>
            </div>
          ) : upcomingAppointments.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Date & Time</TableHead><TableHead>Provider</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead></TableRow></TableHeader>
              <TableBody>
                {upcomingAppointments.map(app => (
                  <TableRow key={app.id}>
                    <TableCell>{format(parseISO(app.date), "MMM d, yyyy")} at {app.time}</TableCell>
                    <TableCell>{app.providerName}</TableCell>
                    <TableCell>{app.type}</TableCell>
                    <TableCell><Badge variant={getAppointmentStatusVariant(app.status)}>{app.status}</Badge></TableCell>
                    <TableCell>
                        <Badge variant={getAppointmentPaymentStatusVariant(app.paymentStatus)} className="text-xs">
                           <DollarSign className="mr-1 h-3 w-3"/> {app.paymentStatus || "N/A"}
                        </Badge>
                        {app.invoiceId && <span className="text-xs text-muted-foreground ml-1">(Inv: {app.invoiceId})</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground p-4 text-center">You have no upcoming appointments.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Past Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingPageData && pastAppointments.length === 0 ? (
            <div className="flex items-center justify-center p-4 min-h-[100px]">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2"/>
                <p className="text-muted-foreground">Loading past appointments...</p>
            </div>
          ) : pastAppointments.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Date & Time</TableHead><TableHead>Provider</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead></TableRow></TableHeader>
              <TableBody>
                {pastAppointments.map(app => (
                  <TableRow key={app.id}>
                    <TableCell>{format(parseISO(app.date), "MMM d, yyyy")} at {app.time}</TableCell>
                    <TableCell>{app.providerName}</TableCell>
                    <TableCell>{app.type}</TableCell>
                    <TableCell><Badge variant={getAppointmentStatusVariant(app.status)}>{app.status}</Badge></TableCell>
                    <TableCell>
                        <Badge variant={getAppointmentPaymentStatusVariant(app.paymentStatus)} className="text-xs">
                           <DollarSign className="mr-1 h-3 w-3"/> {app.paymentStatus || "N/A"}
                        </Badge>
                        {app.invoiceId && <span className="text-xs text-muted-foreground ml-1">(Inv: {app.invoiceId})</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground p-4 text-center">You have no past appointments.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import { usePatientAuth } from "@/contexts/patient-auth-context";
import { usePatients, type Patient } from "@/contexts/patient-context";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarDays, Eye, ShieldAlert, Pill, FlaskConical, CreditCard } from "lucide-react";
import Link from "next/link";
import { type Appointment, statusBadgeVariant as getAppointmentStatusVariant } from "@/app/dashboard/appointments/page";
import { format, parseISO, isFuture, isToday as checkIsTodayDate } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useAppointments } from "@/contexts/appointment-context";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";


const quickActionButtons = [
    { label: "My Appointments", icon: CalendarDays, href: "/patient-portal/appointments", comingSoon: false },
    { label: "My Lab Results", icon: FlaskConical, href: "/patient-portal/lab-results", comingSoon: false },
    { label: "My Medications", icon: Pill, href: "/patient-portal/medications", comingSoon: false },
    { label: "Billing & Invoices", icon: CreditCard, href: "/patient-portal/billing", comingSoon: false },
];

export default function PatientPortalDashboardPage() {
  const { patientName, patientId, isLoading: authLoading } = usePatientAuth();
  const { getPatientById, isLoading: patientsLoading } = usePatients();
  const { getAppointmentsForPatient, isLoadingAppointments: isLoadingSystemAppointments } = useAppointments();

  const [patientDetails, setPatientDetails] = useState<Patient | null>(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);

  useEffect(() => {
    if (patientId && !patientsLoading) {
      const loadPatient = async () => {
        const details = await getPatientById(patientId);
        setPatientDetails(details || null);
      }
      loadPatient();
    }
  }, [patientId, getPatientById, patientsLoading]);

  useEffect(() => {
    const loadAppointments = async () => {
      if (patientId && !isLoadingSystemAppointments) {
        setIsLoadingPageData(true);
        const fetchedAppointments = await getAppointmentsForPatient(patientId);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const filtered = fetchedAppointments
          .filter(app => 
                         (isFuture(parseISO(app.date)) || checkIsTodayDate(parseISO(app.date))) &&
                         (app.status === "Scheduled" || app.status === "Confirmed" || app.status === "Arrived")
                 )
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.time.localeCompare(b.time))
          .slice(0, 5);
        setUpcomingAppointments(filtered);
        setIsLoadingPageData(false);
      } else if (!patientId && !authLoading) {
        setIsLoadingPageData(false);
      }
    };
    loadAppointments();
  }, [patientId, isLoadingSystemAppointments, getAppointmentsForPatient, authLoading]);

  const isLoading = authLoading || patientsLoading || isLoadingPageData;

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  if (!patientName || !patientDetails) {
    return (
       <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
         <Alert variant="destructive" className="max-w-md">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription>
                Could not load your information. Please try logging out and back in, or contact the clinic if the issue persists.
            </AlertDescription>
             <Button asChild className="mt-4">
                <Link href="/patient-portal/login">Return to Login</Link>
            </Button>
        </Alert>
       </div>
    );
  }
  
  return (
    <div className="space-y-8">
        <Card className="shadow-md bg-muted/20">
            <CardHeader>
                <CardTitle className="text-3xl font-headline">Welcome, {patientName}</CardTitle>
                <CardDescription>
                    Here you can view your upcoming appointments, lab results, billing information, and access other health services.
                </CardDescription>
            </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActionButtons.map((action) => (
                <Card key={action.label} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <action.icon className="h-10 w-10 text-primary mb-3" />
                        <h3 className="font-semibold text-md">{action.label}</h3>
                        {action.comingSoon && <Badge variant="outline" className="mt-1">Coming Soon</Badge>}
                    </CardContent>
                    <CardFooter className="p-2 pt-0">
                        {action.comingSoon ? (
                             <Button variant="outline" className="w-full" disabled>Coming Soon</Button>
                        ) : (
                            <Button variant="default" className="w-full" asChild>
                                <Link href={action.href}>Go to {action.label}</Link>
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            ))}
        </div>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="font-headline text-lg flex items-center">
                <CalendarDays className="mr-2 h-5 w-5 text-primary" /> Your Next Appointments
            </CardTitle>
            <CardDescription>A quick look at what's coming up.</CardDescription>
          </CardHeader>
          <CardContent>
              {isLoadingPageData && upcomingAppointments.length === 0 ? (
                <div className="flex items-center justify-center p-4 min-h-[100px]">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2"/>
                    <p className="text-muted-foreground">Checking for upcoming appointments...</p>
                </div>
              ) : upcomingAppointments.length > 0 ? (
                  <ul className="space-y-3">
                    {upcomingAppointments.map(app => (
                      <li key={app.id} className="p-3 border rounded-md hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{format(parseISO(app.date), "EEEE, MMM d, yyyy")} at {app.time}</p>
                            <p className="text-sm text-muted-foreground">{app.type} with {app.providerName}</p>
                          </div>
                           <Badge variant={getAppointmentStatusVariant(app.status)}>{app.status}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
              ) : (
                <p className="text-muted-foreground p-4 text-center">You have no upcoming appointments.</p>
              )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild className="w-full">
                <Link href="/patient-portal/appointments"><Eye className="mr-2 h-4 w-4"/>View All Appointments</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
  );
}

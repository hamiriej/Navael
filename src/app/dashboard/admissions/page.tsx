"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BedDouble, UserPlus, MoreHorizontal, Eye, FileEdit, Activity, Shuffle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";


export interface Admission {
  id: string;
  patientId: string;
  patientName: string;
  room: string;
  bed: string;
  admissionDate: string;
  reasonForAdmission?: string;
  status: "Admitted" | "Pending Discharge" | "Observation" | "Discharged";
  primaryDoctor: string;
  dischargeDate?: string;
}

export const ADMISSIONS_STORAGE_KEY = 'navael_admissions';
const initialMockAdmissions: Admission[] = [];

const statusBadgeVariant = (status: Admission["status"]): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "Admitted": return "default";
    case "Pending Discharge": return "secondary";
    case "Observation": return "outline";
    case "Discharged": return "outline";
    default: return "default";
  }
}

export default function AdmissionsPage() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedAdmissions = localStorage.getItem(ADMISSIONS_STORAGE_KEY);
      if (storedAdmissions) {
        setAdmissions(JSON.parse(storedAdmissions).sort((a: Admission, b: Admission) => new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime()));
      } else {
        setAdmissions(initialMockAdmissions);
        localStorage.setItem(ADMISSIONS_STORAGE_KEY, JSON.stringify(initialMockAdmissions));
      }
    } catch (error) {
      console.error("Failed to load admissions from localStorage", error);
      setAdmissions(initialMockAdmissions);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === ADMISSIONS_STORAGE_KEY && event.newValue) {
        try {
          setAdmissions(JSON.parse(event.newValue).sort((a: Admission, b: Admission) => new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime()));
        } catch (e) {
          console.error("Error parsing admissions from storage event", e);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (isLoading && admissions.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
        <p className="ml-2 text-muted-foreground">Loading admissions...</p>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <BedDouble className="mr-3 h-8 w-8 text-primary" /> Admissions
          </h1>
          <p className="text-muted-foreground">Manage patient admissions, transfers, and discharges.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/admissions/new">
            <UserPlus className="mr-2 h-4 w-4" /> New Admission
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Current & Recent Admissions</CardTitle>
          <CardDescription>
            Overview of admitted and recently discharged patients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && admissions.length === 0 ? (
            <div className="min-h-[200px] flex flex-col items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            </div>
          ) : admissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient Name</TableHead>
                  <TableHead>Room/Bed</TableHead>
                  <TableHead>Admission Date</TableHead>
                  <TableHead>Discharge Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Primary Doctor</TableHead>
                  <TableHead>Reason for Admission</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admissions.map((admission) => (
                  <TableRow key={admission.id}>
                    <TableCell className="font-medium">
                       <Link href={`/dashboard/patients/${admission.patientId}`} className="hover:underline text-primary">
                        {admission.patientName}
                      </Link>
                    </TableCell>
                    <TableCell>{admission.room} / {admission.bed}</TableCell>
                    <TableCell>{format(parseISO(admission.admissionDate), "PPP")}</TableCell>
                    <TableCell>{admission.dischargeDate ? format(parseISO(admission.dischargeDate), "PPP") : "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(admission.status)}>{admission.status}</Badge>
                    </TableCell>
                    <TableCell>{admission.primaryDoctor}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{admission.reasonForAdmission || "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                             <Link href={`/dashboard/patients/${admission.patientId}`}>
                                <Eye className="mr-2 h-4 w-4"/>View Patient Details
                             </Link>
                          </DropdownMenuItem>
                          {admission.status !== "Discharged" && (
                            <>
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/inpatient/record-vitals/${admission.id}`}>
                                  <Activity className="mr-2 h-4 w-4"/>Record Vitals
                                </Link>
                              </DropdownMenuItem>
                               <DropdownMenuItem asChild>
                                <Link href={`/dashboard/inpatient/nursing-notes/${admission.id}/new`}>
                                  <FileEdit className="mr-2 h-4 w-4"/>Add Nursing Note
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/inpatient/discharge/${admission.id}`}>
                                  <FileEdit className="mr-2 h-4 w-4"/>Plan/Edit Discharge
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/admissions/transfer/${admission.id}`}>
                                  <Shuffle className="mr-2 h-4 w-4"/>Transfer Patient
                                </Link>
                              </DropdownMenuItem>
                            </>
                          )}
                           {admission.status === "Discharged" && (
                             <DropdownMenuItem asChild>
                                <Link href={`/dashboard/inpatient/discharge/${admission.id}`}>
                                  <FileEdit className="mr-2 h-4 w-4"/>View Discharge Summary
                                </Link>
                              </DropdownMenuItem>
                           )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/30 rounded-md p-6 text-center">
              <BedDouble className="h-24 w-24 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">No Admissions Recorded</p>
              <p className="text-sm text-muted-foreground">
                Use the "New Admission" button to register an inpatient.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

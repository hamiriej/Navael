"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Users, Filter, MoreHorizontal, Edit, Trash2, FileText, UserPlus, Loader2, CalendarDays, History, Lock, AlertTriangle as AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { usePatients, type Patient, type AugmentedPatient } from "@/contexts/patient-context";
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
import { buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { ROLES } from "@/lib/constants";
import { format, parseISO } from 'date-fns';

export const mockPatients: Patient[] = [];

const statusColors: Record<Patient["status"], string> = {
  Active: "bg-green-500",
  Inactive: "bg-red-500",
  Pending: "bg-yellow-500",
};

const ADMIN_DEFAULT_PASSWORD = "adminpass";

export default function PatientsPage() {
  const { patients, deletePatient: deletePatientFromContext, isLoading: isLoadingPatients, error: patientsError, fetchPatients } = usePatients();
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<{ age: [number, number]; gender: string; status: string }>({
    age: [0, 100],
    gender: "All",
    status: "All",
  });
  const [ageRange, setAgeRange] = useState<[number, number]>([0,100]);
  const [patientToDelete, setPatientToDelete] = useState<AugmentedPatient | null>(null);  const [adminPassword, setAdminPassword] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters(prev => ({ ...prev, age: ageRange }));
    }, 500);
    return () => clearTimeout(handler);
  }, [ageRange]);


  const filteredPatients = useMemo(() => {
    return patients.filter(patient => {
      const nameMatch = patient.name.toLowerCase().includes(searchTerm.toLowerCase());
      const ageMatch = patient.age >= filters.age[0] && patient.age <= filters.age[1];
      const genderMatch = filters.gender === "All" || patient.gender === filters.gender;
      const statusMatch = filters.status === "All" || patient.status === filters.status;
      return nameMatch && ageMatch && genderMatch && statusMatch;
    });
  }, [searchTerm, filters, patients]);

const handleDeleteRequest = (patient: AugmentedPatient) => {    setPatientToDelete(patient);
    setIsPasswordDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!patientToDelete) return;

    if (userRole === ROLES.ADMIN && adminPassword !== ADMIN_DEFAULT_PASSWORD) {
      toast({
        title: "Incorrect Password",
        description: "Admin password incorrect. Patient not deleted.",
        variant: "destructive",
      });
      setAdminPassword("");
      return;
    }

    setIsDeleting(true);
    try {
      await deletePatientFromContext(patientToDelete.id);
      toast({
        title: "Patient Deleted",
        description: `${patientToDelete.name} has been removed.`,
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error deleting patient:", error);
      toast({ title: "Error", description: "Could not delete patient.", variant: "destructive" });
    }
    setPatientToDelete(null);
    setAdminPassword("");
    setIsPasswordDialogOpen(false);
    setIsDeleting(false);
  };

  const handlePasswordDialogClose = () => {
    setPatientToDelete(null);
    setAdminPassword("");
    setIsPasswordDialogOpen(false);
  }

  const canAddPatients = userRole === ROLES.ADMIN || userRole === ROLES.RECEPTIONIST;
  const canDeletePatients = userRole === ROLES.ADMIN;

  if (isLoadingPatients && patients.length === 0) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
         <p className="ml-3 text-muted-foreground">Loading patient records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <Users className="mr-3 h-8 w-8 text-primary" /> Patient Management
          </h1>
          <p className="text-muted-foreground">Search, filter, and manage patient records.</p>
        </div>
        {canAddPatients && (
          <Link href="/dashboard/patients/new" passHref>
            <Button><UserPlus className="mr-2 h-4 w-4"/>Add New Patient</Button>
          </Link>
        )}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search patients by name..."
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="shrink-0">
                  <Filter className="mr-2 h-4 w-4" /> Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 p-4 space-y-4">
                <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div>
                  <Label htmlFor="age-range" className="text-sm">Age Range: {ageRange[0]} - {ageRange[1]}</Label>
                  <Slider
                    id="age-range"
                    min={0}
                    max={100}
                    step={1}
                    value={ageRange}
                    onValueChange={(value) => setAgeRange(value as [number,number])}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="gender-filter" className="text-sm">Gender</Label>
                  <Select value={filters.gender} onValueChange={(value) => setFilters(prev => ({ ...prev, gender: value }))}>
                    <SelectTrigger id="gender-filter" className="mt-1">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Genders</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                       <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status-filter" className="text-sm">Status</Label>
                  <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger id="status-filter" className="mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Statuses</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPatients && filteredPatients.length === 0 ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Filtering patient data...</p>
            </div>
          ) : patientsError ? (
            <Alert variant="destructive" className="my-4">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertTitle>Error Fetching Patients</AlertTitle>
              <ShadAlertDescription>
                {patientsError} Please try again later.
                <Button variant="link" onClick={() => fetchPatients()} className="p-0 h-auto ml-2">Retry</Button>
              </ShadAlertDescription>
            </Alert>
          ) : filteredPatients.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Age</TableHead>
                  <TableHead className="hidden md:table-cell">Gender</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Visit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient: AugmentedPatient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <Link href={`/dashboard/patients/${patient.id}`} className="hover:underline text-primary">
                        <div className="font-medium">{patient.name}</div>
                      </Link>
                      <div className="text-xs text-muted-foreground md:hidden">{patient.age} / {patient.gender}</div>
                      <div className="text-xs text-muted-foreground hidden sm:block">{patient.email}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{patient.age}</TableCell>
                    <TableCell className="hidden md:table-cell">{patient.gender}</TableCell>
                    <TableCell className="hidden lg:table-cell">{patient.lastVisit ? format(parseISO(patient.lastVisit), "PPP") : "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="flex items-center gap-2 capitalize">
                         <span className={`h-2 w-2 rounded-full ${statusColors[patient.status]}`} />
                         {patient.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/patients/${patient.id}`}>
                                <FileText className="mr-2 h-4 w-4" /> View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/patients/${patient.id}?view=activity`}>
                                <History className="mr-2 h-4 w-4" /> View Activity
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/appointments/new?patientId=${patient.id}`}>
                                <CalendarDays className="mr-2 h-4 w-4" /> Schedule Appointment
                              </Link>
                            </DropdownMenuItem>
                            {(canAddPatients || userRole === ROLES.DOCTOR || userRole === ROLES.NURSE) && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/patients/${patient.id}/edit`}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit Patient
                                  </Link>
                                </DropdownMenuItem>
                            )}
                            {canDeletePatients && (
                              <>
                                <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                                    onClick={() => handleDeleteRequest(patient)}
                                    disabled={isDeleting}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Patient
                                  </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground min-h-[200px] flex flex-col justify-center items-center">
              <Search className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg">{patients.length > 0 ? "No patients found matching your current search/filter criteria." : "No patient records found in the system."}</p>
              {patients.length > 0 && <p className="text-sm">Try adjusting your search or filter settings.</p>}
              {patients.length === 0 && canAddPatients && <p className="text-sm mt-2">Click "Add New Patient" to get started.</p>}
            </div>
          )}
        </CardContent>
      </Card>
       <AlertDialog open={isPasswordDialogOpen} onOpenChange={(open) => { if (!open) handlePasswordDialogClose(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Admin Confirmation Required</AlertDialogTitle>
            <AlertDialogDescription>
              To delete patient <span className="font-semibold">{patientToDelete?.name}</span>, please enter the Administrator password. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="admin-password">Admin Password</Label>
            <Input
              id="admin-password"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handlePasswordDialogClose} disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className={buttonVariants({ variant: "destructive" })} disabled={!adminPassword || isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
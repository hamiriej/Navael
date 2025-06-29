"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquareText, Search, MoreHorizontal, FileEdit, Eye, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useConsultations } from "@/contexts/consultation-context";
import { format, parseISO } from "date-fns";

export interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  consultationDate: string;
  doctorName: string;
  presentingComplaint: string;
  historyOfPresentingComplaint?: string;
  pastMedicalHistory?: string;
  medicationHistory?: string;
  allergies?: string;
  familyHistory?: string;
  socialHistory?: string;
  reviewOfSystems?: string;
  examinationFindings?: string;
  aiGeneratedSummary?: string;
  assessmentDiagnosis: string;
  plan: string;
  status: "Open" | "Closed" | "Follow-up Required";
  time?: string;
  reason?: string;
}

export const CONSULTATIONS_STORAGE_KEY = 'navael_consultations';

const statusBadgeVariant = (status: Consultation["status"]): BadgeProps["variant"] => {
  switch (status) {
    case "Open": return "default";
    case "Closed": return "outline";
    case "Follow-up Required": return "secondary";
    default: return "default";
  }
};

export default function ConsultationsPage() {
  const { consultations, isLoadingConsultations, fetchConsultations } = useConsultations();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredConsultations = useMemo(() => {
    return consultations.filter(consult =>
      consult.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consult.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (consult.consultationDate && format(parseISO(consult.consultationDate), "PPP").toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => new Date(b.consultationDate).getTime() - new Date(a.consultationDate).getTime());
  }, [consultations, searchTerm]);


  if (isLoadingConsultations && consultations.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading consultation data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <MessageSquareText className="mr-3 h-8 w-8 text-primary" /> Consultations
          </h1>
          <p className="text-muted-foreground">View and manage patient consultation records.</p>
        </div>
         <Button variant="outline" asChild>
          <Link href="/dashboard/consultations/new">
            <FileEdit className="mr-2 h-4 w-4" /> Start New Consultation Note
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Consultation Records</CardTitle>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Search by Patient Name, Doctor, or Date..."
              className="max-w-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingConsultations && filteredConsultations.length === 0 ? (
             <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Filtering consultations...</p>
             </div>
          ) : filteredConsultations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Primary Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConsultations.map((consult) => (
                  <TableRow key={consult.id}>
                    <TableCell className="font-medium">
                       <Link href={`/dashboard/patients/${consult.patientId}`} className="hover:underline text-primary">
                        {consult.patientName}
                      </Link>
                    </TableCell>
                    <TableCell>{consult.doctorName}</TableCell>
                    <TableCell>{format(parseISO(consult.consultationDate), "PPP p")}</TableCell>
                    <TableCell>{consult.reason || consult.presentingComplaint.substring(0,50) + (consult.presentingComplaint.length > 50 ? "..." : "")}</TableCell>
                    <TableCell><Badge variant={statusBadgeVariant(consult.status)}>{consult.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                             <Link href={`/dashboard/consultations/${consult.id}/edit`}>
                                <Eye className="mr-2 h-4 w-4"/>View/Edit Note
                             </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="min-h-[300px] flex flex-col items-center justify-center bg-muted/30 rounded-md p-6 text-center">
              <MessageSquareText className="h-24 w-24 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">No Consultation Records Found</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Try adjusting your search terms." : "Start a new consultation note to see records here."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
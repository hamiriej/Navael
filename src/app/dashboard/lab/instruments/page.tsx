
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ServerCog, ArrowLeft, ListFilter, Loader2 } from "lucide-react"; // Added Loader2
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useEffect } from "react"; // Added useEffect and useState

interface InstrumentEntry {
  id: string;
  name: string;
  status: "Online" | "Offline" | "Maintenance" | "Error";
  lastMaintenance: string; // ISO Date string
  nextMaintenance: string; // ISO Date string
  serialNumber?: string;
  model?: string;
  location?: string;
}

// Key for localStorage
const LAB_INSTRUMENTS_STORAGE_KEY = 'navael_lab_instruments';

// Initial mock data - will be overwritten by localStorage if it exists
const initialMockInstruments: InstrumentEntry[] = [
  { id: "INST001", name: "Hematology Analyzer XE-2100", status: "Online", lastMaintenance: "2024-06-15", nextMaintenance: "2024-12-15", serialNumber: "SN-HEMA-001", model: "XE-2100", location: "Main Lab - Hematology" },
  { id: "INST002", name: "Chemistry Analyzer AU480", status: "Online", lastMaintenance: "2024-07-01", nextMaintenance: "2025-01-01", serialNumber: "SN-CHEM-005", model: "AU480", location: "Main Lab - Chemistry" },
  { id: "INST003", name: "Microscope BX53", status: "Maintenance", lastMaintenance: "2024-07-20", nextMaintenance: "2024-07-28", serialNumber: "SN-MICR-010", model: "BX53", location: "Microscopy Room" },
  { id: "INST004", name: "Centrifuge 5810R", status: "Offline", lastMaintenance: "2024-05-01", nextMaintenance: "2024-11-01", serialNumber: "SN-CENT-002", model: "5810R", location: "Sample Prep Area"},
];

const statusBadgeVariant = (status: InstrumentEntry["status"]): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "Online") return "default"; // Green for default usually
  if (status === "Offline" || status === "Error") return "destructive";
  if (status === "Maintenance") return "secondary";
  return "outline";
}


export default function InstrumentStatusPage() {
  const router = useRouter();
  const [instruments, setInstruments] = useState<InstrumentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedInstruments = localStorage.getItem(LAB_INSTRUMENTS_STORAGE_KEY);
      if (storedInstruments) {
        setInstruments(JSON.parse(storedInstruments));
      } else {
        // If nothing in localStorage, use initialMockInstruments and save it
        setInstruments(initialMockInstruments);
        localStorage.setItem(LAB_INSTRUMENTS_STORAGE_KEY, JSON.stringify(initialMockInstruments));
      }
    } catch (error) {
      console.error("Failed to load instruments from localStorage", error);
      setInstruments(initialMockInstruments); // Fallback to initial data
    }
    setIsLoading(false);
  }, []);


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <ServerCog className="mr-3 h-8 w-8 text-primary" /> Instrument Status & Management
          </h1>
          <p className="text-muted-foreground">View the status of laboratory instruments and manage maintenance schedules.</p>
        </div>
         <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
             <Button variant="outline">
                <ListFilter className="mr-2 h-4 w-4" /> Filter
            </Button>
            {/* Add button for new instrument can be added here for admins */}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Lab Instrument Overview</CardTitle>
           <CardDescription>
            Current status and maintenance schedule for laboratory instruments.
          </CardDescription>
          <Input placeholder="Search instruments by name, ID, or S/N..." className="mt-2 max-w-sm"/>
        </CardHeader>
        <CardContent>
          {instruments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instrument Name</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Serial #</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Maintenance</TableHead>
                  <TableHead>Next Maintenance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instruments.map((instrument) => (
                  <TableRow key={instrument.id}>
                    <TableCell className="font-medium">{instrument.name}</TableCell>
                    <TableCell>{instrument.model || "N/A"}</TableCell>
                    <TableCell>{instrument.serialNumber || "N/A"}</TableCell>
                    <TableCell>{instrument.location || "N/A"}</TableCell>
                    <TableCell><Badge variant={statusBadgeVariant(instrument.status)}>{instrument.status}</Badge></TableCell>
                    <TableCell>{new Date(instrument.lastMaintenance).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(instrument.nextMaintenance).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="min-h-[300px] flex flex-col items-center justify-center bg-muted/30 rounded-md">
              <ServerCog className="h-24 w-24 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">No Instrument Data Available</p>
              <p className="text-sm text-muted-foreground">Instrument data will appear here once configured.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

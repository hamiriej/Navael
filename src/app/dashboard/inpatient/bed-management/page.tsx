
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bed, Users, Wind, Thermometer, ShieldAlert, Hotel } from "lucide-react"; // Added Hotel
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export interface Bed {
  id: string;
  label: string; // e.g., "101-A", "B2"
  wardId: string;
  status: "Available" | "Occupied" | "Needs Cleaning" | "Maintenance";
  patientId?: string;
  patientName?: string;
}

export interface Ward {
  id: string;
  name: string; // e.g., "General Ward A", "Surgical ICU"
  description?: string;
  beds: Bed[];
  // capacity?: number; // No longer strictly needed if beds array is the source of truth for count and generation logic is good.
}

// Export the key to be used by other modules needing to access this data
export const WARDS_BEDS_STORAGE_KEY = 'navael_wards_beds_data';

// Initial mock data if nothing in localStorage - This is now primarily managed by the admin panel.
const initialMockWards: Ward[] = [];

const getBedStatusColor = (status: Bed["status"]): string => {
  switch (status) {
    case "Available": return "bg-green-100 border-green-500 text-green-700 hover:bg-green-200";
    case "Occupied": return "bg-red-100 border-red-500 text-red-700 hover:bg-red-200";
    case "Needs Cleaning": return "bg-yellow-100 border-yellow-500 text-yellow-700 hover:bg-yellow-200";
    case "Maintenance": return "bg-gray-100 border-gray-500 text-gray-700 hover:bg-gray-200";
    default: return "bg-slate-100 border-slate-500 text-slate-700 hover:bg-slate-200";
  }
};
const getBedStatusIcon = (status: Bed["status"]): React.ElementType => {
  switch (status) {
    case "Available": return Users; // Represents space for people
    case "Occupied": return Bed;
    case "Needs Cleaning": return Wind; // Represents airing out/cleaning
    case "Maintenance": return ShieldAlert; // Represents caution/issue
    default: return Thermometer; // Default, less specific
  }
}

export default function BedManagementPage() {
  const router = useRouter();
  const [wards, setWards] = useState<Ward[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedWardsData = localStorage.getItem(WARDS_BEDS_STORAGE_KEY);
      if (storedWardsData) {
        setWards(JSON.parse(storedWardsData));
      } else {
        // If nothing is in localStorage, it means admins haven't configured any wards yet.
        // The admin panel is now responsible for initializing this data.
        setWards([]); 
        // localStorage.setItem(WARDS_BEDS_STORAGE_KEY, JSON.stringify(initialMockWards)); // Only set if you want default wards on first load EVER.
      }
    } catch (error) {
      console.error("Failed to load ward/bed data from localStorage", error);
      setWards([]); // Fallback to empty if error
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Listen for storage changes to update if another tab modifies the data
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === WARDS_BEDS_STORAGE_KEY && event.newValue) {
        try {
          setWards(JSON.parse(event.newValue));
        } catch (e) {
          console.error("Error parsing wards/beds from storage event", e);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p>Loading bed management dashboard...</p></div>;
  }

  return (
    <div className="space-y-8">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-headline font-bold flex items-center">
                    <Hotel className="mr-3 h-8 w-8 text-primary" /> Bed Management Dashboard
                </h1>
                <p className="text-muted-foreground">Visualize ward occupancy and bed status across the facility.</p>
            </div>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
        </div>

      {wards.length === 0 && (
        <Card className="shadow-md">
            <CardContent className="p-10 flex flex-col items-center justify-center text-center">
                <Bed className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-lg text-muted-foreground">No Wards Configured.</p>
                <p className="text-sm text-muted-foreground">Please use the Admin Panel {'>'} Ward Management to define wards and beds.</p>
            </CardContent>
        </Card>
      )}

      {wards.map((ward) => (
        <Card key={ward.id} className="shadow-lg overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="font-headline text-xl text-primary">{ward.name}</CardTitle>
            {ward.description && <CardDescription>{ward.description}</CardDescription>}
             <div className="text-xs text-muted-foreground mt-1">
                Total Beds: {ward.beds.length} | 
                Available: {ward.beds.filter(b => b.status === "Available").length} | 
                Occupied: {ward.beds.filter(b => b.status === "Occupied").length}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {ward.beds.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {ward.beds.map((bed) => {
                  const StatusIcon = getBedStatusIcon(bed.status);
                  return (
                    <Card 
                        key={bed.id} 
                        className={`p-3 rounded-lg border-2 transition-all duration-200 ease-in-out transform hover:scale-105 ${getBedStatusColor(bed.status)}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-md">{bed.label}</h4>
                        <StatusIcon className="h-5 w-5 opacity-70" />
                      </div>
                      <Badge variant={bed.status === "Occupied" ? "destructive" : bed.status === "Available" ? "default" : "secondary"} className="text-xs w-full justify-center truncate">
                        {bed.status}
                      </Badge>
                      {bed.status === "Occupied" && bed.patientName && (
                        <div className="mt-2 text-xs truncate">
                          <p className="font-medium">Patient:</p>
                          {bed.patientId ? (
                            <Link href={`/dashboard/patients/${bed.patientId}`} className="hover:underline text-primary">
                                {bed.patientName}
                            </Link>
                          ) : (
                            <span>{bed.patientName}</span>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No beds configured for this ward. Beds can be added by an Admin in Ward Management.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Archive, ArrowLeft, PackagePlus, SearchIcon, Send } from "lucide-react"; // Added Send icon
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth
import { ROLES } from "@/lib/constants"; // Import ROLES
import { useToast } from "@/hooks/use-toast"; // Import useToast

const mockSupplies: any[] = []; // RESET TO EMPTY

const supplyStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "In Stock") return "default";
  if (status === "Low Stock") return "secondary";
  if (status === "Out of Stock") return "destructive";
  return "outline";
}


export default function ManageSuppliesPage() {
  const router = useRouter();
  const { userRole } = useAuth(); // Get user role
  const { toast } = useToast(); // For toast notifications

  const handleRequestSupply = () => {
    // Placeholder for actual supply request logic
    toast({
      title: "Supply Request Submitted",
      description: "Your request for supplies has been noted. (Placeholder)",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <Archive className="mr-3 h-8 w-8 text-primary" /> Reagents & Supplies Management
          </h1>
          <p className="text-muted-foreground">Track inventory levels, expiry dates, and lot numbers for lab supplies.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {userRole === ROLES.ADMIN && (
                 <Button onClick={() => router.push('/dashboard/pharmacy/inventory/new')}> {/* Assuming admin adds supplies through a similar interface */}
                    <PackagePlus className="mr-2 h-4 w-4" /> Add New Supply/Reagent
                </Button>
            )}
            {userRole === ROLES.LAB_TECH && (
                 <Button onClick={handleRequestSupply} variant="secondary">
                    <Send className="mr-2 h-4 w-4" /> Request Supply
                </Button>
            )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Supply Inventory Overview</CardTitle>
           <CardDescription>
            View current stock levels. Administrators can add new items, Lab Technicians can request supplies.
          </CardDescription>
          <Input placeholder="Search supplies by name or lot number..." className="mt-2 max-w-sm"/>
        </CardHeader>
        <CardContent>
          {mockSupplies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Lot #</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockSupplies.map((supply) => (
                  <TableRow key={supply.id}>
                    <TableCell className="font-medium">{supply.name}</TableCell>
                    <TableCell>{supply.quantity}</TableCell>
                    <TableCell>{supply.unit}</TableCell>
                    <TableCell>{supply.lot}</TableCell>
                    <TableCell>{supply.expiry}</TableCell>
                    <TableCell><Badge variant={supplyStatusVariant(supply.status)}>{supply.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="min-h-[300px] flex flex-col items-center justify-center bg-muted/30 rounded-md">
              <Archive className="h-24 w-24 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">No Supply Data Available</p>
              <p className="text-sm text-muted-foreground">Add supplies to the inventory to see them here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

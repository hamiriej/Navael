"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, ArrowLeft, CheckCircle, Search as SearchIcon, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { type LabOrder, getLabStatusVariant, paymentStatusBadgeVariant } from "../page";
import { Input } from "@/components/ui/input";
import { useLabOrders } from "@/contexts/lab-order-context";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { logActivity } from "@/lib/activityLog";
import { parseISO, format } from "date-fns";

export default function IncomingLabOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { labOrders, isLoadingLabOrders, updateLabOrder } = useLabOrders();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const { userRole, username } = useAuth();

  const incomingOrders = useMemo(() => {
    return labOrders.filter(order => order.status === "Pending Sample")
      .sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [labOrders]);


  const handleAcknowledgeOrder = async (orderId: string) => {
    setActionLoading(prev => ({...prev, [orderId]: true}));
    const orderToUpdate = labOrders.find(o => o.id === orderId);
    if (orderToUpdate) {
      if (orderToUpdate.paymentStatus !== "Paid") {
        toast({
          title: "Payment Pending",
          description: `Payment for order ${orderId} is still pending. Sample collection may proceed, but results release will require payment.`,
          variant: "default",
          duration: 7000,
        });
      }
      
      try {
        const updatedOrder = await updateLabOrder(orderId, {
            status: "Sample Collected",
            sampleCollectionDate: new Date().toISOString(),
        });
        if (updatedOrder) {
            logActivity({
                actorRole: userRole || "System",
                actorName: username || "System",
                actionDescription: `Acknowledged Lab Order ${orderId} for ${updatedOrder.patientName}. Status set to Sample Collected.`,
                targetEntityType: "Lab Order",
                targetEntityId: orderId,
                iconName: "CheckCircle",
            });
            toast({
                title: "Order Acknowledged",
                description: `Order ${orderId} status updated to "Sample Collected". It will now appear in the Sample Collection queue on the main lab dashboard.`,
            });
        }
      } catch (error) {
        console.error("Error acknowledging order via context:", error);
        toast({ title: "Acknowledgement Error", description: "Could not update order status.", variant: "destructive"});
      }
    }
    setActionLoading(prev => ({...prev, [orderId]: false}));
  };

  const filteredOrders = useMemo(() => {
    return incomingOrders.filter(order =>
      order.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.orderingDoctor.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [incomingOrders, searchTerm]);

  if (isLoadingLabOrders && incomingOrders.length === 0) {
    return (
      <div className="flex items-center justify-center p-10 min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" /> 
        <span className="ml-2 text-muted-foreground">Loading incoming orders...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <Inbox className="mr-3 h-8 w-8 text-primary" /> Incoming Lab Orders
          </h1>
          <p className="text-muted-foreground">View and acknowledge new lab orders submitted by clinicians.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Orders Awaiting Acknowledgement</CardTitle>
          <CardDescription>
            These orders have been placed and are awaiting processing by the lab.
            Acknowledging an order will move it to the "Sample Collection" queue.
          </CardDescription>
          <div className="pt-2">
            <Input
                placeholder="Search incoming orders by patient, ID, or doctor..."
                className="max-w-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingLabOrders && filteredOrders.length === 0 ? (
             <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Filtering orders...</p>
             </div>
          ) : filteredOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Tests</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/patients/${order.patientId}`} className="hover:underline text-primary">
                        {order.patientName}
                      </Link>
                    </TableCell>
                    <TableCell>{format(parseISO(order.orderDate), "PPP")}</TableCell>
                    <TableCell>{order.tests.map(t => t.name).join(', ')}</TableCell>
                    <TableCell>
                        <Badge variant={paymentStatusBadgeVariant(order.paymentStatus)}>
                           <DollarSign className="mr-1 h-3 w-3"/> {order.paymentStatus || "N/A"}
                        </Badge>
                        {order.invoiceId && (
                             <Link href={`/dashboard/billing`} className="ml-1 text-xs text-primary hover:underline">
                                (Inv: {order.invoiceId})
                            </Link>
                        )}
                    </TableCell>
                    <TableCell><Badge variant={getLabStatusVariant(order.status)}>{order.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleAcknowledgeOrder(order.id)} disabled={actionLoading[order.id]}>
                        {actionLoading[order.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />} 
                        Acknowledge
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="min-h-[300px] flex flex-col items-center justify-center bg-muted/30 rounded-md p-6 text-center">
              <SearchIcon className="h-24 w-24 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">No new incoming lab orders found.</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Try adjusting your search terms." : "All pending orders have been acknowledged or there are no new orders."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

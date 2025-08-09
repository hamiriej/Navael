"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlaskConical, FileSearch, Eye, DollarSign, Printer, Loader2, AlertTriangle as AlertTriangleIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import Link from "next/link";
import { useState, useMemo } from "react";
import { Alert, AlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { ROLES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context"; 
import { useLabOrders } from "@/contexts/lab-order-context";
import { format, parseISO } from "date-fns";
import type { LabTest, LabOrder, LabTestStatus, LabOrderStatus, LabOrderPaymentStatus } from "@/app/dashboard/lab/types";

export const LAB_ORDERS_STORAGE_KEY = 'mockLabOrders';

export const getLabStatusVariant = (status: LabOrder["status"] | LabTest["status"]): BadgeProps["variant"] => {
  switch (status) {
    case "Results Ready":
    case "Result Entered":
      return "default";
    case "Pending Sample":
    case "Awaiting Verification":
      return "secondary";
    case "Sample Collected":
    case "Processing":
      return "outline";
    case "Cancelled":
      return "destructive";
    default:
      return "default";
  }
};

export const paymentStatusBadgeVariant = (status?: LabOrder["paymentStatus"]): BadgeProps["variant"] => {
  switch (status) {
    case "Paid": return "default";
    case "Pending Payment": return "secondary";
    default: return "outline";
  }
};

// ======= SAFE DATE FORMAT HELPER =========
function safeFormatDate(dateString: unknown, formatStr = "PPP"): string {
  if (typeof dateString !== "string") return "N/A";
  try {
    const parsedDate = parseISO(dateString);
    if (isNaN(parsedDate.getTime())) return "N/A";
    return format(parsedDate, formatStr);
  } catch {
    return "N/A";
  }
}

export const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description: string }) => (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

export default function LabResultsViewerPage() {
  const { labOrders, isLoadingLabOrders, error: labOrdersError } = useLabOrders();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<LabOrder | null>(null);
  const { userRole } = useAuth();
  const { currency } = useAppearanceSettings();

  const completedReports = useMemo(() => {
    return labOrders.filter((order: LabOrder) =>
        (order.status === "Results Ready" || order.status === "Cancelled") &&
        (order.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
         order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
         order.orderingDoctor.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a: LabOrder, b: LabOrder) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [labOrders, searchTerm]);

  if (isLoadingLabOrders && labOrders.length === 0) {
    return (
      <div className="flex items-center justify-center p-10 min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading lab data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <FlaskConical className="mr-3 h-8 w-8 text-primary" /> Lab Reports & Results
          </h1>
          <p className="text-muted-foreground">View completed lab reports.</p>
        </div>
         <Input
            placeholder="Search reports by Patient, Order ID, or Doctor..."
            className="max-w-md w-full md:w-auto"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {labOrdersError && (
        <Alert variant="destructive" className="my-4">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Error Fetching Lab Orders</AlertTitle>
          <ShadAlertDescription>
            {labOrdersError} Please try again.
          </ShadAlertDescription>
        </Alert>
      )}

      <Card className="shadow-md mt-4">
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><FileSearch className="mr-2 h-5 w-5 text-primary"/>Completed Lab Reports</CardTitle>
          <CardDescription>Search and view finalized or cancelled lab reports.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLabOrders && completedReports.length === 0 ? (
             <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Searching reports...</p>
             </div>
          ) : !isLoadingLabOrders && labOrdersError === null && completedReports.length === 0 ? (
            <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/10 rounded-md text-center p-6">
              <FileSearch className="h-16 w-16 text-muted-foreground/40 mb-3" />
              <p className="text-lg text-muted-foreground">No completed reports found.</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Try adjusting your search term." : "Check back later or contact the lab if you are expecting results."}
              </p>
            </div>
          ) : completedReports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Finalized/Cancelled Date</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedReports.map((order: LabOrder) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.patientName} (ID: {order.patientId})</TableCell>
                    <TableCell>
                      {order.verificationDate
                        ? safeFormatDate(order.verificationDate)
                        : (order.status === "Cancelled" && order.sampleCollectionDate
                            ? safeFormatDate(order.sampleCollectionDate)
                            : (order.status === "Cancelled"
                                ? safeFormatDate(order.orderDate)
                                : "N/A"))}
                    </TableCell>
                    <TableCell>
                        <Badge variant={paymentStatusBadgeVariant(order.paymentStatus)}>
                            <DollarSign className="mr-1 h-3 w-3"/>{order.paymentStatus || "N/A"}
                        </Badge>
                        {order.invoiceId && (
                            <Link href="/dashboard/billing" className="ml-1 text-xs text-primary hover:underline">
                                (Inv: {order.invoiceId})
                            </Link>
                        )}
                    </TableCell>
                    <TableCell><Badge variant={getLabStatusVariant(order.status)}>{order.status}</Badge></TableCell>
                    <TableCell className="text-right">
                        <Dialog
                            open={selectedOrderForModal?.id === order.id}
                            onOpenChange={(isOpen) => { if (!isOpen) setSelectedOrderForModal(null); }}
                        >
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => setSelectedOrderForModal(order)}>
                                    <Eye className="mr-2 h-4 w-4" /> View Report
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-2xl md:max-w-3xl">
                                <DialogHeader>
                                    <DialogTitle className="font-headline text-xl">Lab Report Details - Order ID: {order.id}</DialogTitle>
                                    <DialogDescription>
                                        Patient: {order.patientName} (ID: {order.patientId}) <br />
                                        Ordered By: {order.orderingDoctor} on {safeFormatDate(order.orderDate)} <br/>
                                        Sample Collected: {order.sampleCollectionDate ? safeFormatDate(order.sampleCollectionDate, "PPP p") : "N/A"}
                                    </DialogDescription>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Payment: <Badge variant={paymentStatusBadgeVariant(order.paymentStatus)} className="ml-1">{order.paymentStatus || "N/A"}</Badge>
                                        {order.invoiceId && (
                                            <Link href="/dashboard/billing" className="ml-1 text-xs text-primary hover:underline">
                                                (Invoice ID: {order.invoiceId})
                                            </Link>
                                        )}
                                    </div>
                                    {order.verifiedBy && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Verified By: {order.verifiedBy} on {order.verificationDate ? safeFormatDate(order.verificationDate, "PPP p") : "N/A"}
                                        </p>
                                    )}
                                </DialogHeader>
                                <div className="max-h-[60vh] overflow-y-auto pr-2">
                                    <Table>
                                        <TableHeader>
                                        <TableRow>
                                            <TableHead>Test Name</TableHead>
                                            <TableHead>Result</TableHead>
                                            <TableHead>Reference Range</TableHead>
                                            <TableHead>Price ({currency})</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Tech Notes</TableHead>
                                        </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                        {order.tests.map((test: LabTest) => (
                                            <TableRow key={test.id}>
                                            <TableCell className="font-medium">{test.name}</TableCell>
                                            <TableCell>{test.result || "N/A"}</TableCell>
                                            <TableCell>{test.referenceRange || "N/A"}</TableCell>
                                            <TableCell>{test.price ? formatCurrency(test.price, currency) : 'N/A'}</TableCell>
                                            <TableCell><Badge variant={getLabStatusVariant(test.status)}>{test.status}</Badge></TableCell>
                                            <TableCell>{test.notes || "---"}</TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                    {order.clinicalNotes && (
                                        <div className="mt-4 p-3 border rounded-md bg-muted/50">
                                            <p className="text-sm font-semibold">Clinical Notes from Doctor:</p>
                                            <p className="text-sm text-muted-foreground">{order.clinicalNotes}</p>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button onClick={() => setSelectedOrderForModal(null)} variant="outline">Close</Button>
                                    <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/>Print Report</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
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
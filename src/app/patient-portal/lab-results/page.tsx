"use client";

import { useEffect, useState, useMemo } from "react";
import { usePatientAuth } from "@/contexts/patient-auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FlaskConical, ArrowLeft, Eye, Printer, Download, AlertTriangle } from "lucide-react";
import { type LabOrder, type LabTest, getLabStatusVariant, paymentStatusBadgeVariant as getLabPaymentStatusBadgeVariant } from "@/app/dashboard/lab/page";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { formatCurrency } from "@/lib/utils";
import { useLabOrders } from "@/contexts/lab-order-context";

export default function PatientLabResultsPage() {
  const { patientId, patientName, isLoading: authLoading } = usePatientAuth();
  const { fetchLabOrdersForPatient, isLoadingLabOrders: isLoadingContextOrders } = useLabOrders();
  const [patientLabOrders, setPatientLabOrdersState] = useState<LabOrder[]>([]);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const router = useRouter();
  const { currency } = useAppearanceSettings();

  useEffect(() => {
    const loadOrders = async () => {
        if (patientId && !isLoadingContextOrders) {
            setIsLoadingPageData(true);
            const fetchedOrders = await fetchLabOrdersForPatient(patientId);
            setPatientLabOrdersState(fetchedOrders.sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));
            setIsLoadingPageData(false);
        } else if (!patientId && !authLoading) {
            setIsLoadingPageData(false);
        }
    };
    loadOrders();
  }, [patientId, authLoading, fetchLabOrdersForPatient, isLoadingContextOrders]);

  const isLoading = authLoading || isLoadingContextOrders || isLoadingPageData;

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading your lab results...</p>
      </div>
    );
  }

  if (!patientId) {
     return (
      <div className="text-center py-10">
        <p className="text-lg text-muted-foreground">Please log in to view your lab results.</p>
        <Button asChild className="mt-4">
            <Link href="/patient-portal/login">Go to Login</Link>
        </Button>
      </div>
    );
  }

  const handlePrintReport = (order: LabOrder) => {
    const printableContent = `
      <html>
        <head>
          <title>Lab Report - ${order.id}</title>
          <style>
            body { font-family: sans-serif; margin: 20px; }
            h1, h2, h3 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header-info p { margin: 2px 0; font-size: 0.9em; }
            .notes { margin-top: 20px; padding:10px; border: 1px solid #eee; background-color:#f9f9f9; font-size:0.9em; }
          </style>
        </head>
        <body>
          <h1>Lab Report</h1>
          <div class="header-info">
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>Patient Name:</strong> ${order.patientName}</p>
            <p><strong>Patient ID:</strong> ${order.patientId}</p>
            <p><strong>Order Date:</strong> ${format(parseISO(order.orderDate), "PPP")}</p>
            <p><strong>Ordering Doctor:</strong> ${order.orderingDoctor}</p>
            <p><strong>Report Status:</strong> ${order.status}</p>
            ${order.sampleCollectionDate ? `<p><strong>Sample Collected:</strong> ${format(parseISO(order.sampleCollectionDate), "PPP p")}</p>` : ''}
            ${order.verificationDate ? `<p><strong>Results Verified:</strong> ${format(parseISO(order.verificationDate), "PPP p")} by ${order.verifiedBy || 'Lab'}</p>` : ''}
          </div>
          
          ${order.status === "Results Ready" ? `
            <h3>Test Results:</h3>
            <table>
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>Result</th>
                  <th>Reference Range</th>
                  <th>Price (${currency})</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${order.tests.map(test => `
                  <tr>
                    <td>${test.name}</td>
                    <td>${test.result || "N/A"}</td>
                    <td>${test.referenceRange || "N/A"}</td>
                    <td>${test.price ? formatCurrency(test.price, currency) : 'N/A'}</td>
                    <td>${test.notes || "---"}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `<p>Results are not yet ready for this order.</p>`}
          ${order.clinicalNotes ? `<div class="notes"><strong>Clinical Notes from Doctor:</strong><p>${order.clinicalNotes}</p></div>` : ''}
           <p style="font-size:0.8em; text-align:center; margin-top:30px;">This report was generated by Navael Healthcare System.</p>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printableContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-headline font-bold flex items-center">
                <FlaskConical className="mr-3 h-7 w-7 text-primary" /> My Lab Results
            </h1>
            <p className="text-muted-foreground">View your lab test orders and results, {patientName}.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>

      {isLoadingPageData && patientLabOrders.length === 0 ? (
        <div className="flex justify-center items-center h-64">
             <Loader2 className="h-12 w-12 animate-spin text-primary" />
             <p className="ml-3 text-muted-foreground">Fetching your lab orders...</p>
        </div>
      ) : patientLabOrders.length > 0 ? (
        <Accordion type="single" collapsible className="w-full space-y-4">
          {patientLabOrders.map((order) => (
            <AccordionItem value={order.id} key={order.id} className="border rounded-lg shadow-sm bg-card">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full">
                  <div className="flex-grow mb-2 sm:mb-0">
                    <p className="font-semibold text-primary">Order ID: {order.id}</p>
                    <p className="text-sm text-muted-foreground">
                      Date: {format(parseISO(order.orderDate), "PPP")} &bull; Doctor: {order.orderingDoctor}
                    </p>
                  </div>
                  <Badge variant={getLabStatusVariant(order.status)} className="text-xs self-start sm:self-center">
                    {order.status}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-0">
                <div className="space-y-4">
                   <div className="text-sm text-muted-foreground">
                    {order.sampleCollectionDate && <p>Sample Collected: {format(parseISO(order.sampleCollectionDate), "PPP p")}</p>}
                    {order.verificationDate && <p>Results Verified: {format(parseISO(order.verificationDate), "PPP p")}</p>}
                    <p className="flex items-center">Payment Status: <Badge variant={getLabPaymentStatusBadgeVariant(order.paymentStatus)} className="ml-2 text-xs"><DollarSign className="h-3 w-3 mr-1"/>{order.paymentStatus || "N/A"}</Badge>
                    {order.invoiceId && <Link href="/patient-portal/billing" className="ml-2 text-xs text-primary hover:underline">(Invoice: {order.invoiceId})</Link>}
                    </p>
                  </div>
                  {order.clinicalNotes && (
                    <div className="p-3 border rounded-md bg-muted/30">
                        <p className="text-sm font-semibold">Clinical Notes from Doctor:</p>
                        <p className="text-xs text-muted-foreground whitespace-pre-line">{order.clinicalNotes}</p>
                    </div>
                  )}

                  {order.status === "Results Ready" ? (
                    <>
                      <h4 className="text-md font-semibold pt-2">Test Results:</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Test Name</TableHead>
                            <TableHead>Result</TableHead>
                            <TableHead>Reference Range</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.tests.map(test => (
                            <TableRow key={test.id}>
                              <TableCell className="font-medium">{test.name}</TableCell>
                              <TableCell>{test.result || "N/A"}</TableCell>
                              <TableCell>{test.referenceRange || "N/A"}</TableCell>
                              <TableCell>{test.notes || "---"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                       <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => handlePrintReport(order)}>
                            <Printer className="mr-2 h-4 w-4" /> Print Report
                        </Button>
                      </div>
                    </>
                  ) : order.status === "Cancelled" ? (
                    <p className="text-sm text-destructive flex items-center"><AlertTriangle className="mr-2 h-4 w-4" />This lab order was cancelled.</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Results are not yet ready for this order. Current status: {order.status}.</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <Card className="shadow-md">
          <CardContent className="p-10 flex flex-col items-center justify-center text-center">
            <FlaskConical className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg text-muted-foreground">You have no lab orders on record.</p>
            <p className="text-sm text-muted-foreground">If you are expecting results, please contact the clinic.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

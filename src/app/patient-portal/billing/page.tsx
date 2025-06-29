"use client";

import { useEffect, useState, useMemo } from "react";
import { usePatientAuth } from "@/contexts/patient-auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, ArrowLeft, Eye, Printer, DollarSign } from "lucide-react";
import type { Invoice } from "@/app/dashboard/billing/page";
import { invoiceStatusBadgeVariant } from "@/app/dashboard/billing/page";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { formatCurrency } from "@/lib/utils";
import { useInvoices } from "@/contexts/invoice-context";

export default function PatientBillingPage() {
  const { patientId, patientName, isLoading: authLoading } = usePatientAuth();
  const { fetchInvoicesForPatient, isLoadingInvoices: isLoadingContextInvoices } = useInvoices();
  const [invoices, setInvoicesState] = useState<Invoice[]>([]);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<Invoice | null>(null);
  const router = useRouter();
  const { currency } = useAppearanceSettings();

  useEffect(() => {
    const loadPatientInvoices = async () => {
      if (patientId && !isLoadingContextInvoices) {
        setIsLoadingPageData(true);
        const fetchedInvoices = await fetchInvoicesForPatient(patientId);
        setInvoicesState(fetchedInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setIsLoadingPageData(false);
      } else if (!patientId && !authLoading) {
        setIsLoadingPageData(false);
      }
    };
    loadPatientInvoices();
  }, [patientId, authLoading, fetchInvoicesForPatient, isLoadingContextInvoices]);

  const isLoading = authLoading || isLoadingContextInvoices || isLoadingPageData;


  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading your billing information...</p>
      </div>
    );
  }

  if (!patientId) {
     return (
      <div className="text-center py-10">
        <p className="text-lg text-muted-foreground">Please log in to view your billing information.</p>
        <Button asChild className="mt-4">
            <Link href="/patient-portal/login">Go to Login</Link>
        </Button>
      </div>
    );
  }
  
  const handlePrintInvoice = () => {
    const printContent = document.getElementById('patient-invoice-view-content');
    if (printContent && selectedInvoiceForView) {
      const originalContents = document.body.innerHTML;
      const headerContent = `<div style="padding:20px; font-family: sans-serif;"><h2>Invoice: ${selectedInvoiceForView?.id}</h2><p>Patient: ${selectedInvoiceForView?.patientName}</p><p>Date: ${format(parseISO(selectedInvoiceForView.date), "PPP")}</p></div>`;
      document.body.innerHTML = headerContent + printContent.innerHTML;
      window.print();
      document.body.innerHTML = originalContents;
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-headline font-bold flex items-center">
                <CreditCard className="mr-3 h-7 w-7 text-primary" /> My Billing
            </h1>
            <p className="text-muted-foreground">View your invoices and payment status, {patientName}.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>

      {isLoadingPageData && invoices.length === 0 ? (
         <div className="flex justify-center items-center h-64">
             <Loader2 className="h-12 w-12 animate-spin text-primary" />
             <p className="ml-3 text-muted-foreground">Fetching your invoices...</p>
        </div>
      ) : invoices.length > 0 ? (
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle>Your Invoices</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total ({currency})</TableHead>
                    <TableHead>Paid ({currency})</TableHead>
                    <TableHead>Balance ({currency})</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.id}</TableCell>
                        <TableCell>{format(parseISO(invoice.date), "PPP")}</TableCell>
                        <TableCell>{formatCurrency(invoice.totalAmount, currency)}</TableCell>
                        <TableCell>{formatCurrency(invoice.amountPaid, currency)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(invoice.totalAmount - invoice.amountPaid, currency)}</TableCell>
                        <TableCell><Badge variant={invoiceStatusBadgeVariant(invoice.status)}>{invoice.status}</Badge></TableCell>
                        <TableCell className="text-right">
                             <Button variant="outline" size="sm" onClick={() => setSelectedInvoiceForView(invoice)}>
                                <Eye className="mr-2 h-4 w-4" /> View
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md">
          <CardContent className="p-10 flex flex-col items-center justify-center text-center">
            <CreditCard className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg text-muted-foreground">You have no invoices on record.</p>
            <p className="text-sm text-muted-foreground">Invoices for services will appear here.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedInvoiceForView} onOpenChange={() => setSelectedInvoiceForView(null)}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle className="font-headline text-xl">Invoice Details: {selectedInvoiceForView?.id}</DialogTitle>
                <DialogDescription>
                    Patient: {selectedInvoiceForView?.patientName} <br/>
                    Invoice Date: {selectedInvoiceForView?.date ? format(parseISO(selectedInvoiceForView.date), "PPP") : 'N/A'} | Due Date: {selectedInvoiceForView?.dueDate ? format(parseISO(selectedInvoiceForView.dueDate), "PPP") : 'N/A'}
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4" id="patient-invoice-view-content">
                <h3 className="font-semibold">Line Items:</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-center">Qty</TableHead>
                            <TableHead className="text-right">Unit Price ({currency})</TableHead>
                            <TableHead className="text-right">Total ({currency})</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {selectedInvoiceForView?.lineItems.map((item, index) => (
                            <TableRow key={item.id || `item-${index}`}>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className="text-center">{item.quantity}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.unitPrice, currency)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.total, currency)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Separator />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm ml-auto max-w-xs">
                    <div className="text-right font-medium">Subtotal:</div>
                    <div className="text-right">{formatCurrency(selectedInvoiceForView?.subTotal || 0, currency)}</div>

                    <div className="text-right font-medium">Tax ({(selectedInvoiceForView?.taxRate ?? 0).toFixed(1)}%):</div>
                    <div className="text-right">{formatCurrency(selectedInvoiceForView?.taxAmount || 0, currency)}</div>

                    <div className="text-right font-bold text-md border-t pt-1 mt-1">Total Amount:</div>
                    <div className="text-right font-bold text-md border-t pt-1 mt-1">{formatCurrency(selectedInvoiceForView?.totalAmount || 0, currency)}</div>

                    <div className="text-right font-medium">Amount Paid:</div>
                    <div className="text-right">{formatCurrency(selectedInvoiceForView?.amountPaid || 0, currency)}</div>

                    <div className="text-right font-bold text-md text-primary border-t pt-1 mt-1">Balance Due:</div>
                    <div className="text-right font-bold text-md text-primary border-t pt-1 mt-1">{formatCurrency(((selectedInvoiceForView?.totalAmount || 0) - (selectedInvoiceForView?.amountPaid || 0)), currency)}</div>
                </div>
                 {selectedInvoiceForView?.notes && (
                    <>
                        <Separator />
                        <div>
                            <h4 className="font-semibold text-sm">Notes:</h4>
                            <p className="text-xs text-muted-foreground whitespace-pre-line bg-muted/30 p-2 rounded-md">{selectedInvoiceForView.notes}</p>
                        </div>
                    </>
                 )}
            </div>
            <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedInvoiceForView(null)}>Close</Button>
                <Button onClick={handlePrintInvoice}><Printer className="mr-2 h-4 w-4"/>Print Invoice</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

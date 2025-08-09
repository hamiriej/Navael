// d:/projects/NavaelHospitalSystem/src/app/dashboard/billing/page.tsx

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CreditCard, DollarSign, FileText, PlusCircle, MoreHorizontal, Printer, Mail, Eye, Edit, Send, Phone, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { formatCurrency } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { useInvoices, Invoice, InvoiceStatus } from "@/contexts/invoice-context";
import { useAppointments } from "@/contexts/appointment-context"; // NEW: Import useAppointments

import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/firebase/config';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useSearchParams, useRouter } from "next/navigation";

export const NAVAEL_BILLING_INVOICES_STORAGE_KEY = 'navael_billing_invoices';

const recordPaymentSchema = z.object({
  paymentAmount: z.coerce.number().positive("Payment amount must be positive."),
});
type RecordPaymentFormValues = z.infer<typeof recordPaymentSchema>;

const pushPaymentSchema = z.object({
  phoneNumber: z.string().min(10, "A valid phone number is required.").regex(/^\+?[0-9\s-()]+$/, "Invalid phone number format (e.g., +2567XXXXXXXX or 07XXXXXXXX)."),
});
type PushPaymentFormValues = z.infer<typeof pushPaymentSchema>;


export const invoiceStatusBadgeVariant = (status: InvoiceStatus): BadgeProps["variant"] => {
  switch (status) {
    case "Paid": return "default";
    case "Pending Payment":
    case "Awaiting Push Payment":
      return "secondary";
    case "Partially Paid": return "outline";
    case "Overdue": return "destructive";
    case "Cancelled": return "destructive";
    case "Draft": return "outline";
    case "Billed": return "outline";
    default: return "default";
  }
};


export default function BillingPage() {
  const { invoices, isLoadingInvoices, updateInvoice } = useInvoices();
  // NEW: Get appointments and updateAppointment from useAppointments
  const { appointments, updateAppointment } = useAppointments();

  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<Invoice | null>(null);
  const [selectedInvoiceForPushPayment, setSelectedInvoiceForPushPayment] = useState<Invoice | null>(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [isPushPaymentSubmitting, setIsPushPaymentSubmitting] = useState(false);
  const { toast } = useToast();
  const { currency } = useAppearanceSettings();
  const [searchTerm, setSearchTerm] = useState("");

  const searchParams = useSearchParams();
  const router = useRouter();

  // --- FIX: Move useForm hooks here, before their usage in handler functions ---
  const paymentForm = useForm<RecordPaymentFormValues>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: { paymentAmount: 0 },
  });

  const pushPaymentForm = useForm<PushPaymentFormValues>({
    resolver: zodResolver(pushPaymentSchema),
    defaultValues: { phoneNumber: "" },
  });
  // --- END FIX ---

  useEffect(() => {
    const invoiceIdFromUrl = searchParams.get('invoiceId');

    if (invoiceIdFromUrl && invoices.length > 0) {
      const invoiceToOpen = invoices.find(inv => inv.id === invoiceIdFromUrl);

      if (invoiceToOpen && invoiceToOpen.id !== selectedInvoiceForView?.id) {
        setSelectedInvoiceForView(invoiceToOpen);
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete('invoiceId');
        // FIX: Removed 'shallow: true' as it's not recognized in newer Next.js Router
        router.replace(`?${newSearchParams.toString()}`);
      } else if (!invoiceToOpen && !isLoadingInvoices) {
        toast({
          title: "Invoice Not Found",
          description: `Could not find invoice with ID: ${invoiceIdFromUrl}. Please search manually.`,
          variant: "destructive",
          duration: 7000
        });
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete('invoiceId');
        // FIX: Removed 'shallow: true'
        router.replace(`?${newSearchParams.toString()}`);
      }
    }
  }, [searchParams, invoices, selectedInvoiceForView, isLoadingInvoices, toast, router]);


  const handleRecordPaymentSubmit = async (values: RecordPaymentFormValues) => {
    console.log("--- handleRecordPaymentSubmit initiated ---"); // Log start
    if (!selectedInvoiceForPayment) {
      console.warn("No invoice selected for payment. Aborting.");
      return;
    }
    setIsPaymentSubmitting(true);

    const currentInvoice = invoices.find(inv => inv.id === selectedInvoiceForPayment.id);
    if (!currentInvoice) {
      toast({ title: "Error", description: "Invoice not found for payment.", variant: "destructive" });
      setIsPaymentSubmitting(false);
      console.error("Invoice not found in current 'invoices' array for ID:", selectedInvoiceForPayment.id);
      return;
    }

    const newAmountPaid = parseFloat((currentInvoice.amountPaid + values.paymentAmount).toFixed(2));
    let newStatus: InvoiceStatus = currentInvoice.status;

    if (newAmountPaid >= currentInvoice.totalAmount) {
      newStatus = "Paid";
    } else if (newAmountPaid > 0) {
      newStatus = "Partially Paid";
    } else if (newAmountPaid === 0 && new Date(currentInvoice.dueDate + 'T00:00:00') < new Date() && currentInvoice.status !== "Cancelled" && currentInvoice.status !== "Draft") {
      newStatus = "Overdue";
    } else if (newAmountPaid === 0 && currentInvoice.status !== "Cancelled" && currentInvoice.status !== "Draft" && currentInvoice.status !== "Awaiting Push Payment") {
      newStatus = "Pending Payment";
    } else if (newAmountPaid === 0 && currentInvoice.status === "Awaiting Push Payment") {
      newStatus = "Awaiting Push Payment";
    }

    console.log("Calculated new invoice status:", newStatus);
    console.log("Invoice ID for update:", selectedInvoiceForPayment.id);
    console.log("New amount paid:", newAmountPaid);

    try {
      // 1. Update the Invoice
      await updateInvoice(selectedInvoiceForPayment.id, { amountPaid: newAmountPaid, status: newStatus });
      toast({
        title: "Payment Recorded",
        description: `Payment of ${formatCurrency(values.paymentAmount, currency)} for invoice ${selectedInvoiceForPayment.id} recorded. Status updated.`,
        variant: "default", // Corrected variant
      });
      console.log("Invoice update successful in Firestore.");

      // 2. Update the related Appointment (if any)
      if (newStatus === "Paid" || newStatus === "Partially Paid") {
        const relatedInvoiceId = selectedInvoiceForPayment.id;
        console.log("Searching for appointment linked to invoiceId:", relatedInvoiceId);

        // Log all appointments to check their invoiceId property
        if (appointments && appointments.length > 0) {
          console.log("Available appointments in context (ID and invoiceId):");
          appointments.forEach((appt, index) => {
            console.log(`  Appointment ${index}: ID='${appt.id}', invoiceId='${appt.invoiceId}', paymentStatus='${appt.paymentStatus}'`);
          });
        } else {
          console.log("No appointments loaded in context or appointments array is empty.");
        }

        // Attempt to find the related appointment
        const relatedAppointment = appointments.find(appt => appt.invoiceId === relatedInvoiceId);

        if (relatedAppointment) {
          console.log(`Match found! Related appointment ID: '${relatedAppointment.id}', Current paymentStatus: '${relatedAppointment.paymentStatus}'`);
          // Perform the update
          await updateAppointment(relatedAppointment.id, { paymentStatus: newStatus });
          console.log(`Attempted to update appointment '${relatedAppointment.id}' paymentStatus to: '${newStatus}'`);
          toast({
            title: "Appointment Status Updated",
            description: `Payment status for related appointment updated to ${newStatus}.`,
            variant: "default", // Corrected variant
          });
          console.log("Appointment update operation finished.");
        } else {
          console.warn(`No appointment found for invoice ID: '${relatedInvoiceId}'. This appointment might not have an 'invoiceId' or it's not loaded in the context.`);
          toast({
            title: "Appointment Not Linked",
            description: "Invoice updated, but no related appointment found to update its status.",
            variant: "default", // Corrected variant
          });
        }
      } else {
        console.log(`Invoice status (${newStatus}) does not trigger appointment payment status update. Skipping.`);
      }

      setSelectedInvoiceForPayment(null);
      paymentForm.reset();
      console.log("--- handleRecordPaymentSubmit finished successfully ---"); // Log successful end
    } catch (error: any) { // Catch more specific error if possible
      toast({ title: "Update Error", description: "Could not record payment or update appointment.", variant: "destructive" });
      console.error("Error during payment recording or appointment update:", error); // Log the full error object
      console.log("--- handleRecordPaymentSubmit finished with error ---"); // Log error end
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const handleRequestPushPaymentSubmit = async (values: PushPaymentFormValues) => {
    if (!selectedInvoiceForPushPayment) return;
    setIsPushPaymentSubmitting(true);

    try {
      const functions = getFunctions(db.app);
      const requestPaymentCallable = httpsCallable(functions, 'requestPushPayment');

      const result = await requestPaymentCallable({
        invoiceId: selectedInvoiceForPushPayment.id,
        phoneNumber: values.phoneNumber
      });

      const response = result.data as { status: string; message: string; newInvoiceStatus?: InvoiceStatus };

      if (response.status === "success") {
        toast({
          title: "Push Payment Request Sent",
          description: response.message,
        });
      } else {
        throw new Error(response.message || "Push payment request failed with an unknown error.");
      }
      setSelectedInvoiceForPushPayment(null);
      pushPaymentForm.reset();
    } catch (error: any) {
      console.error("Error calling Cloud Function for push payment:", error);
      let errorMessage = "Could not initiate push payment.";

      if (error.code) {
        errorMessage = `Payment request failed: ${error.message}`;
        switch (error.code) {
          case 'unauthenticated':
            errorMessage = "You are not authorized to make this request. Please log in.";
            break;
          case 'permission-denied':
            errorMessage = "You do not have permission to initiate push payments.";
            break;
          case 'invalid-argument':
            errorMessage = `Invalid input: ${error.message}`;
            break;
          case 'not-found':
            errorMessage = `Invoice not found: ${error.message}`;
            break;
          case 'failed-precondition':
            errorMessage = `Payment not possible: ${error.message}`;
            break;
          case 'internal':
            errorMessage = `An internal server error occurred: ${error.message}`;
            break;
          default:
            errorMessage = `An unexpected error occurred: ${error.message}`;
        }
      } else {
        errorMessage = `A network error occurred or the payment service is unavailable. Please try again.`;
      }
      toast({ title: "Push Payment Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsPushPaymentSubmitting(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice =>
      invoice.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.id.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, searchTerm]);

  if (isLoadingInvoices && filteredInvoices.length === 0 && searchTerm === "") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading invoices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <CreditCard className="mr-3 h-8 w-8 text-primary" /> Billing & Insurance
          </h1>
          <p className="text-muted-foreground">Manage patient invoices, payments, and insurance claims. Current currency: {currency}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/billing/invoices/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Invoice
          </Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-1 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><DollarSign className="mr-2 h-5 w-5 text-green-500" />Invoices</CardTitle>
            <Input
              placeholder="Search invoices by patient name or ID..."
              className="mt-2 max-w-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </CardHeader>
          <CardContent>
            {isLoadingInvoices && filteredInvoices.length === 0 && searchTerm === "" ? (
              <div className="flex justify-center items-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading invoices...</p>
              </div>
            ) : filteredInvoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total ({currency})</TableHead>
                    <TableHead>Paid ({currency})</TableHead>
                    <TableHead>Balance ({currency})</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.id}</TableCell>
                      <TableCell>
                        <Link href={`/dashboard/patients/${invoice.patientId}`} className="hover:underline text-primary">
                          {invoice.patientName}
                        </Link>
                      </TableCell>
                      <TableCell>{format(parseISO(invoice.date), "PPP")}</TableCell>
                      <TableCell>{formatCurrency(invoice.totalAmount, currency)}</TableCell>
                      <TableCell>{formatCurrency(invoice.amountPaid, currency)}</TableCell>
                      <TableCell>{formatCurrency(invoice.totalAmount - invoice.amountPaid, currency)}</TableCell>
                      <TableCell><Badge variant={invoiceStatusBadgeVariant(invoice.status)}>{invoice.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedInvoiceForView(invoice)}><Eye className="mr-2 h-4 w-4" />View Invoice</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => alert(`Editing invoice ${invoice.id}`)} disabled={invoice.status === 'Paid' || invoice.status === 'Cancelled'}><Edit className="mr-2 h-4 w-4" />Edit Invoice</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {(invoice.status === "Pending Payment" || invoice.status === "Overdue" || invoice.status === "Awaiting Push Payment" || invoice.status === "Partially Paid") && (
                              <DropdownMenuItem onClick={() => { setSelectedInvoiceForPayment(invoice); paymentForm.setValue("paymentAmount", parseFloat((invoice.totalAmount - invoice.amountPaid).toFixed(2))); }}>
                                <DollarSign className="mr-2 h-4 w-4" />Record Payment
                              </DropdownMenuItem>
                            )}
                            {(invoice.status === "Pending Payment" || invoice.status === "Overdue" || invoice.status === "Partially Paid") && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedInvoiceForPushPayment(invoice);
                                  pushPaymentForm.reset();
                                }}
                              >
                                <Send className="mr-2 h-4 w-4" />Request Push Payment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => {
                              if (selectedInvoiceForView?.id !== invoice.id) setSelectedInvoiceForView(invoice);
                              setTimeout(() => {
                                const printContent = document.getElementById('invoice-view-content');
                                if (printContent) {
                                  const originalContents = document.body.innerHTML;
                                  const headerContent = `<div style="padding:20px; font-family: sans-serif;"><h2>Invoice: ${invoice.id}</h2><p>Patient: ${invoice.patientName}</p></div>`;
                                  document.body.innerHTML = headerContent + printContent.innerHTML;
                                  window.print();
                                  document.body.innerHTML = originalContents;
                                  window.location.reload(); // Reload to restore page state after print
                                } else {
                                  setSelectedInvoiceForView(invoice);
                                  toast({ title: "Print Preview Ready", description: "Invoice details loaded in dialog. Click 'Print Invoice' there." })
                                }
                              }, 50);
                            }}
                            >
                              <Printer className="mr-2 h-4 w-4" />Print Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => alert(`Sending reminder for invoice ${invoice.id}`)}><Mail className="mr-2 h-4 w-4" />Send Reminder</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/10 rounded-b-md p-6 text-center">
                <DollarSign className="h-16 w-16 text-muted-foreground/40 mb-3" />
                <p className="text-lg text-muted-foreground">No invoices found.</p>
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? "Try adjusting your search term." : "Create a new invoice or check back later."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedInvoiceForPayment} onOpenChange={(isOpen) => { if (!isOpen) { setSelectedInvoiceForPayment(null); paymentForm.reset(); setIsPaymentSubmitting(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment for Invoice {selectedInvoiceForPayment?.id}</DialogTitle>
            <DialogDescription>
              Patient: {selectedInvoiceForPayment?.patientName} <br />
              Total Due: {formatCurrency(selectedInvoiceForPayment?.totalAmount || 0, currency)} | Amount Paid: {formatCurrency(selectedInvoiceForPayment?.amountPaid || 0, currency)} <br />
              Balance: <span className="font-semibold">{formatCurrency(((selectedInvoiceForPayment?.totalAmount || 0) - (selectedInvoiceForPayment?.amountPaid || 0)), currency)}</span>
            </DialogDescription>
          </DialogHeader>
          {/* CRITICAL FIX: Wrap form fields in an HTML <form> element */}
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handleRecordPaymentSubmit)} className="space-y-4 py-4">
              <FormField
                control={paymentForm.control}
                name="paymentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount ({currency})</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isPaymentSubmitting}>
                  {isPaymentSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record Payment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedInvoiceForView} onOpenChange={() => setSelectedInvoiceForView(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">Invoice Details: {selectedInvoiceForView?.id}</DialogTitle>
            <DialogDescription>
              Patient: {selectedInvoiceForView?.patientName} (ID: {selectedInvoiceForView?.patientId}) <br />
              Invoice Date: {selectedInvoiceForView?.date ? format(parseISO(selectedInvoiceForView.date), "PPP") : 'N/A'} | Due Date: {selectedInvoiceForView?.dueDate ? format(parseISO(selectedInvoiceForView.dueDate), "PPP") : 'N/A'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4" id="invoice-view-content">
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
            <Button onClick={() => {
              const printContent = document.getElementById('invoice-view-content');
              if (printContent && selectedInvoiceForView) {
                const originalContents = document.body.innerHTML;
                const headerContent = `<div style="padding:20px; font-family: sans-serif;"><h2>Invoice: ${selectedInvoiceForView?.id}</h2><p>Patient: ${selectedInvoiceForView?.patientName}</p><p>Date: ${format(parseISO(selectedInvoiceForView.date), "PPP")}</p></div>`;
                document.body.innerHTML = headerContent + printContent.innerHTML;
                window.print();
                document.body.innerHTML = originalContents;
              }
            }}><Printer className="mr-2 h-4 w-4" />Print Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!selectedInvoiceForPushPayment} onOpenChange={(isOpen) => { if (!isOpen) { setSelectedInvoiceForPushPayment(null); pushPaymentForm.reset(); setIsPushPaymentSubmitting(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Push Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the patient's mobile money phone number to simulate a push payment request for invoice <span className="font-semibold">{selectedInvoiceForPushPayment?.id}</span> (Patient: {selectedInvoiceForPushPayment?.patientName}).
              The invoice status will be updated to "Awaiting Push Payment".
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* CRITICAL FIX: Wrap form fields in an HTML <form> element */}
          <Form {...pushPaymentForm}>
            <form onSubmit={pushPaymentForm.handleSubmit(handleRequestPushPaymentSubmit)} className="space-y-4 py-2">
              <FormField
                control={pushPaymentForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4" />Mobile Money Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="e.g., +2567XXXXXXXX or 07XXXXXXXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setSelectedInvoiceForPushPayment(null); pushPaymentForm.reset(); }}>Cancel</AlertDialogCancel>
                <Button type="submit" disabled={isPushPaymentSubmitting}>
                  {isPushPaymentSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm & Send Request
                </Button>
              </AlertDialogFooter>
            </form>
          </Form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

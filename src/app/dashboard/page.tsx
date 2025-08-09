
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { ROLES, type Role } from "@/lib/constants";
import { CalendarCheck, Users, Settings, Pill, BedDouble, MessageSquareText, FilePieChart, CreditCard, ListChecks, FlaskConical, FileSearch, Download, Eye, CheckCircle, Edit, CheckSquare, ListChecks as ListChecksIcon, Droplets, Activity, Microscope, ClipboardCheck as ClipboardCheckIcon, ServerCog, Archive, BookOpenCheck, PackagePlus, Clock, User as UserIcon, Network, NotebookPen, UserPlus as UserPlusIcon, PlusCircle, CalendarClock, Inbox, Sparkles as AiIcon, Loader2, Send, History as HistoryIcon, UserCog, AlertTriangle, FileText, PackageSearch, DollarSign, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, parseISO, formatDistanceToNow } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import * as LucideIcons from 'lucide-react';
import { cn } from "@/lib/utils";
import { bookAppointmentWithAI, type BookAppointmentAIInput, type BookAppointmentAIOutput } from "@/ai/flows/book-appointment-ai-flow";

import { getActivityLog, type ActivityLogItem } from "@/lib/activityLog";

// Corrected and updated imports from ./lab/page and context
import type { LabOrder, LabTest } from "@/app/dashboard/lab/types";
import {
  StatCard,
  getLabStatusVariant,
  paymentStatusBadgeVariant as getLabPaymentStatusBadgeVariant,
  LAB_ORDERS_STORAGE_KEY
} from "./lab/page";
import { useLabOrders } from "@/contexts/lab-order-context"; // Import the context

import {
  type Appointment, // type only
  statusBadgeVariant as getAppointmentStatusVariant,
} from "./appointments/page";
import { useAppointments } from "@/contexts/appointment-context";

import { useInvoices } from "@/contexts/invoice-context";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";


interface Widget {
  title: string;
  description: string;
  icon: React.ElementType;
  link: string;
  roles: Role[];
  tooltipText?: string;
}

const widgets: Widget[] = [
  { title: "Upcoming Appointments", description: "View and manage your appointments.", icon: CalendarCheck, link: "/dashboard/appointments", roles: [ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST, ROLES.ADMIN, ROLES.PHARMACIST] },
  { title: "Patient Records", description: "Access and update patient information.", icon: Users, link: "/dashboard/patients", roles: Object.values(ROLES) },
  { title: "Consultations", description: "Manage patient consultation records.", icon: MessageSquareText, link: "/dashboard/consultations", roles: [ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMIN] },
  { title: "Lab Results Viewer", description: "Review completed lab test results.", icon: FlaskConical, link: "/dashboard/lab", roles: [ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.PHARMACIST, ] },
  { title: "Pharmacy Portal", description: "Manage medications and prescriptions.", icon: Pill, link: "/dashboard/pharmacy", roles: [ROLES.PHARMACIST, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST] },
  { title: "Admissions", description: "Manage patient admissions and bed assignments.", icon: BedDouble, link: "/dashboard/admissions", roles: [ROLES.NURSE, ROLES.RECEPTIONIST, ROLES.ADMIN] },
  { title: "Billing & Insurance", description: "Handle patient billing and insurance claims.", icon: CreditCard, link: "/dashboard/billing", roles: [ROLES.RECEPTIONIST, ROLES.ADMIN] },
  { title: "Staff Schedule", description: "Manage staff rotas and availability.", icon: ListChecksIcon, link: "/dashboard/staff-schedule", roles: Object.values(ROLES), tooltipText: "View & Manage Staff Schedules" },
  { title: "System Reports", description: "View reports and system performance.", icon: FilePieChart, link: "/dashboard/reports", roles: [ROLES.ADMIN] },
  { title: "Administrator Panel", description: "Access all administrative functions.", icon: Settings, link: "/dashboard/admin", roles: [ROLES.ADMIN] },
];

const receptionistQuickActionButtons = [
    { label: "Book Appointment", icon: NotebookPen, href: "/dashboard/appointments/new" },
    { label: "Add New Patient", icon: UserPlusIcon, href: "/dashboard/patients/new" },
    { label: "Create New Invoice", icon: PlusCircle, href: "/dashboard/billing/invoices/new" },
    { label: "New Admission", icon: BedDouble, href: "/dashboard/admissions/new" },
];

export const IconRenderer = ({ iconName, className }: { iconName?: keyof typeof LucideIcons, className?: string }) => {
  if (!iconName) return <LucideIcons.AlertCircle className={cn("h-5 w-5 text-muted-foreground", className)} />;
  const IconComponent = LucideIcons[iconName] as React.ElementType;
  if (!IconComponent) return <LucideIcons.HelpCircle className={cn("h-5 w-5 text-muted-foreground", className)} />;
  return <IconComponent className={cn("h-5 w-5 text-primary flex-shrink-0", className)} />;
};

// Helper function to map invoice line item source to a display category
const mapSourceTypeToCategory = (sourceType?: string): string => {
  switch (sourceType) {
    case 'consultation':
      return 'Appointment';
    case 'lab':
      return 'Lab';
    case 'prescription':
      return 'Pharmacy';
    case 'general_service':
    case 'hospital_stay':
    case 'manual':
    default:
      return 'Other';
  }
};


export default function DashboardPage() {
  const { userRole, username } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { appointments, isLoadingAppointments } = useAppointments();

  // Lab Tech Dashboard Specific State & Logic - Now using context
  const { labOrders: contextLabOrders, isLoadingLabOrders: isLoadingContextLabOrders, updateLabOrder, fetchLabOrders } = useLabOrders();
  const [searchTerm, setSearchTerm] = useState(""); // Search term for lab orders
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<LabOrder | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({}); // For individual button loading

    // Add these hooks for revenue calculation
  const { invoices, isLoadingInvoices } = useInvoices();
  const { currency } = useAppearanceSettings();

  // Calculate today's revenue for receptionist, memoized for performance.
  const { todaysRevenue, departmentTotals } = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todaysInvoices = invoices.filter(inv => format(new Date(inv.date), "yyyy-MM-dd") === today);
    
    // Initialize with all desired categories to ensure they appear even if zero
    const serviceTotals: Record<string, number> = {
      'Appointment': 0,
      'Lab': 0,
      'Pharmacy': 0,
      'Other': 0,
    };

    todaysInvoices.forEach(inv => {
      // Prioritize categorizing by appointmentId if it exists. This is the most reliable way
      // to attribute revenue to an appointment-related activity.
      if (inv.appointmentId) {
        serviceTotals['Appointment'] += (inv.amountPaid || 0);
      } else if (inv.lineItems && inv.lineItems.length > 0) {
        // Prorate the amount paid across the line items based on their value
        const prorationFactor = (inv.totalAmount > 0) ? (inv.amountPaid || 0) / inv.totalAmount : 0;

        inv.lineItems.forEach(item => {
          const category = mapSourceTypeToCategory(item.sourceType);
          const proratedAmount = (item.total || 0) * prorationFactor;
          serviceTotals[category] = (serviceTotals[category] || 0) + proratedAmount;
        });
      } else {
        // Final fallback for invoices with no line items and no appointment link
        serviceTotals['Other'] += (inv.amountPaid || 0);
      }
    });
    const totalRevenue = Object.values(serviceTotals).reduce((sum, amt) => sum + amt, 0);

    return { todaysRevenue: totalRevenue, departmentTotals: serviceTotals };
  }, [invoices]);

  const pieChartData = useMemo(() => {
    return Object.entries(departmentTotals)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [departmentTotals]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent === 0) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12px" fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([]);
  const [isLoadingActivityLog, setIsLoadingActivityLog] = useState(true);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<BookAppointmentAIOutput | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  const upcomingAppointments = useMemo(() => {
    if (isLoadingAppointments) return [];
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    return appointments
      .filter(app => new Date(app.date) >= todayDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.time.localeCompare(b.time))
      .slice(0, 4);
  }, [appointments, isLoadingAppointments]);


  useEffect(() => {
    const fetchLog = async () => {
        setIsLoadingActivityLog(true);
        try {
            const log = await getActivityLog();
            setActivityLog(log);
        } catch (error) {
            console.error("Error fetching activity log:", error);
            toast({title: "Error", description: "Could not load activity log.", variant: "destructive"});
        }
        setIsLoadingActivityLog(false);
    };
    fetchLog();

    const handleStorageChange = (event: StorageEvent) => {
      // For global activity log, if an API isn't used for real-time updates,
      // and other tabs might modify the localStorage directly for the log,
      // this could be a way to pick up changes.
      // However, since logActivity now POSTs, this specific listener might be less critical
      // unless there's a polling mechanism or a need for direct localStorage sync.
      // For this refactor, we'll assume the API is the source of truth for GETs.
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [toast]);

  // Fetch lab orders if user is Lab Tech and context hasn't loaded them yet
  useEffect(() => {
    if (userRole === ROLES.LAB_TECH && contextLabOrders.length === 0 && !isLoadingContextLabOrders) {
      fetchLabOrders();
    }
  }, [userRole, contextLabOrders.length, isLoadingContextLabOrders, fetchLabOrders]);



  const handleMarkSampleCollected = async (orderId: string) => {
    setActionLoading(prev => ({...prev, [orderId]: true}));
    const orderToUpdate = contextLabOrders.find(o => o.id === orderId);
    if (orderToUpdate) {
      const updatedOrderData: Partial<Omit<LabOrder, 'id'>> = {
        status: "Sample Collected",
        sampleCollectionDate: new Date().toISOString()
      };
      try {
        await updateLabOrder(orderId, updatedOrderData);
        toast({ title: "Sample Collected", description: `Order ${orderId} marked as sample collected.` });
        // Logging activity is now handled inside updateLabOrder context function (or its API sim)
      } catch (error) {
        toast({ title: "Error", description: "Could not mark sample collected.", variant: "destructive" });
      }
    }
    setActionLoading(prev => ({...prev, [orderId]: false}));
  };

  const handleVerifyResults = async (orderId: string) => {
    setActionLoading(prev => ({...prev, [orderId]: true}));
    const orderToUpdate = contextLabOrders.find(o => o.id === orderId);
    if (orderToUpdate) {
      const updatedOrderData: Partial<Omit<LabOrder, 'id'>> = {
        status: "Results Ready",
        verifiedBy: username || "Lab System",
        verificationDate: new Date().toISOString()
      };
      try {
        await updateLabOrder(orderId, updatedOrderData);
        toast({ title: "Results Verified", description: `Order ${orderId} results verified and released.` });
        // Logging activity is now handled inside updateLabOrder context function
      } catch (error) {
        toast({ title: "Error", description: "Could not verify results.", variant: "destructive" });
      }
    }
    setActionLoading(prev => ({...prev, [orderId]: false}));
  };

    const filteredLabOrdersForTech = useMemo(() => {
    if (userRole !== ROLES.LAB_TECH) return [];
    // Ensure contextLabOrders is an array before filtering
    if (!Array.isArray(contextLabOrders)) {
        console.warn("contextLabOrders is not an array:", contextLabOrders);
        return [];
    }

    return contextLabOrders.filter(order => {
        // Add optional chaining and nullish coalescing to ensure we're always calling .toLowerCase() on a string
        const patientName = (order.patientName ?? "").toLowerCase();
        const orderId = (order.id ?? "").toLowerCase();
        const orderingDoctor = (order.orderingDoctor ?? "").toLowerCase();
        const lowerCaseSearchTerm = searchTerm.toLowerCase();

        return patientName.includes(lowerCaseSearchTerm) ||
               orderId.includes(lowerCaseSearchTerm) ||
               orderingDoctor.includes(lowerCaseSearchTerm);
    });
  }, [contextLabOrders, searchTerm, userRole]); // Dependencies remain the same

  const sampleCollectionQueue = useMemo(() => filteredLabOrdersForTech.filter(o => o.status === "Sample Collected"), [filteredLabOrdersForTech]);
  const testProcessingQueue = useMemo(() => filteredLabOrdersForTech.filter(o => o.status === "Processing"), [filteredLabOrdersForTech]);
  const resultsVerificationQueue = useMemo(() => filteredLabOrdersForTech.filter(o => o.status === "Awaiting Verification"), [filteredLabOrdersForTech]);
  const archivedReports = useMemo(() => filteredLabOrdersForTech.filter(o => o.status === "Results Ready" || o.status === "Cancelled"), [filteredLabOrdersForTech]);

  const totalActiveOrders = sampleCollectionQueue.length + testProcessingQueue.length + resultsVerificationQueue.length;


  const labQuickActionButtons = [
    { label: "View Incoming Orders", icon: Inbox, href: "/dashboard/lab/incoming-orders", action: null },
    { label: "Log QC Results", icon: ClipboardCheckIcon, href: "/dashboard/lab/qc/new", action: null },
    { label: "Instrument Status", icon: ServerCog, href: "/dashboard/lab/instruments", action: null },
    { label: "Manage Supplies", icon: Archive, href: "/dashboard/lab/supplies", action: null },
    { label: "Access Protocols", icon: BookOpenCheck, href: "/dashboard/lab/protocols", action: null },
  ];

  const handleParseWithAI = async () => {
    if (!aiInstruction.trim()) {
      toast({ title: "Input Required", description: "Please enter an appointment request.", variant: "destructive" });
      return;
    }
    setIsProcessingAI(true);
    setAiSuggestion(null);
    try {
      const input: BookAppointmentAIInput = {
        instruction: aiInstruction,
        currentDate: format(new Date(), "yyyy-MM-dd"),
      };
      // AI flow invocation moved to API route
      const response = await fetch('/api/ai/book-appointment-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown API error" }));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }
      const result = await response.json() as BookAppointmentAIOutput;
      setAiSuggestion(result);

      if (!result.parsedSuccessfully && result.aiConfidenceNotes) {
        toast({ title: "AI Suggestion", description: result.aiConfidenceNotes, duration: 7000 });
      } else if (result.errorMessage) {
        toast({ title: "AI Error", description: result.errorMessage, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "AI Error", description: error.message || "Could not process request with AI.", variant: "destructive" });
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleProceedToBook = () => {
    if (!aiSuggestion || !aiSuggestion.parsedSuccessfully) return;
    const queryParams = new URLSearchParams();
    if (aiSuggestion.patientName) queryParams.append("aiPatientName", aiSuggestion.patientName);
    if (aiSuggestion.providerName) queryParams.append("aiProviderName", aiSuggestion.providerName);
    if (aiSuggestion.appointmentDateString) queryParams.append("aiDate", aiSuggestion.appointmentDateString);
    if (aiSuggestion.timeSlotString) queryParams.append("aiTime", aiSuggestion.timeSlotString);
    if (aiSuggestion.appointmentType) queryParams.append("aiType", aiSuggestion.appointmentType);

    router.push(`/dashboard/appointments/new?${queryParams.toString()}`);
  };


  if (!userRole) {
    return null; // Or a loading spinner if auth state is still resolving
  }

  const relevantActivityLog = useMemo(() => {
    if (!activityLog || activityLog.length === 0) return [];
    if (userRole === ROLES.ADMIN) return activityLog.slice(0, 10);
    if (userRole === ROLES.LAB_TECH) return activityLog.filter(item => item.actionDescription.toLowerCase().includes("lab") || item.targetEntityType === "Lab Order").slice(0, 7);
    if (userRole === ROLES.PHARMACIST) return activityLog.filter(item => item.actionDescription.toLowerCase().includes("pharmacy") || item.actionDescription.toLowerCase().includes("prescribe") || item.targetEntityType === "Prescription" || item.targetEntityType === "Medication Inventory").slice(0,7);
    return activityLog.filter(item => item.actorName === username || item.actorRole === userRole).slice(0, 5);
  }, [activityLog, userRole, username]);


  if (userRole === ROLES.LAB_TECH) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold flex items-center">
              <FlaskConical className="mr-3 h-8 w-8 text-primary" /> Laboratory Portal
            </h1>
            <p className="text-muted-foreground">Welcome, {username}! Manage lab orders, sample processing, and results.</p>
          </div>
           <Input
              placeholder="Search all orders by Patient, Order ID, or Doctor..."
              className="max-w-md w-full md:w-auto"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Card className="shadow-md">
          <CardHeader>
              <CardTitle className="font-headline text-lg">Quick Actions</CardTitle>
              <CardDescription>Common tasks for lab technicians.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {labQuickActionButtons.map(item => (
                  item.href && item.href !== "#" ? (
                      <Button key={item.label} variant="outline" className="flex-col h-auto py-3 px-2 text-center" asChild>
                         <Link href={item.href}>
                              <item.icon className="h-6 w-6 mb-1" />
                              <span className="text-xs leading-tight">{item.label}</span>
                         </Link>
                      </Button>
                  ) : (
                      <Button key={item.label} variant="outline" className="flex-col h-auto py-3 px-2 text-center" onClick={item.action || (() => alert(`${item.label}: Functionality to be implemented.`))}>
                          <item.icon className="h-6 w-6 mb-1" />
                          <span className="text-xs leading-tight">{item.label}</span>
                      </Button>
                  )
              ))}
          </CardContent>
        </Card>

        {isLoadingContextLabOrders && contextLabOrders.length === 0 ? (
            <div className="flex justify-center items-center p-10 min-h-[200px]">
                <Loader2 className="h-10 w-10 animate-spin text-primary"/>
            </div>
        ) : (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <StatCard title="Awaiting Sample Collection" value={sampleCollectionQueue.length} icon={Droplets} description="Orders needing samples." />
              <StatCard title="Samples in Processing" value={testProcessingQueue.length} icon={Microscope} description="Collected & processing." />
              <StatCard title="Results for Verification" value={resultsVerificationQueue.length} icon={ClipboardCheckIcon} description="Results need final check." />
              <StatCard title="Total Active Orders" value={totalActiveOrders} icon={Activity} description="Sum of all pending stages." />
            </div>

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="font-headline text-lg flex items-center"><HistoryIcon className="mr-2 h-5 w-5 text-primary"/>Recent Lab Activity</CardTitle>
                    <CardDescription>A log of recent key actions within the lab or affecting lab orders.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingActivityLog && relevantActivityLog.length === 0 ? (
                         <div className="flex items-center justify-center min-h-[100px]">
                            <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                        </div>
                    ): relevantActivityLog.length > 0 ? (
                        <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {relevantActivityLog.map(activity => (
                                <li key={activity.id} className="flex items-start space-x-3 p-2 border-b border-muted/50 last:border-b-0">
                                    <IconRenderer iconName={activity.iconName} className="mt-1" />
                                    <div className="flex-grow">
                                        <p className="text-sm text-foreground">{activity.actionDescription}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })} by {activity.actorName} ({activity.actorRole})
                                        </p>
                                        {activity.details && <p className="text-xs text-muted-foreground/80">{activity.details}</p>}
                                    </div>
                                    {activity.targetLink && (
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href={activity.targetLink}><Eye className="h-4 w-4"/></Link>
                                        </Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">No recent lab-related activity logged.</p>
                    )}
                </CardContent>
            </Card>


            <Tabs defaultValue="sample-collection-queue">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                <TabsTrigger value="sample-collection-queue">Sample Collection ({sampleCollectionQueue.length})</TabsTrigger>
                <TabsTrigger value="test-processing-queue">Test Processing ({testProcessingQueue.length})</TabsTrigger>
                <TabsTrigger value="results-verification-queue">Verification Queue ({resultsVerificationQueue.length})</TabsTrigger>
                <TabsTrigger value="archived-reports">Archived Reports ({archivedReports.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="sample-collection-queue">
                <Card className="shadow-md mt-4">
                  <CardHeader>
                    <CardTitle className="font-headline flex items-center"><Clock className="mr-2 h-5 w-5 text-primary" />Sample Collection Queue</CardTitle>
                    <CardDescription>Orders with status "Sample Collected" and awaiting result entry. Acknowledge from "Incoming Orders" to move them here.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sampleCollectionQueue.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Patient</TableHead>
                            <TableHead>Order Date</TableHead>
                            <TableHead>Ordered Tests</TableHead>
                            <TableHead>Ordered By</TableHead>
                            <TableHead>Payment</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sampleCollectionQueue.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell>{order.id}</TableCell>
                              <TableCell>{order.patientName} (ID: {order.patientId})</TableCell>
                              <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                              <TableCell>{order.tests.map(t => t.name).join(', ')}</TableCell>
                              <TableCell>{order.orderingDoctor}</TableCell>
                              <TableCell>
                                <Badge variant={getLabPaymentStatusBadgeVariant(order.paymentStatus)}>
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
                                {order.status === "Sample Collected" && (
                                     <Button size="sm" asChild variant="outline" disabled={actionLoading[order.id]}>
                                        <Link href={`/dashboard/lab/results/entry/${order.id}`}>
                                        {actionLoading[order.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Edit className="mr-2 h-4 w-4" />} Enter Results
                                        </Link>
                                    </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/10 rounded-md text-center">
                        <Clock className="h-16 w-16 text-muted-foreground/40 mb-3" />
                        <p className="text-lg text-muted-foreground">No orders currently in the sample collection queue.</p>
                         <p className="text-sm text-muted-foreground">Check "Incoming Orders" quick action to acknowledge new requests.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="test-processing-queue">
                <Card className="shadow-md mt-4">
                  <CardHeader>
                    <CardTitle className="font-headline flex items-center"><Microscope className="mr-2 h-5 w-5 text-primary"/>Test Processing Queue</CardTitle>
                    <CardDescription>Samples collected and actively being processed or awaiting result entry.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {testProcessingQueue.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Patient</TableHead>
                            <TableHead>Sample Collected</TableHead>
                            <TableHead>Tests</TableHead>
                            <TableHead>Payment</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {testProcessingQueue.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell>{order.id}</TableCell>
                              <TableCell>{order.patientName}</TableCell>
                              <TableCell>{order.sampleCollectionDate ? new Date(order.sampleCollectionDate).toLocaleString() : "N/A"}</TableCell>
                              <TableCell>{order.tests.map(t => t.name).join(', ')}</TableCell>
                              <TableCell>
                                <Badge variant={getLabPaymentStatusBadgeVariant(order.paymentStatus)}>
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
                                  <Button size="sm" asChild variant="outline" disabled={actionLoading[order.id]}>
                                    <Link href={`/dashboard/lab/results/entry/${order.id}`}>
                                    {actionLoading[order.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Edit className="mr-2 h-4 w-4" />} Enter/Update Results
                                    </Link>
                                  </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/10 rounded-md text-center">
                        <Microscope className="h-16 w-16 text-muted-foreground/40 mb-3" />
                        <p className="text-lg text-muted-foreground">No samples in the processing queue.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="results-verification-queue">
                <Card className="shadow-md mt-4">
                  <CardHeader>
                    <CardTitle className="font-headline flex items-center"><ListChecksIcon className="mr-2 h-5 w-5 text-primary"/>Results Verification Queue</CardTitle>
                    <CardDescription>Lab results entered and awaiting final verification and release.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {resultsVerificationQueue.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Patient</TableHead>
                            <TableHead>Order Date</TableHead>
                            <TableHead>Tests Entered</TableHead>
                            <TableHead>Payment</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {resultsVerificationQueue.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell>{order.id}</TableCell>
                              <TableCell>{order.patientName}</TableCell>
                              <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                              <TableCell>{order.tests.filter(t => t.status === 'Result Entered').length} / {order.tests.length}</TableCell>
                              <TableCell>
                                 <Badge variant={getLabPaymentStatusBadgeVariant(order.paymentStatus)}>
                                    <DollarSign className="mr-1 h-3 w-3"/>{order.paymentStatus || "N/A"}
                                </Badge>
                                {order.invoiceId && (
                                    <Link href="/dashboard/billing" className="ml-1 text-xs text-primary hover:underline">
                                        (Inv: {order.invoiceId})
                                    </Link>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                  <Button size="sm" variant="default" onClick={() => handleVerifyResults(order.id)} disabled={order.paymentStatus !== "Paid" || actionLoading[order.id]}>
                                      {actionLoading[order.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckSquare className="mr-2 h-4 w-4"/>} Verify & Release
                                      {order.paymentStatus !== "Paid" && " (Pay Pending)"}
                                  </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/10 rounded-md text-center">
                        <ListChecksIcon className="h-16 w-16 text-muted-foreground/40 mb-3" />
                        <p className="text-lg text-muted-foreground">No results awaiting verification.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="archived-reports">
                <Card className="shadow-md mt-4">
                  <CardHeader>
                    <CardTitle className="font-headline flex items-center"><FileSearch className="mr-2 h-5 w-5 text-primary"/>Archived Lab Reports</CardTitle>
                    <CardDescription>Search and view finalized or cancelled lab reports.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {archivedReports.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Patient</TableHead>
                            <TableHead>Finalized/Cancelled Date</TableHead>
                            <TableHead>Ordered By</TableHead>
                             <TableHead>Payment</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {archivedReports.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell>{order.id}</TableCell>
                              <TableCell>{order.patientName} (ID: {order.patientId})</TableCell>
                              <TableCell>{order.verificationDate ? new Date(order.verificationDate).toLocaleDateString() : (order.sampleCollectionDate ? new Date(order.sampleCollectionDate).toLocaleDateString() : new Date(order.orderDate).toLocaleDateString())}</TableCell>
                              <TableCell>{order.orderingDoctor}</TableCell>
                               <TableCell>
                                 <Badge variant={getLabPaymentStatusBadgeVariant(order.paymentStatus)}>
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
                                <Dialog open={selectedOrderForModal?.id === order.id} onOpenChange={(isOpen) => {
                                  if (!isOpen) setSelectedOrderForModal(null);
                                }}>
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
                                            Ordered By: {order.orderingDoctor} on {new Date(order.orderDate).toLocaleDateString()} <br/>
                                            Sample Collected: {order.sampleCollectionDate ? new Date(order.sampleCollectionDate).toLocaleString() : "N/A"} <br />
                                            {order.verifiedBy && `Verified By: ${order.verifiedBy} on ${order.verificationDate ? new Date(order.verificationDate).toLocaleString() : "N/A"}`}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="max-h-[60vh] overflow-y-auto pr-2">
                                        <Table>
                                            <TableHeader>
                                            <TableRow>
                                                <TableHead>Test Name</TableHead>
                                                <TableHead>Result</TableHead>
                                                <TableHead>Reference Range</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Tech Notes</TableHead>
                                            </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                            {order.tests.map(test => (
                                                <TableRow key={test.id}>
                                                <TableCell className="font-medium">{test.name}</TableCell>
                                                <TableCell>{test.result || "N/A"}</TableCell>
                                                <TableCell>{test.referenceRange || "N/A"}</TableCell>
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
                                        <Button onClick={() => alert("Printing report... (functionality to be implemented)")}><Download className="mr-2 h-4 w-4"/>Print/Download</Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/10 rounded-md text-center">
                        <FileSearch className="h-16 w-16 text-muted-foreground/40 mb-3" />
                        <p className="text-lg text-muted-foreground">No archived reports found.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
        </>
        )}
      </div>
    );
  }

  const pharmacistQuickActionButtons = [
    { label: "View Prescription Queue", icon: FileText, href: "/dashboard/pharmacy" }, 
    { label: "Manage Inventory", icon: PackageSearch, href: "/dashboard/pharmacy" }, 
    { label: "Add New Medication", icon: PlusCircle, href: "/dashboard/pharmacy/inventory/new" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight">Welcome, {username || userRole}!</h1>
        <p className="text-muted-foreground">Here&apos;s what&apos;s happening in your department today.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {isLoadingAppointments && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>}
        {!isLoadingAppointments && upcomingAppointments.length > 0 && (userRole !== ROLES.PHARMACIST) && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="font-headline text-lg flex items-center">
                  <CalendarClock className="mr-2 h-5 w-5 text-primary" /> Today's / Upcoming Appointments
              </CardTitle>
              <CardDescription>A quick look at the schedule.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-3 h-52 overflow-y-auto pr-2">
                  {upcomingAppointments.map(app => (
                    <li key={app.id} className="p-3 border rounded-md hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <Link href={`/dashboard/patients/${app.patientId}`} className="hover:underline text-primary font-medium">
                          {app.patientName}
                        </Link>
                         <Badge variant={getAppointmentStatusVariant(app.status)}>{app.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{app.type} with {app.providerName}</p>
                      <p className="text-sm text-muted-foreground">{format(parseISO(app.date), "MMM d, yyyy")} at {app.time}</p>
                    </li>
                  ))}
                </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" asChild className="w-full">
                  <Link href="/dashboard/appointments">View All Appointments</Link>
              </Button>
            </CardFooter>
          </Card>
        )}

        {userRole && (isLoadingActivityLog && relevantActivityLog.length === 0) ? (
          <Card className="shadow-md">
              <CardHeader><CardTitle className="font-headline text-lg">Recent Activity</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-center min-h-[100px]"><Loader2 className="h-6 w-6 animate-spin text-primary"/></CardContent>
          </Card>
        ) : userRole && relevantActivityLog.length > 0 ? (
           <Card className="shadow-md">
              <CardHeader>
                  <CardTitle className="font-headline text-lg flex items-center"><HistoryIcon className="mr-2 h-5 w-5 text-primary"/>Recent System Activity</CardTitle>
                  <CardDescription>A log of key actions. {userRole === ROLES.ADMIN ? "Showing global activity." : `Showing relevant activity for ${userRole}.`}</CardDescription>
              </CardHeader>
              <CardContent>
                  <ul className="space-y-3 h-52 overflow-y-auto pr-2">
                      {relevantActivityLog.map(activity => (
                          <li key={activity.id} className="flex items-start space-x-3 p-2 border-b border-muted/50 last:border-b-0">
                              <IconRenderer iconName={activity.iconName} className="mt-1" />
                              <div className="flex-grow">
                                  <p className="text-sm text-foreground">{activity.actionDescription}</p>
                                  <p className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })} by {activity.actorName} ({activity.actorRole})
                                  </p>
                                  {activity.details && <p className="text-xs text-muted-foreground/80">{activity.details}</p>}
                              </div>
                              {activity.targetLink && (
                                  <Button variant="ghost" size="sm" asChild>
                                      <Link href={activity.targetLink}><Eye className="h-4 w-4"/></Link>
                                  </Button>
                              )}
                          </li>
                      ))}
                  </ul>
              </CardContent>
          </Card>
        ) : userRole ? (
          <Card className="shadow-md">
            <CardHeader><CardTitle className="font-headline text-lg">Recent Activity</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">No recent activity to display.</p></CardContent>
          </Card>
        ): null}
      </div>


      {userRole === ROLES.RECEPTIONIST && (
        <>
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="font-headline text-lg">Quick Actions</CardTitle>
                <CardDescription>Your common tasks, one click away.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                {receptionistQuickActionButtons.map(item => (
                  <Button key={item.label} variant="outline" className="flex-col h-auto py-4 px-3 text-center items-center justify-center" asChild>
                    <Link href={item.href}>
                      <item.icon className="h-7 w-7 mb-2 text-primary" />
                      <span className="text-sm font-medium leading-tight">{item.label}</span>
                    </Link>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Today's Revenue Breakdown</CardTitle>
                  <CardDescription>Collected by service type ({currency})</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary mb-2">
                    Total: {isLoadingInvoices ? <Loader2 className="h-6 w-6 animate-spin inline-block" /> : `${currency} ${todaysRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  </div>
                  <ul className="space-y-1">
                    {Object.entries(departmentTotals).map(([dept, amount]) => (
                      <li key={dept} className="flex justify-between text-sm">
                        <span>{dept}</span>
                        <span>{currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                  <CardHeader>
                      <CardTitle>Revenue Distribution</CardTitle>
                      <CardDescription>Percentage of revenue from each service.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center">
                      {pieChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                              <PieChart>
                                  <Pie
                                      data={pieChartData}
                                      cx="50%"
                                      cy="50%"
                                      labelLine={false}
                                      label={renderCustomizedLabel}
                                      outerRadius={100}
                                      fill="#8884d8"
                                      dataKey="value"
                                  >
                                      {pieChartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip formatter={(value: number) => [`${currency} ${value.toFixed(2)}`, "Revenue"]} />
                                  <Legend />
                              </PieChart>
                          </ResponsiveContainer>
                      ) : (
                          <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                              <PackageSearch className="h-12 w-12 mb-2" />
                              <p>No revenue data for today to display chart.</p>
                          </div>
                      )}
                  </CardContent>
              </Card>
            </div>

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="font-headline text-lg flex items-center"><AiIcon className="mr-2 h-5 w-5 text-primary"/>AI Appointment Assistant</CardTitle>
                    <CardDescription>Describe the appointment request, and the AI will help parse the details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        placeholder="e.g., 'Book Alice Smith with Dr. Jones for a follow-up next Wednesday afternoon.'"
                        value={aiInstruction}
                        onChange={(e) => setAiInstruction(e.target.value)}
                        rows={3}
                    />
                    <Button onClick={handleParseWithAI} disabled={isProcessingAI || !aiInstruction.trim()} className="w-full">
                        {isProcessingAI && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Send className="mr-2 h-4 w-4" /> Parse with AI
                    </Button>
                    {aiSuggestion && (
                        <Card className="bg-muted/50 p-4">
                            <CardHeader className="p-0 pb-2">
                                <CardTitle className="text-md">AI Suggestion:</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 space-y-1 text-sm">
                                {aiSuggestion.patientName && <p><strong>Patient:</strong> {aiSuggestion.patientName}</p>}
                                {aiSuggestion.providerName && <p><strong>Provider:</strong> {aiSuggestion.providerName}</p>}
                                {aiSuggestion.appointmentDateString && <p><strong>Date:</strong> {aiSuggestion.appointmentDateString}</p>}
                                {aiSuggestion.timeSlotString && <p><strong>Time:</strong> {aiSuggestion.timeSlotString}</p>}
                                {aiSuggestion.appointmentType && <p><strong>Type:</strong> {aiSuggestion.appointmentType}</p>}
                                {aiSuggestion.aiConfidenceNotes && <p className="mt-2 text-xs text-muted-foreground italic"><strong>AI Notes:</strong> {aiSuggestion.aiConfidenceNotes}</p>}
                                {aiSuggestion.errorMessage && <p className="text-destructive text-xs"><strong>Error:</strong> {aiSuggestion.errorMessage}</p>}
                            </CardContent>
                            {aiSuggestion.parsedSuccessfully && !aiSuggestion.errorMessage && (
                                <CardFooter className="p-0 pt-3">
                                    <Button onClick={handleProceedToBook} size="sm" className="w-full">Proceed to Book This Appointment</Button>
                                </CardFooter>
                            )}
                        </Card>
                    )}
                </CardContent>
            </Card>
        </>
      )}

      {userRole === ROLES.PHARMACIST && (
         <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="font-headline text-lg">Pharmacist Quick Actions</CardTitle>
                <CardDescription>Key tasks for pharmacy operations.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {pharmacistQuickActionButtons.map(item => (
                  <Button key={item.label} variant="outline" className="flex-col h-auto py-4 px-3 text-center items-center justify-center" asChild>
                    <Link href={item.href}>
                      <item.icon className="h-7 w-7 mb-2 text-primary" />
                      <span className="text-sm font-medium leading-tight">{item.label}</span>
                    </Link>
                  </Button>
                ))}
              </CardContent>
            </Card>
      )}


      {(() => {
        const availableWidgets = widgets.filter(widget => userRole && widget.roles.includes(userRole));
        if (availableWidgets.length > 0) {
          return (
            <div>
              <h2 className="text-2xl font-headline font-semibold tracking-tight mb-4 mt-8">Key Modules</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {availableWidgets.map((widget) => (
                  <Link href={widget.link} key={widget.title} className="block hover:no-underline">
                    <Card className="hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-lg font-medium font-headline">{widget.title}</CardTitle>
                        <widget.icon className="h-6 w-6 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground">{widget.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })()}


      {userRole && !widgets.filter(widget => widget.roles.includes(userRole)).length && (
  <Card>
    <CardContent className="p-6">
      <p className="text-center text-muted-foreground">No specific modules available for your role at the moment.</p>
    </CardContent>
  </Card>
)}
    </div>
  );
}

    

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { FilePieChart, CalendarClock, Activity, Users2, TrendingUp, BarChartHorizontalBig, LineChart as LineChartIcon, BarChart2 as BarChartIcon, DollarSign, AlertTriangle, Syringe, PackageSearch, Hourglass, UserCheck, Contact, Loader2, Percent, Box, BriefcaseMedical, UserCog, Eye, Users, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/shared/date-range-picker";
import { useState, useEffect, useMemo, useCallback } from "react";
import type { DateRange } from "react-day-picker";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { BarChart, LineChart, XAxis, YAxis, Bar, Line, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer } from "recharts";
import * as RechartsPrimitive from "recharts";
import type { Invoice } from "../billing/page";
import { NAVAEL_BILLING_INVOICES_STORAGE_KEY } from "../billing/page";
import { useAppearanceSettings } from "@/contexts/appearance-settings-context";
import { formatCurrency, convertToCSV, triggerCsvDownload, triggerTxtDownload } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, differenceInHours, differenceInMinutes, isWithinInterval, getDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from 'next/navigation';


import { type Appointment, APPOINTMENTS_STORAGE_KEY } from "../appointments/page";
import { type Medication, type Prescription } from "../pharmacy/page"; // Keep type imports
import { usePatients, type Patient } from "@/contexts/patient-context";
import { type LabOrder, LAB_ORDERS_STORAGE_KEY, mockLabOrdersStore as initialLabOrders, getStatusVariant as getLabStatusVariant, paymentStatusBadgeVariant as getLabPaymentStatusBadgeVariant, type LabTest } from "../lab/page";
import { type Consultation } from "../consultations/page";
import { type MockUser, getAllStaffUsers as fetchAllStaffUsers } from "../admin/user-management/page";
import { USER_MANAGEMENT_STORAGE_KEY } from "@/contexts/auth-context"; 
import { ROLES } from "@/lib/constants";
import { getActivityLog, type ActivityLogItem } from "@/lib/activityLog";
import { IconRenderer } from "../page";


const chartConfig = {
  count: { label: "Patients", color: "hsl(var(--chart-1))" },
  appointments: { label: "Appointments", color: "hsl(var(--chart-2))" },
  // Add more series configurations as needed
  "0-10": { label: "0-10 yrs", color: "hsl(var(--chart-1))" },
  "11-20": { label: "11-20 yrs", color: "hsl(var(--chart-2))" },
  "21-30": { label: "21-30 yrs", color: "hsl(var(--chart-3))" },
  "31-40": { label: "31-40 yrs", color: "hsl(var(--chart-4))" },
  "41-50": { label: "41-50 yrs", color: "hsl(var(--chart-5))" },
  "51-60": { label: "51-60 yrs", color: "hsl(var(--chart-1))" },
  "61-70": { label: "61-70 yrs", color: "hsl(var(--chart-2))" },
  "71+": { label: "71+ yrs", color: "hsl(var(--chart-3))" },
} satisfies import("@/components/ui/chart").ChartConfig;

interface PlaceholderReportCard {
  title: string;
  description: string;
  icon: React.ElementType;
  category: string;
  id: string;
  link?: string; // Optional link for clickable cards
}

const placeholderReportCards: PlaceholderReportCard[] = [
  // Placeholder cards are now mostly functional, but we keep the structure if needed
];

interface OutstandingInvoiceInfo extends Invoice {
  amountDue: number;
}

const initialConsultationsData: Consultation[] = [];
const initialMedicationsData: Medication[] = [];
const initialPrescriptionsData: Prescription[] = [];

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [totalPaidRevenue, setTotalPaidRevenue] = useState(0);
  const [outstandingRevenue, setOutstandingRevenue] = useState(0);
  const [outstandingInvoicesList, setOutstandingInvoicesList] = useState<OutstandingInvoiceInfo[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const { currency } = useAppearanceSettings();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [appointmentsData, setAppointmentsData] = useState<Appointment[]>([]);
  const [medications, setMedications] = useState<Medication[]>(initialMedicationsData);
  const { patients, isLoading: isLoadingPatients } = usePatients();

  const [allLabOrdersData, setAllLabOrdersData] = useState<LabOrder[]>(initialLabOrders);
  const [allPrescriptionsData, setAllPrescriptionsData] = useState<Prescription[]>(initialPrescriptionsData);
  const [allConsultationsData, setAllConsultationsData] = useState<Consultation[]>(initialConsultationsData);
  const [allStaffUsers, setAllStaffUsers] = useState<MockUser[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>(undefined);


  useEffect(() => {
    const staffIdFromQuery = searchParams.get('staffId');
    if (staffIdFromQuery) {
        if (allStaffUsers.length > 0 && allStaffUsers.find(u => u.id === staffIdFromQuery)) {
            setSelectedStaffId(staffIdFromQuery);
        } else if (allStaffUsers.length === 0) {
            // This case remains; logic below handles loading staff users.
        }
    }
  }, [searchParams, allStaffUsers]);


  useEffect(() => {
    const loadInitialData = () => {
      setIsLoadingData(true);
      try {
        const storedAppointments = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
        setAppointmentsData(storedAppointments ? JSON.parse(storedAppointments) : []);

        setMedications(initialMedicationsData); // Use local empty initial array
        setAllPrescriptionsData(initialPrescriptionsData); // Use local empty initial array

        const storedLabOrders = localStorage.getItem(LAB_ORDERS_STORAGE_KEY);
        setAllLabOrdersData(storedLabOrders ? JSON.parse(storedLabOrders) : initialLabOrders);
        
        setAllConsultationsData(initialConsultationsData); // Use local empty initial array

        setAllStaffUsers(fetchAllStaffUsers());
        setActivityLog(getActivityLog());

      } catch (error) {
        console.error("Error loading data for reports page:", error);
      }
      setIsLoadingData(false);
    };
    loadInitialData();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === APPOINTMENTS_STORAGE_KEY && event.newValue) setAppointmentsData(JSON.parse(event.newValue));
      if (event.key === LAB_ORDERS_STORAGE_KEY && event.newValue) setAllLabOrdersData(JSON.parse(event.newValue));
      if (event.key === USER_MANAGEMENT_STORAGE_KEY && event.newValue) setAllStaffUsers(JSON.parse(event.newValue));
      if (event.key === 'navael_global_activity_log' && event.newValue) setActivityLog(JSON.parse(event.newValue));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const processInvoiceData = useCallback(() => {
    try {
      const storedInvoices = localStorage.getItem(NAVAEL_BILLING_INVOICES_STORAGE_KEY);
      const invoices: Invoice[] = storedInvoices ? JSON.parse(storedInvoices) : [];

      let paidRevenue = 0;
      let pendingRevenue = 0;
      const currentOutstandingInvoices: OutstandingInvoiceInfo[] = [];

      invoices.forEach(invoice => {
        const invoiceDate = parseISO(invoice.date);
        if (dateRange?.from && invoiceDate < dateRange.from) return;
        if (dateRange?.to && invoiceDate > dateRange.to) return;

        if (invoice.status === "Paid") {
          paidRevenue += invoice.totalAmount;
        } else if (["Pending Payment", "Partially Paid", "Overdue"].includes(invoice.status)) {
          const amountDue = invoice.totalAmount - invoice.amountPaid;
          pendingRevenue += amountDue;
          currentOutstandingInvoices.push({ ...invoice, amountDue });
        }
      });

      setTotalPaidRevenue(paidRevenue);
      setOutstandingRevenue(pendingRevenue);
      setOutstandingInvoicesList(
        currentOutstandingInvoices.sort((a, b) => parseISO(b.dueDate).getTime() - parseISO(a.dueDate).getTime())
      );
    } catch (error) {
      console.error("Error processing invoice data:", error);
    }
  }, [dateRange]);

  useEffect(() => {
    processInvoiceData();
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === NAVAEL_BILLING_INVOICES_STORAGE_KEY) {
        processInvoiceData();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [processInvoiceData]);

  const filteredAppointments = useMemo(() => {
    return appointmentsData.filter(app => {
      const appDate = parseISO(app.date);
      if (dateRange?.from && appDate < dateRange.from) return false;
      if (dateRange?.to && appDate > dateRange.to) return false;
      return true;
    });
  }, [appointmentsData, dateRange]);
  
  const appointmentCancellationRate = useMemo(() => {
    if (!filteredAppointments.length) return { rate: 0, total: 0, cancelled: 0 };
    const total = filteredAppointments.length;
    const cancelled = filteredAppointments.filter(a => a.status === 'Cancelled').length;
    return { rate: parseFloat(((cancelled / total) * 100).toFixed(1)), total, cancelled };
  }, [filteredAppointments]);

  const lowStockMedications = useMemo(() => {
    return medications.filter(med => med.status === 'Low Stock' || med.status === 'Out of Stock');
  }, [medications]);

  const totalPatients = useMemo(() => patients.length, [patients]);
  
  const filteredLabOrders = useMemo(() => {
    return allLabOrdersData.filter(order => {
      const orderDate = parseISO(order.orderDate);
      if (dateRange?.from && orderDate < dateRange.from) return false;
      if (dateRange?.to && orderDate > dateRange.to) return false;
      return true;
    });
  }, [allLabOrdersData, dateRange]);

  const labOrderVolume = useMemo(() => {
    const byStatus = filteredLabOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
    }, {} as Record<LabOrder["status"], number>);
    return { total: filteredLabOrders.length, byStatus };
  }, [filteredLabOrders]);

  const averageTestTurnaroundTime = useMemo(() => {
    const completedOrders = filteredLabOrders.filter(order =>
        order.status === "Results Ready" &&
        order.sampleCollectionDate &&
        order.verificationDate
    );
    if (completedOrders.length === 0) return { averageHours: 0, count: 0, orders: [] };
    const tatData = completedOrders.map(order => {
      const tatMinutes = differenceInMinutes(parseISO(order.verificationDate!), parseISO(order.sampleCollectionDate!));
      return { ...order, tatHours: parseFloat((tatMinutes / 60).toFixed(1)) };
    });
    const totalTATMinutes = tatData.reduce((sum, order) => sum + (order.tatHours * 60), 0);
    return { 
      averageHours: parseFloat((totalTATMinutes / completedOrders.length / 60).toFixed(1)), 
      count: completedOrders.length,
      orders: tatData
    };
  }, [filteredLabOrders]);

  const medicationDispensingTrends = useMemo(() => {
    const dispensed = allPrescriptionsData.filter(rx =>
        rx.status === "Dispensed" &&
        (!dateRange?.from || parseISO(rx.date) >= dateRange.from) &&
        (!dateRange?.to || parseISO(rx.date) <= dateRange.to)
    );
    const trends = dispensed.reduce((acc, rx) => {
        const key = `${rx.medicationName} ${rx.dosage}`;
        acc[key] = (acc[key] || 0) + rx.quantity;
        return acc;
    }, {} as Record<string, number>);
    return Object.entries(trends)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, quantity]) => ({ name, quantity }));
  }, [allPrescriptionsData, dateRange]);

  const providerUtilization = useMemo(() => {
    const utilization = filteredAppointments.reduce((acc, app) => {
        acc[app.providerName] = (acc[app.providerName] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    return Object.entries(utilization)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
  }, [filteredAppointments]);

  const userLoginActivity = useMemo(() => {
    return allStaffUsers.slice(0, 5).map(user => ({ name: user.name, role: user.role, lastLogin: user.lastLogin, email: user.email, status: user.status }));
  }, [allStaffUsers]);


  // Staff Activity Report Data
  const selectedStaffMember = useMemo(() => {
    return allStaffUsers.find(user => user.id === selectedStaffId);
  }, [selectedStaffId, allStaffUsers]);

  const staffActivityData = useMemo(() => {
    if (!selectedStaffId || !selectedStaffMember) return null;

    const staffName = selectedStaffMember.name;
    const staffRole = selectedStaffMember.role;

    const filteredData = {
      appointments: filteredAppointments.filter(app => app.providerName === staffName).length,
      consultations: allConsultationsData.filter(con =>
        con.doctorName === staffName &&
        (!dateRange || (isWithinInterval(parseISO(con.consultationDate), { start: dateRange.from || new Date(0), end: dateRange.to || new Date() })))
      ).length,
      labOrdersVerified: (staffRole === ROLES.LAB_TECH) ? filteredLabOrders.filter(order =>
        order.verifiedBy === staffName &&
        order.verificationDate
      ).length : 0,
      prescriptionsDispensed: (staffRole === ROLES.PHARMACIST) ? allPrescriptionsData.filter(rx =>
        rx.status === "Dispensed" &&
        (!dateRange || (isWithinInterval(parseISO(rx.date), { start: dateRange.from || new Date(0), end: dateRange.to || new Date() })))
      ).length : 0, 
      activityLogEntries: activityLog.filter(log => log.actorName === staffName).slice(0,5),
    };
    return filteredData;
  }, [selectedStaffId, selectedStaffMember, filteredAppointments, allConsultationsData, filteredLabOrders, allPrescriptionsData, activityLog, dateRange]);

  const patientAgeDemographicsData = useMemo(() => {
    if (isLoadingPatients || patients.length === 0) return [];
    const ageGroups = {
      "0-10": 0, "11-20": 0, "21-30": 0, "31-40": 0,
      "41-50": 0, "51-60": 0, "61-70": 0, "71+": 0,
    };
    patients.forEach(patient => {
      const age = patient.age;
      if (age <= 10) ageGroups["0-10"]++;
      else if (age <= 20) ageGroups["11-20"]++;
      else if (age <= 30) ageGroups["21-30"]++;
      else if (age <= 40) ageGroups["31-40"]++;
      else if (age <= 50) ageGroups["41-50"]++;
      else if (age <= 60) ageGroups["51-60"]++;
      else if (age <= 70) ageGroups["61-70"]++;
      else ageGroups["71+"]++;
    });
    return Object.entries(ageGroups).map(([ageGroup, count]) => ({
      ageGroup,
      count,
      fill: chartConfig[ageGroup as keyof typeof chartConfig]?.color || "hsl(var(--chart-1))",
    }));
  }, [patients, isLoadingPatients]);

  const weeklyAppointmentVolumeData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const volumeByDay = days.map(day => ({ day, appointments: 0, fill: "hsl(var(--chart-1))" }));

    filteredAppointments.forEach(app => {
      const appDate = parseISO(app.date);
      const dayIndex = getDay(appDate); // 0 for Sun, 1 for Mon, etc.
      if (volumeByDay[dayIndex]) {
        volumeByDay[dayIndex].appointments++;
      }
    });
    return volumeByDay;
  }, [filteredAppointments]);


  // --- Download Handlers ---
  const handleDownloadRevenueSummary = () => {
    const content = `Revenue Summary Report (${format(new Date(), "yyyy-MM-dd")})\n` +
                    `Selected Period: ${dateRange?.from ? format(dateRange.from, "PPP") : 'Start'} to ${dateRange?.to ? format(dateRange.to, "PPP") : 'End'}\n\n` +
                    `Total Paid Revenue: ${formatCurrency(totalPaidRevenue, currency)}\n` +
                    `Total Outstanding Revenue: ${formatCurrency(outstandingRevenue, currency)}`;
    triggerTxtDownload(content, `revenue_summary_${format(new Date(), "yyyyMMdd")}.txt`);
    toast({ title: "Report Downloaded", description: "Revenue summary downloaded." });
  };

  const handleDownloadOutstandingInvoices = () => {
    if (outstandingInvoicesList.length === 0) {
      toast({ title: "No Data", description: "No outstanding invoices to download." });
      return;
    }
    const dataToExport = outstandingInvoicesList.map(inv => ({
      "Invoice ID": inv.id,
      "Patient Name": inv.patientName,
      "Patient ID": inv.patientId,
      "Date": inv.date,
      "Due Date": inv.dueDate,
      "Total Amount": formatCurrency(inv.totalAmount, currency),
      "Amount Paid": formatCurrency(inv.amountPaid, currency),
      "Amount Due": formatCurrency(inv.amountDue, currency),
      "Status": inv.status,
    }));
    const csv = convertToCSV(dataToExport);
    triggerCsvDownload(csv, `outstanding_invoices_${format(new Date(), "yyyyMMdd")}.csv`);
  };

  const handleDownloadAppointmentCancellations = () => {
    if (filteredAppointments.length === 0) {
      toast({ title: "No Data", description: "No appointment data to download." });
      return;
    }
    const dataToExport = filteredAppointments.map(app => ({
      "Appointment ID": app.id,
      "Patient Name": app.patientName,
      "Patient ID": app.patientId,
      "Provider": app.providerName,
      "Date": app.date,
      "Time": app.time,
      "Type": app.type,
      "Status": app.status,
      "Payment Status": app.paymentStatus || "N/A",
      "Invoice ID": app.invoiceId || "N/A",
    }));
    const csv = convertToCSV(dataToExport);
    triggerCsvDownload(csv, `appointment_analysis_${format(new Date(), "yyyyMMdd")}.csv`);
  };

  const handleDownloadLowStockMedications = () => {
    if (lowStockMedications.length === 0) {
      toast({ title: "No Data", description: "No low stock medications to download." });
      return;
    }
    const dataToExport = lowStockMedications.map(med => ({
      "Medication ID": med.id,
      "Name": med.name,
      "Dosage": med.dosage,
      "Stock": med.stock,
      "Category": med.category,
      "Expiry Date": med.expiryDate,
      "Status": med.status,
      "Supplier": med.supplier || "N/A",
      "Price/Unit": formatCurrency(med.pricePerUnit, currency),
    }));
    const csv = convertToCSV(dataToExport);
    triggerCsvDownload(csv, `low_stock_medications_${format(new Date(), "yyyyMMdd")}.csv`);
  };

  const handleDownloadPatientDemographics = () => {
    if (patients.length === 0) {
      toast({ title: "No Data", description: "No patient data to download." });
      return;
    }
    const dataToExport = patients.map(p => ({
      "Patient ID": p.id,
      "Name": p.name,
      "Age": p.age,
      "Gender": p.gender,
      "Date of Birth": p.dateOfBirth,
      "Contact Number": p.contactNumber,
      "Email": p.email,
      "Address": `${p.address.line1}${p.address.line2 ? `, ${p.address.line2}` : ''}, ${p.address.city}, ${p.address.state} ${p.address.postalCode}`,
      "Status": p.status,
    }));
    const csv = convertToCSV(dataToExport);
    triggerCsvDownload(csv, `patient_demographics_${format(new Date(), "yyyyMMdd")}.csv`);
  };
  
  const handleDownloadUserLoginActivity = () => {
    if (userLoginActivity.length === 0) {
      toast({ title: "No Data", description: "No user activity data to download."});
      return;
    }
    const dataToExport = userLoginActivity.map(user => ({
      "Name": user.name,
      "Role": user.role,
      "Last Login": user.lastLogin,
      "Email": user.email,
      "Status": user.status,
    }));
    const csv = convertToCSV(dataToExport);
    triggerCsvDownload(csv, `user_login_activity_${format(new Date(), "yyyyMMdd")}.csv`);
  };

  const handleDownloadLabOrderVolume = () => {
    if (filteredLabOrders.length === 0) {
      toast({ title: "No Data", description: "No lab order data to download for the selected period."});
      return;
    }
    const dataToExport = filteredLabOrders.map(order => ({
      "Order ID": order.id,
      "Patient Name": order.patientName,
      "Order Date": order.orderDate,
      "Ordering Doctor": order.orderingDoctor,
      "Tests": order.tests.map(t => t.name).join('; '),
      "Status": order.status,
      "Payment Status": order.paymentStatus || "N/A",
      "Invoice ID": order.invoiceId || "N/A",
    }));
    const csv = convertToCSV(dataToExport);
    triggerCsvDownload(csv, `lab_order_volume_${format(new Date(), "yyyyMMdd")}.csv`);
  };

  const handleDownloadTestTurnaroundTime = () => {
    if (averageTestTurnaroundTime.orders.length === 0) {
      toast({ title: "No Data", description: "No completed lab orders with TAT data to download."});
      return;
    }
    const dataToExport = averageTestTurnaroundTime.orders.map(order => ({
      "Order ID": order.id,
      "Patient Name": order.patientName,
      "Sample Collected": order.sampleCollectionDate ? format(parseISO(order.sampleCollectionDate), "Pp") : "N/A",
      "Results Verified": order.verificationDate ? format(parseISO(order.verificationDate), "Pp") : "N/A",
      "TAT (Hours)": order.tatHours,
    }));
    const csv = convertToCSV(dataToExport);
    triggerCsvDownload(csv, `test_turnaround_time_${format(new Date(), "yyyyMMdd")}.csv`);
  };

  const handleDownloadMedicationDispensingTrends = () => {
    if (medicationDispensingTrends.length === 0) {
      toast({ title: "No Data", description: "No medication dispensing data to download."});
      return;
    }
    const dataToExport = medicationDispensingTrends.map(trend => ({
      "Medication": trend.name,
      "Quantity Dispensed": trend.quantity,
    }));
    const csv = convertToCSV(dataToExport);
    triggerCsvDownload(csv, `medication_dispensing_trends_${format(new Date(), "yyyyMMdd")}.csv`);
  };

  const handleDownloadProviderUtilization = () => {
    if (providerUtilization.length === 0) {
      toast({ title: "No Data", description: "No provider utilization data to download."});
      return;
    }
    const dataToExport = providerUtilization.map(([provider, count]) => ({
      "Provider Name": provider,
      "Appointments Count": count,
    }));
    const csv = convertToCSV(dataToExport);
    triggerCsvDownload(csv, `provider_utilization_${format(new Date(), "yyyyMMdd")}.csv`);
  };

  const handleDownloadStaffActivityReport = () => {
    if (!selectedStaffMember || !staffActivityData) {
      toast({ title: "No Staff Selected", description: "Please select a staff member to download their activity report." });
      return;
    }
    let reportContent = `Staff Activity Report for: ${selectedStaffMember.name} (${selectedStaffMember.role})\n`;
    reportContent += `Period: ${dateRange?.from ? format(dateRange.from, "PPP") : 'Start'} to ${dateRange?.to ? format(dateRange.to, "PPP") : 'End'}\n\n`;

    reportContent += `Summary:\n`;
    if (selectedStaffMember.role === ROLES.DOCTOR || selectedStaffMember.role === ROLES.NURSE) {
      reportContent += `- Appointments Handled: ${staffActivityData.appointments}\n`;
      reportContent += `- Consultations Performed: ${staffActivityData.consultations}\n`;
    }
    if (selectedStaffMember.role === ROLES.LAB_TECH) {
      reportContent += `- Lab Orders Verified: ${staffActivityData.labOrdersVerified}\n`;
    }
    if (selectedStaffMember.role === ROLES.PHARMACIST) {
      reportContent += `- Prescriptions Dispensed (System Wide): ${staffActivityData.prescriptionsDispensed}\n`;
    }
    reportContent += "\nRecent Activity Log Mentions:\n";
    if (staffActivityData.activityLogEntries.length > 0) {
      staffActivityData.activityLogEntries.forEach(log => {
        reportContent += `- ${format(parseISO(log.timestamp), "Pp")}: ${log.actionDescription}${log.details ? ` (${log.details})` : ''}\n`;
      });
    } else {
      reportContent += "No recent activity log entries found.\n";
    }
    triggerTxtDownload(reportContent, `staff_activity_${selectedStaffMember.name.replace(/\s+/g, '_')}_${format(new Date(), "yyyyMMdd")}.txt`);
  };

  const handleDownloadAgeDemographicsChartData = () => {
    if (patientAgeDemographicsData.length === 0) {
      toast({ title: "No Data", description: "No patient age demographics data to download." });
      return;
    }
    const dataToExport = patientAgeDemographicsData.map(item => ({
      "Age Group": item.ageGroup,
      "Patient Count": item.count,
    }));
    const csv = convertToCSV(dataToExport);
    triggerCsvDownload(csv, `patient_age_demographics_${format(new Date(), "yyyyMMdd")}.csv`);
  };

  const handleDownloadWeeklyAppointmentVolumeChartData = () => {
    if (weeklyAppointmentVolumeData.every(day => day.appointments === 0)) {
      toast({ title: "No Data", description: "No weekly appointment volume data to download." });
      return;
    }
    const dataToExport = weeklyAppointmentVolumeData.map(item => ({
      "Day of Week": item.day,
      "Appointments": item.appointments,
    }));
    const csv = convertToCSV(dataToExport);
    triggerCsvDownload(csv, `weekly_appointment_volume_${format(new Date(), "yyyyMMdd")}.csv`);
  };


  if (isLoadingData || isLoadingPatients) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <FilePieChart className="mr-3 h-8 w-8 text-primary" /> System Reports
          </h1>
          <p className="text-muted-foreground">Generate and view various system and operational reports.</p>
        </div>
        <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {/* Revenue Summary Card */}
        <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col xl:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              <CardTitle className="font-headline text-xl">Revenue Summary</CardTitle>
            </div>
            <CardDescription>Financial income and outstanding amounts {dateRange?.from ? `from ${format(dateRange.from, "LLL dd, y")}`: ''} {dateRange?.to ? `to ${format(dateRange.to, "LLL dd, y")}`: ''}.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            {isLoadingData ? (
              <div className="flex items-center justify-center min-h-[150px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Paid Revenue</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaidRevenue, currency)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Outstanding Revenue</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(outstandingRevenue, currency)}</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-4">
            <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadRevenueSummary}>
              Download Summary
            </Button>
          </CardFooter>
        </Card>

        {/* Outstanding Invoices Card */}
        <Link href="/dashboard/billing" className="block hover:no-underline xl:col-span-1">
          <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-primary" />
                <CardTitle className="font-headline text-xl">Outstanding Invoices</CardTitle>
              </div>
              <CardDescription>Unpaid and overdue patient invoices {dateRange?.from ? `from ${format(dateRange.from, "LLL dd, y")}`: ''} {dateRange?.to ? `to ${format(dateRange.to, "LLL dd, y")}`: ''}. Click to view details.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              {isLoadingData ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                outstandingInvoicesList.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <p className="text-sm text-muted-foreground">Total Outstanding Invoices:</p>
                      <p className="text-xl font-bold">{outstandingInvoicesList.length}</p>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <p className="text-sm text-muted-foreground">Total Amount Outstanding:</p>
                      <p className="text-xl font-bold text-orange-600">{formatCurrency(outstandingRevenue, currency)}</p>
                    </div>
                    <div className="mt-2 max-h-60 overflow-y-auto">
                      <Table size="sm">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">ID</TableHead>
                            <TableHead className="text-xs">Patient</TableHead>
                            <TableHead className="text-xs text-right">Due</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {outstandingInvoicesList.slice(0, 5).map(inv => (
                            <TableRow key={inv.id}>
                              <TableCell className="text-xs py-1">{inv.id}</TableCell>
                              <TableCell className="text-xs py-1">{inv.patientName}</TableCell>
                              <TableCell className="text-xs py-1 text-right">{formatCurrency(inv.amountDue, currency)}
                                  <br/><span className="text-muted-foreground/80">{format(parseISO(inv.dueDate), "MMM d, yy")}</span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {outstandingInvoicesList.length > 5 && <p className="text-xs text-center text-muted-foreground mt-2">...and {outstandingInvoicesList.length - 5} more.</p>}
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/10 rounded-md text-center">
                    <AlertTriangle className="h-16 w-16 text-muted-foreground/40 mb-3" />
                    <p className="text-lg text-muted-foreground">No outstanding invoices for the selected period.</p>
                  </div>
                )
              )}
            </CardContent>
            <CardFooter className="pt-4">
                  <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.preventDefault(); handleDownloadOutstandingInvoices(); }}>
                      Download Full Report
                  </Button>
              </CardFooter>
          </Card>
        </Link>

        {/* Appointment Cancellation Rate Card */}
        <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col xl:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Percent className="h-6 w-6 text-primary" />
              <CardTitle className="font-headline text-xl">Appointment Cancellation Rate</CardTitle>
            </div>
            <CardDescription>Analysis of cancelled vs. total appointments {dateRange?.from ? `from ${format(dateRange.from, "LLL dd, y")}`: ''} {dateRange?.to ? `to ${format(dateRange.to, "LLL dd, y")}`: ''}.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            {(isLoadingData || isLoadingPatients || !appointmentsData) ? (
              <div className="flex items-center justify-center min-h-[150px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cancellation Rate</p>
                  <p className="text-3xl font-bold text-destructive">{appointmentCancellationRate.rate}%</p>
                </div>
                <div className="flex justify-between text-sm">
                    <span>Total Appointments:</span>
                    <span>{appointmentCancellationRate.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>Cancelled Appointments:</span>
                    <span>{appointmentCancellationRate.cancelled}</span>
                </div>
              </div>
            )}
          </CardContent>
           <CardFooter className="pt-4">
            <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadAppointmentCancellations}>
              Download Report
            </Button>
          </CardFooter>
        </Card>

        {/* Low Stock Medications Card */}
        <Link href="/dashboard/pharmacy" className="block hover:no-underline xl:col-span-1">
          <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Box className="h-6 w-6 text-primary" />
                <CardTitle className="font-headline text-xl">Low Stock Medications</CardTitle>
              </div>
              <CardDescription>Medications with low or out of stock status. Click to manage inventory.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              {(isLoadingData || !medications) ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                lowStockMedications.length > 0 ? (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {lowStockMedications.map(med => (
                      <div key={med.id} className="p-2 border rounded-md">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{med.name} ({med.dosage})</span>
                          <Badge variant={med.status === "Out of Stock" ? "destructive" : "secondary"}>{med.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Stock: {med.stock}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="min-h-[200px] flex flex-col items-center justify-center bg-muted/10 rounded-md text-center">
                      <BriefcaseMedical className="h-16 w-16 text-muted-foreground/40 mb-3"/>
                      <p className="text-muted-foreground">All medications are currently in good stock.</p>
                  </div>
                )
              )}
            </CardContent>
            <CardFooter className="pt-4">
              <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.preventDefault(); handleDownloadLowStockMedications(); }}>
                Download Report
              </Button>
            </CardFooter>
          </Card>
        </Link>

        {/* Total Patient Registrations Card */}
        <Link href="/dashboard/patients" className="block hover:no-underline xl:col-span-1">
          <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserCheck className="h-6 w-6 text-primary" />
                <CardTitle className="font-headline text-xl">Total Patient Registrations</CardTitle>
              </div>
              <CardDescription>Total number of patients in the system. Click to view patient list.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              {isLoadingPatients ? (
                <div className="flex items-center justify-center min-h-[150px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div>
                  <p className="text-4xl font-bold text-primary">{totalPatients}</p>
                  <p className="text-sm text-muted-foreground">Registered Patients</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-4">
              <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.preventDefault(); handleDownloadPatientDemographics(); }}>
                Download Demographics Report
              </Button>
            </CardFooter>
          </Card>
        </Link>

        {/* User Login Activity Card */}
        <Link href="/dashboard/admin/user-management" className="block hover:no-underline xl:col-span-1">
          <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Contact className="h-6 w-6 text-primary" />
                <CardTitle className="font-headline text-xl">User Login Activity</CardTitle>
              </div>
              <CardDescription>Basic list of users and their last login status (Admin view). Click to manage users.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              {isLoadingData ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                userLoginActivity.length > 0 ? (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {userLoginActivity.map(user => (
                      <div key={user.name} className="p-2 border rounded-md">
                        <p className="font-medium text-sm">{user.name} <span className="text-xs text-muted-foreground">({user.role})</span></p>
                        <p className="text-xs text-muted-foreground">Last Login: {user.lastLogin}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No user data to display.</p>
                )
              )}
            </CardContent>
            <CardFooter className="pt-4">
              <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.preventDefault(); handleDownloadUserLoginActivity(); }}>
                Download User Activity
              </Button>
            </CardFooter>
          </Card>
        </Link>

        {/* Lab Order Volume Card */}
        <Link href="/dashboard/lab" className="block hover:no-underline xl:col-span-1">
          <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChartHorizontalBig className="h-6 w-6 text-primary" />
                <CardTitle className="font-headline text-xl">Lab Order Volume</CardTitle>
              </div>
              <CardDescription>Total lab orders and breakdown by status for the selected period. Click to view lab portal.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              {isLoadingData ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-2xl font-bold">Total Orders: {labOrderVolume.total}</p>
                  <div className="space-y-1 text-sm">
                    {Object.entries(labOrderVolume.byStatus).map(([status, count]) => (
                      <div key={status} className="flex justify-between">
                        <span className="text-muted-foreground">{status}:</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-4">
              <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.preventDefault(); handleDownloadLabOrderVolume(); }}>
                Download Lab Orders
              </Button>
            </CardFooter>
          </Card>
        </Link>

        {/* Test Turnaround Time Card */}
        <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col xl:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Hourglass className="h-6 w-6 text-primary" />
              <CardTitle className="font-headline text-xl">Test Turnaround Time (TAT)</CardTitle>
            </div>
            <CardDescription>Average time from sample collection to results verification for completed orders in period.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            {isLoadingData ? (
              <div className="flex items-center justify-center min-h-[150px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              averageTestTurnaroundTime.count > 0 ? (
                <div>
                  <p className="text-3xl font-bold">{averageTestTurnaroundTime.averageHours} <span className="text-xl text-muted-foreground">hours</span></p>
                  <p className="text-xs text-muted-foreground">(Based on {averageTestTurnaroundTime.count} completed orders)</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No completed orders with sufficient data for TAT calculation in selected period.</p>
              )
            )}
          </CardContent>
           <CardFooter className="pt-4">
            <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadTestTurnaroundTime}>
              Download TAT Report
            </Button>
          </CardFooter>
        </Card>

        {/* Medication Dispensing Trends Card */}
        <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col xl:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Syringe className="h-6 w-6 text-primary" />
              <CardTitle className="font-headline text-xl">Medication Dispensing Trends</CardTitle>
            </div>
            <CardDescription>Top 5 dispensed medications by quantity in selected period.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            {isLoadingData ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              medicationDispensingTrends.length > 0 ? (
                <ul className="space-y-2">
                  {medicationDispensingTrends.map(med => (
                    <li key={med.name} className="text-sm flex justify-between">
                      <span>{med.name}</span>
                      <span className="font-semibold">{med.quantity} units</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No dispensing data available for selected period.</p>
              )
            )}
          </CardContent>
           <CardFooter className="pt-4">
            <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadMedicationDispensingTrends}>
              Download Dispensing Report
            </Button>
          </CardFooter>
        </Card>

        {/* Provider Utilization Card */}
        <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col xl:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              <CardTitle className="font-headline text-xl">Provider Utilization</CardTitle>
            </div>
            <CardDescription>Top 5 providers by number of appointments in selected period.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            {isLoadingData ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              providerUtilization.length > 0 ? (
                <ul className="space-y-2">
                  {providerUtilization.map(([provider, count]) => (
                    <li key={provider} className="text-sm flex justify-between">
                      <span>{provider}</span>
                      <span className="font-semibold">{count} appts</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No appointment data for provider utilization in selected period.</p>
              )
            )}
          </CardContent>
           <CardFooter className="pt-4">
            <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadProviderUtilization}>
              Download Utilization Report
            </Button>
          </CardFooter>
        </Card>


        {/* Patient Age Demographics Chart */}
        <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col xl:col-span-1">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <BarChartIcon className="h-6 w-6 text-primary" />
                    <CardTitle className="font-headline text-xl">Patient Age Demographics</CardTitle>
                </div>
                <CardDescription>Distribution of patients by age group.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                 {isLoadingPatients || patientAgeDemographicsData.length === 0 ? (
                    <div className="flex items-center justify-center min-h-[300px]">
                        {isLoadingPatients ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <p className="text-muted-foreground">No patient data available.</p>}
                    </div>
                 ) : (
                    <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                        <BarChart accessibilityLayer data={patientAgeDemographicsData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="ageGroup" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
                            <YAxis tickLine={false} axisLine={false} tickMargin={8}/>
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Bar dataKey="count" name="Patients" radius={8}>
                                {patientAgeDemographicsData.map((entry) => (
                                    <RechartsPrimitive.Cell key={entry.ageGroup} fill={entry.fill} />
                                ))}
                            </Bar>
                             <ChartLegend content={<ChartLegendContent />} />
                        </BarChart>
                    </ChartContainer>
                 )}
            </CardContent>
             <CardFooter className="pt-4">
                <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadAgeDemographicsChartData}>
                    Download Demographics Data
                </Button>
            </CardFooter>
        </Card>

        {/* Weekly Appointment Volume Chart */}
        <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col xl:col-span-1">
            <CardHeader>
                 <div className="flex items-center gap-2">
                    <LineChartIcon className="h-6 w-6 text-primary" />
                    <CardTitle className="font-headline text-xl">Weekly Appointment Volume</CardTitle>
                </div>
                <CardDescription>Number of appointments scheduled per day (within selected range or overall).</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                {isLoadingData || filteredAppointments.length === 0 ? (
                     <div className="flex items-center justify-center min-h-[300px]">
                        {isLoadingData ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <p className="text-muted-foreground">No appointment data available.</p>}
                    </div>
                ) : (
                    <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                        <LineChart accessibilityLayer data={weeklyAppointmentVolumeData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis tickLine={false} axisLine={false} tickMargin={8}/>
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="line" />}
                            />
                            <Line type="monotone" dataKey="appointments" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5, fill: "hsl(var(--primary))" }} activeDot={{r: 7}} name="Appointments"/>
                            <ChartLegend content={<ChartLegendContent />} />
                        </LineChart>
                    </ChartContainer>
                )}
            </CardContent>
             <CardFooter className="pt-4">
                <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadWeeklyAppointmentVolumeChartData}>
                    Download Volume Data
                </Button>
            </CardFooter>
        </Card>

        {/* Remaining placeholder cards */}
        {placeholderReportCards.map((report) => (
          <Card key={report.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col xl:col-span-1">
            <CardHeader>
              <div className="flex items-center gap-2">
                <report.icon className="h-6 w-6 text-primary" />
                <CardTitle className="font-headline text-xl">{report.title}</CardTitle>
              </div>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center justify-center bg-muted/30 min-h-[200px] rounded-b-md">
              <FilePieChart className="h-16 w-16 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Chart/Data Coming Soon</p>
              <p className="text-xs text-muted-foreground">Category: {report.category}</p>
            </CardContent>
            <CardFooter className="pt-4">
                <Button variant="outline" size="sm" className="w-full" onClick={() => alert(`Downloading ${report.title} report (Placeholder)...`)}>
                    Download Report
                </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Separator className="my-8" />

        {/* Staff Activity Report Section */}
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-headline font-semibold tracking-tight flex items-center">
                        <UserCog className="mr-3 h-7 w-7 text-primary" /> Staff Activity Report
                    </h2>
                    <p className="text-muted-foreground">Select a staff member to view their activity summary for the selected period.</p>
                </div>
                <Select onValueChange={setSelectedStaffId} value={selectedStaffId}>
                    <SelectTrigger className="w-full md:w-[300px]">
                        <SelectValue placeholder="Select Staff Member..." />
                    </SelectTrigger>
                    <SelectContent>
                        {allStaffUsers.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                                {user.name} ({user.role})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedStaffId && selectedStaffMember && staffActivityData ? (
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="font-headline text-xl">
                            Activity Summary for: {selectedStaffMember.name} <span className="text-base text-muted-foreground">({selectedStaffMember.role})</span>
                        </CardTitle>
                         <CardDescription>
                            Showing data {dateRange?.from ? `from ${format(dateRange.from, "LLL dd, y")}`: ''} {dateRange?.to ? `to ${format(dateRange.to, "LLL dd, y")}`: 'for all time'}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(selectedStaffMember.role === ROLES.DOCTOR || selectedStaffMember.role === ROLES.NURSE) && (
                            <>
                                <p className="text-sm"><strong className="text-foreground">Appointments Handled:</strong> {staffActivityData.appointments}</p>
                                <p className="text-sm"><strong className="text-foreground">Consultations Performed:</strong> {staffActivityData.consultations}</p>
                            </>
                        )}
                        {selectedStaffMember.role === ROLES.LAB_TECH && (
                            <p className="text-sm"><strong className="text-foreground">Lab Orders Verified:</strong> {staffActivityData.labOrdersVerified}</p>
                        )}
                         {selectedStaffMember.role === ROLES.PHARMACIST && (
                            <p className="text-sm"><strong className="text-foreground">Prescriptions Dispensed (System Wide):</strong> {staffActivityData.prescriptionsDispensed}</p>
                        )}
                        
                        <div>
                            <h4 className="font-semibold text-md mt-4 mb-2">Recent Activity Log Mentions:</h4>
                            {staffActivityData.activityLogEntries.length > 0 ? (
                                <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                    {staffActivityData.activityLogEntries.map(log => (
                                        <li key={log.id} className="text-xs p-2 border rounded-md bg-muted/20 flex items-start space-x-2">
                                            <IconRenderer iconName={log.iconName} className="mt-0.5 text-muted-foreground" />
                                            <div>
                                                <span>{log.actionDescription}</span>
                                                <span className="block text-muted-foreground/80">{format(parseISO(log.timestamp), "MMM d, yyyy HH:mm")}</span>
                                                {log.targetLink && (
                                                  <Link href={log.targetLink} className="text-primary hover:underline text-xs flex items-center">
                                                    <LinkIcon className="h-3 w-3 mr-1"/> View Details
                                                  </Link>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">No recent activity log entries found for this staff member.</p>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadStaffActivityReport} disabled={!selectedStaffMember || !staffActivityData}>
                            Download Staff Activity Summary
                        </Button>
                    </CardFooter>
                </Card>
            ) : selectedStaffId ? (
                 <Card><CardContent className="p-6 text-muted-foreground">Loading staff activity data...</CardContent></Card>
            ) : (
                <Card><CardContent className="p-6 text-muted-foreground">Please select a staff member to view their activity report.</CardContent></Card>
            )}
        </div>

    </div>
  );
}


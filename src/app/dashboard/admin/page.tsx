
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Users, BarChart3, ShieldCheck, UserCog, Trash2, AlertTriangle, DollarSign, Hotel, KeyRound, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react"; // Added useEffect
import { useAuth } from "@/contexts/auth-context"; // Added useAuth
import { useRouter } from "next/navigation"; // Added useRouter
import { ROLES } from "@/lib/constants"; // Added ROLES

const adminSections = [
  { title: "User Management", description: "Add, edit, or remove user accounts and roles.", icon: UserCog, link: "/dashboard/admin/user-management" },
  { title: "System Settings", description: "Configure application-wide settings and preferences.", icon: Settings, link: "/dashboard/admin/system-settings" },
  { title: "Service Pricing", description: "Manage costs for consultations, lab tests, and medications.", icon: DollarSign, link: "/dashboard/admin/service-pricing" },
  { title: "Ward Management", description: "Define and manage hospital wards and units.", icon: Hotel, link: "/dashboard/admin/ward-management" },
  { title: "API Key Management", description: "Configure API keys for payment gateways.", icon: KeyRound, link: "/dashboard/admin/api-key-management" },
  { title: "Audit Logs", description: "Review system activity and changes.", icon: ShieldCheck, link: "/dashboard/admin/audit-logs" },
  { title: "Analytics & Reports", description: "Access detailed system usage and performance reports.", icon: BarChart3, link: "/dashboard/reports" },
];

// List of localStorage keys for UI preferences and auth tokens to be cleared by "Reset Data"
const UI_AND_AUTH_STORAGE_KEYS = [
  // Auth keys
  'navael_auth',
  'navael_patient_auth',
  'navael_original_admin_auth',
  'navael_impersonation_log',
  // Appearance settings keys (from AppearanceSettingsContext)
  'navael_logoDataUrl',
  'navael_logoWidth',
  'navael_themeColors',
  'navael_currency',
  'navael_defaultAppointmentDuration',
  'navael_clinicOperatingHoursStart',
  'navael_clinicOperatingHoursEnd',
  'navael_patientPortalEnabled',
  'navael_reminderLeadTime',
  // Notification preferences keys (from ProfileSettingsPage)
  'navael_notify_appointment_email',
  'navael_notify_lab_results_app',
  'navael_notify_appointment_sms',
  // Note: Keys like USER_MANAGEMENT_STORAGE_KEY, WARDS_BEDS_STORAGE_KEY, STAFF_SCHEDULE_STORAGE_KEY
  // are considered "simulated backend database" for admin-managed data and are NOT cleared by this UI reset.
];


export default function AdminPanelPage() {
  const { toast } = useToast();
  const [isResetting, setIsResetting] = useState(false);
  const { userRole, isLoading: authLoading } = useAuth(); // Get userRole from AuthContext
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && userRole !== ROLES.ADMIN) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to access the Administrator Panel.",
        variant: "destructive",
      });
      router.replace("/dashboard");
    }
  }, [userRole, authLoading, router, toast]);


  const handleResetSystemData = () => {
    setIsResetting(true);
    try {
      UI_AND_AUTH_STORAGE_KEYS.forEach(key => {
        localStorage.removeItem(key);
      });
      
      toast({
        title: "UI & Auth Settings Reset",
        description: "All UI preferences and authentication tokens have been cleared from local storage. Foundational data (Users, Wards, Staff Schedules) managed by simulated services is not affected by this action. The page will now reload.",
      });
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error resetting UI/Auth settings:", error);
      toast({
        title: "Reset Failed",
        description: "Could not clear all UI/Auth settings. Please try again or check console.",
        variant: "destructive",
      });
      setIsResetting(false);
    }
  };
  
  if (authLoading || userRole !== ROLES.ADMIN) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {userRole !== ROLES.ADMIN && <p className="ml-2">Redirecting...</p>}
        {authLoading && <p className="ml-2">Verifying access...</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <Settings className="mr-3 h-8 w-8 text-primary" /> Administrator Panel
          </h1>
          <p className="text-muted-foreground">Manage system settings, users, and view analytics.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {adminSections.map((section) => (
           <Link href={section.link} key={section.title} className="block hover:no-underline">
              <Card className="hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                <CardHeader className="flex flex-row items-center space-x-4 space-y-0">
                  <section.icon className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle className="font-headline text-xl">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
          </Link>
        ))}
      </div>

      <Card className="border-destructive shadow-lg mt-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <CardTitle className="font-headline text-xl text-destructive">System Data Management</CardTitle>
          </div>
          <CardDescription>
            Perform system-wide data operations. Use with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isResetting}>
                  <Trash2 className="mr-2 h-4 w-4" /> Reset UI & Auth Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently delete all stored UI preferences (like theme, logo, currency) and authentication tokens from your browser's local storage.
                    <br /><br />
                    It will NOT clear foundational data like user accounts, wards, or staff schedules, as this data is managed by simulated backend services (which use localStorage as their persistent store for this prototype).
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetSystemData}
                    className={buttonVariants({ variant: "destructive" })}
                    disabled={isResetting}
                  >
                    {isResetting ? "Resetting..." : "Yes, Reset UI & Auth Data"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
             <p className="text-xs text-muted-foreground mt-2">
                This will clear user-specific UI settings and authentication tokens from `localStorage`.
            </p>
        </CardContent>
      </Card>

    </div>
  );
}



"use client";

import { AppSidebarContent } from "@/components/dashboard/app-sidebar-content"; 
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar, SidebarProvider, useSidebar } from "@/components/ui/sidebar"; 
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Loader2, PanelLeft, LogIn, LogOut, UserCircle, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState, useCallback } from "react";
import { type Shift, fetchUserShiftForToday, updateShiftAttendanceService } from "./staff-schedule/schedule.lib"; // Updated imports
import { format, parseISO } from "date-fns"; 
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLog";
import { ROLES } from "@/lib/constants";

function DashboardLayoutContent({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authIsLoading, userRole, username, staffId: loggedInUserStaffId } = useAuth(); 
  const router = useRouter();
  const { isMobile } = useSidebar(); 
  const { toast } = useToast();

  const [userShiftToday, setUserShiftToday] = useState<Shift | null>(null);
  const [isClockingActionLoading, setIsClockingActionLoading] = useState(false);
  const [isLoadingShift, setIsLoadingShift] = useState(false);

  const findAndSetUserShiftForToday = useCallback(async () => { // Renamed for clarity
    if (!loggedInUserStaffId) {
      setUserShiftToday(null);
      return;
    }
    setIsLoadingShift(true);
    try {
      const shift = await fetchUserShiftForToday(loggedInUserStaffId); // Now async
      setUserShiftToday(shift);
    } catch (error) {
        console.error("Error fetching user's shift for today (from layout):", error);
        setUserShiftToday(null);
    } finally {
      setIsLoadingShift(false);
    }
  }, [loggedInUserStaffId]);

  useEffect(() => {
    findAndSetUserShiftForToday();
    // Removed storage listener as schedule.lib no longer directly uses localStorage for this
  }, [findAndSetUserShiftForToday]);


  const handleClockAction = async () => {
    if (!userShiftToday || !loggedInUserStaffId) return;
    setIsClockingActionLoading(true);

    let newAttendanceStatus: Shift["attendanceStatus"] = userShiftToday.attendanceStatus;
    let newActualStartTime = userShiftToday.actualStartTime;
    let newActualEndTime = userShiftToday.actualEndTime;
    let actionDescription = "";

    const now = new Date();
    const currentTimeStr = format(now, "HH:mm");

    if (userShiftToday.attendanceStatus === "Scheduled") {
      newActualStartTime = currentTimeStr;
      actionDescription = `Clocked In for shift: ${userShiftToday.shiftType}`;
      if (userShiftToday.startTime) {
        const scheduledStartDateTime = parseISO(`${userShiftToday.date}T${userShiftToday.startTime}`);
        const gracePeriodMilliseconds = 5 * 60 * 1000; 
        if (now.getTime() > scheduledStartDateTime.getTime() + gracePeriodMilliseconds) {
          newAttendanceStatus = "Late";
          actionDescription = `Clocked In (Late) for shift: ${userShiftToday.shiftType}`;
        } else {
          newAttendanceStatus = "Clocked In";
        }
      } else {
         newAttendanceStatus = "Clocked In";
      }
    } else if (userShiftToday.attendanceStatus === "Clocked In" || userShiftToday.attendanceStatus === "Late") {
      newActualEndTime = currentTimeStr;
      newAttendanceStatus = "Clocked Out";
      actionDescription = `Clocked Out from shift: ${userShiftToday.shiftType}`;
    } else {
      setIsClockingActionLoading(false);
      return; 
    }

    try {
      const updatedShift = await updateShiftAttendanceService(userShiftToday.id, { // Now async
        actualStartTime: newActualStartTime,
        actualEndTime: newActualEndTime,
        attendanceStatus: newAttendanceStatus,
      });
      
      setUserShiftToday(updatedShift); 
      toast({ title: actionDescription.includes("Clocked In") ? "Clocked In" : "Clocked Out", description: `Status: ${newAttendanceStatus}`});
      logActivity({
        actorRole: userRole || ROLES.ADMIN, // Fallback role
        actorName: username || "System User",
        actionDescription,
        targetEntityType: "Staff Shift",
        targetEntityId: userShiftToday.id,
        iconName: newAttendanceStatus === "Clocked In" || newAttendanceStatus === "Late" ? "LogIn" : "LogOut",
      });
    } catch (error: any) {
        console.error("Error updating shift status via API:", error);
        toast({ title: "Error", description: error.message || "Could not update shift status.", variant: "destructive" });
    } finally {
        setIsClockingActionLoading(false);
    }
  };

  useEffect(() => {
    if (!authIsLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, authIsLoading, router]);

  if (authIsLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }
  
  const canClockInOut = userShiftToday && (userShiftToday.attendanceStatus === "Scheduled" || userShiftToday.attendanceStatus === "Clocked In" || userShiftToday.attendanceStatus === "Late");
  const clockButtonText = userShiftToday?.attendanceStatus === "Scheduled" ? "Clock In" : (userShiftToday?.attendanceStatus === "Clocked In" || userShiftToday?.attendanceStatus === "Late" ? "Clock Out" : "No Action");
  const ClockIcon = userShiftToday?.attendanceStatus === "Scheduled" ? LogIn : LogOut;

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r hidden md:flex w-60">
        <AppSidebarContent />
      </Sidebar>
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 w-60">
              <SheetHeader className="p-4 border-b sr-only"><SheetTitle>Navigation Menu</SheetTitle></SheetHeader>
              <AppSidebarContent />
            </SheetContent>
          </Sheet>
          <div className="flex-1"><h1 className="font-headline text-xl text-foreground">{userRole} Dashboard</h1></div>
          {isLoadingShift ? (
            <Button variant="outline" size="sm" disabled className="opacity-70">
                <Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading Shift...
            </Button>
          ) : userShiftToday && userShiftToday.shiftType !== "Day Off" ? (
             <Button onClick={handleClockAction} disabled={!canClockInOut || isClockingActionLoading}
                variant={userShiftToday.attendanceStatus === "Clocked In" || userShiftToday.attendanceStatus === "Late" ? "destructive" : "default"} size="sm">
                {isClockingActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClockIcon className="mr-2 h-4 w-4"/>}
                {clockButtonText}
                {(userShiftToday.attendanceStatus === "Clocked In" || userShiftToday.attendanceStatus === "Late") && userShiftToday.actualStartTime && (
                    <span className="ml-1 text-xs opacity-80">(In: {userShiftToday.actualStartTime})</span>
                )}
            </Button>
          ) : userShiftToday && userShiftToday.shiftType === "Day Off" ? (
             <Button variant="outline" size="sm" disabled className="opacity-70"><UserCircle className="mr-2 h-4 w-4"/> Day Off</Button>
          ) : (
             <Button variant="outline" size="sm" disabled className="opacity-70"><AlertTriangle className="mr-2 h-4 w-4"/> No Shift Today</Button>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-background">
          <div className={cn("animate-fade-in")}>{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen> 
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

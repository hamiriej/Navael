
"use client";

import {
  SidebarContent as UiSidebarContent, // Renamed to avoid conflict
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import type { Role } from "@/lib/constants";
import { ROLES } from "@/lib/constants";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FlaskConical,
  Settings,
  LogOut,
  type LucideIcon,
  MessageSquareText,
  CreditCard,
  FilePieChart,
  UserCog,
  ListChecks,
  ClipboardList,
  BedDouble,
  Pill,
  AlertTriangle, 
  Hotel // Added Hotel icon for Inpatient section
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar"; // Import useSidebar

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  roles: Role[];
  tooltipText?: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: Object.values(ROLES), tooltipText: "Dashboard" },
  { href: "/dashboard/patients", icon: Users, label: "Patients", roles: Object.values(ROLES), tooltipText: "Manage Patients" },
  { href: "/dashboard/appointments", icon: CalendarDays, label: "Appointments", roles: Object.values(ROLES), tooltipText: "Manage Appointments" },
  { href: "/dashboard/consultations", icon: MessageSquareText, label: "Consultations", roles: [ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMIN], tooltipText: "View Consultations" },
  {
    href: "/dashboard/lab/order",
    icon: ClipboardList,
    label: "Order Lab Test",
    roles: [ROLES.DOCTOR, ROLES.NURSE],
    tooltipText: "Order New Lab Test"
  },
   {
    href: "/dashboard/lab",
    icon: FlaskConical,
    label: "Lab Portal / Results",
    roles: Object.values(ROLES),
    tooltipText: "Lab Portal / View Results"
  },
  {
    href: "/dashboard/pharmacy/prescribe", // For clinicians to prescribe
    icon: ClipboardList, 
    label: "Prescribe Medication",
    roles: [ROLES.DOCTOR, ROLES.NURSE],
    tooltipText: "Prescribe Medication"
  },
  {
    href: "/dashboard/pharmacy", // Main pharmacy portal
    icon: Pill,
    label: "Pharmacy",
    roles: [ROLES.PHARMACIST, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST], 
    tooltipText: "Pharmacy Management / View",
  },
  { href: "/dashboard/admissions", icon: BedDouble, label: "Admissions", roles: [ROLES.NURSE, ROLES.RECEPTIONIST, ROLES.ADMIN], tooltipText: "Patient Admissions" },
  { href: "/dashboard/inpatient/bed-management", icon: Hotel, label: "Bed Management", roles: [ROLES.NURSE, ROLES.ADMIN, ROLES.RECEPTIONIST], tooltipText: "Inpatient Bed Dashboard" },
  { href: "/dashboard/billing", icon: CreditCard, label: "Billing", roles: [ROLES.RECEPTIONIST, ROLES.ADMIN], tooltipText: "Billing & Insurance" },
  { href: "/dashboard/staff-schedule", icon: ListChecks, label: "Staff Schedule", roles: Object.values(ROLES), tooltipText: "View & Manage Staff Schedules" },
  { href: "/dashboard/reports", icon: FilePieChart, label: "Reports", roles: [ROLES.ADMIN], tooltipText: "System Reports" },
  { href: "/dashboard/admin", icon: Settings, label: "Admin Panel", roles: [ROLES.ADMIN], tooltipText: "Administrator Panel Home" },
];


export function AppSidebarContent() {
  const pathname = usePathname();
  const { userRole, logout, username } = useAuth();
  const { state: sidebarState, isMobile } = useSidebar(); 

  if (!userRole) {
    return null;
  }

  const filteredNavItems = navItems.filter(item => userRole && item.roles.includes(userRole)).sort((a,b) => {
    // Optional: Custom sort order if needed, e.g. keeping Admin Panel last
    if (a.label === "Admin Panel") return 1;
    if (b.label === "Admin Panel") return -1;
    return a.label.localeCompare(b.label);
  });

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    const parts = name.split(' ');
    if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
      return parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
    }
    if (name.length > 0) {
      return name.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const isIconOnlyMode = !isMobile && sidebarState === "collapsed";

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground overflow-hidden">
      <SidebarHeader className="p-4 flex items-center justify-center">
         {isIconOnlyMode ? <Logo iconOnly={true} /> : <Logo />}
      </SidebarHeader>
      <SidebarSeparator />
      <UiSidebarContent className="p-2 flex-grow"> 
        <SidebarMenu>
          {filteredNavItems.map((item) => {
            const targetHref = item.href;
            const tooltipLabel = item.tooltipText || item.label;

            let isActive = false;
            if (targetHref === "/dashboard") {
                isActive = pathname === targetHref;
            } else {
                 isActive = pathname === targetHref || (targetHref !== '/dashboard' && pathname.startsWith(targetHref + '/'));
            }

            return (
              <SidebarMenuItem key={item.href}>
                 {isIconOnlyMode ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <SidebarMenuButton href={targetHref} isActive={isActive}>
                                <item.icon className="h-5 w-5 shrink-0" />
                                <span className="sr-only">{item.label}</span>
                            </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center">
                            {tooltipLabel}
                        </TooltipContent>
                    </Tooltip>
                 ) : (
                    <SidebarMenuButton href={targetHref} isActive={isActive}>
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                    </SidebarMenuButton>
                 )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </UiSidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-2 mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10">
              <Avatar className="h-8 w-8">
                <AvatarImage
                    src={"https://placehold.co/100x100.png"}
                    alt={username || 'User'}
                    data-ai-hint="profile avatar"
                />
                <AvatarFallback>{getInitials(username)}</AvatarFallback>
              </Avatar>
              <div className={`ml-2 text-left ${isIconOnlyMode ? 'sr-only' : ''}`}>
                <p className="text-sm font-medium truncate">{username}</p>
                <p className="text-xs text-muted-foreground">{userRole}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-56">
            <DropdownMenuLabel>{username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile-settings">
                <UserCog className="mr-2 h-4 w-4" />
                <span>Profile Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </div>
  );
}

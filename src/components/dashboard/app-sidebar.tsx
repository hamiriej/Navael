
"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
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
  UserPlus,
  CalendarDays,
  FlaskConical,
  Settings,
  LogOut,
  type LucideIcon,
  NotebookPen,
  Lightbulb,
  Pill,
  BedDouble,
  MessageSquareText,
  CreditCard,
  FilePieChart,
  UserCog,
  ListChecks,
  PackagePlus,
  FileSignature,
  ClipboardList,
  Users2 as UserManagementIcon,
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

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  roles: Role[];
  tooltipText?: string;
  subItems?: NavItem[];
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
    roles: [ROLES.DOCTOR, ROLES.NURSE], // Kept for clinicians
    tooltipText: "Order New Lab Test"
  },
   { // Lab Technicians see main lab portal via Dashboard, others see simplified viewer
    href: "/dashboard/lab",
    icon: FlaskConical,
    label: "Lab Portal / Results",
    roles: Object.values(ROLES), // All roles can access some form of lab page
    tooltipText: "Lab Portal / View Results"
  },
  {
    href: "/dashboard/pharmacy",
    icon: Pill,
    label: "Pharmacy",
    roles: [ROLES.NURSE, ROLES.DOCTOR, ROLES.ADMIN, ROLES.RECEPTIONIST], // Receptionist might view, not prescribe
    tooltipText: "Pharmacy Management",
  },
  { href: "/dashboard/admissions", icon: BedDouble, label: "Admissions", roles: [ROLES.NURSE, ROLES.RECEPTIONIST, ROLES.ADMIN], tooltipText: "Patient Admissions" },
  { href: "/dashboard/billing", icon: CreditCard, label: "Billing", roles: [ROLES.RECEPTIONIST, ROLES.ADMIN], tooltipText: "Billing & Insurance" },
  { href: "/dashboard/staff-schedule", icon: ListChecks, label: "Staff Schedule", roles: Object.values(ROLES), tooltipText: "View & Manage Staff Schedules" },
  { href: "/dashboard/reports", icon: FilePieChart, label: "Reports", roles: [ROLES.ADMIN], tooltipText: "System Reports" },
  { href: "/dashboard/admin", icon: Settings, label: "Admin Panel", roles: [ROLES.ADMIN], tooltipText: "Administrator Panel Home" },
];


export function AppSidebar() {
  const pathname = usePathname();
  const { userRole, logout, username } = useAuth();
  const { state: sidebarState, isMobile } = useSidebar();

  if (!userRole) {
    return null;
  }

  const filteredNavItems = navItems.filter(item => userRole && item.roles.includes(userRole));

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


  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
      <SidebarHeader className="p-4 flex items-center justify-center group-data-[collapsible=icon]:justify-center">
        <Logo className="group-data-[collapsible=icon]:hidden" />
         <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center hidden">
            <Logo iconOnly={true} />
         </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="p-2">
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


            const buttonContent = (
                <span className="flex items-center gap-2 w-full">
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
                </span>
              );

            return (
              <SidebarMenuItem key={item.href}>
                <Tooltip>
                  <TooltipTrigger asChild>
                     <SidebarMenuButton
                        href={targetHref}
                        isActive={isActive}
                      >
                        {buttonContent}
                      </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    align="center"
                    hidden={sidebarState !== "collapsed" || isMobile}
                  >
                    {tooltipLabel}
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
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
              <div className="ml-2 text-left group-data-[collapsible=icon]:hidden">
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
    </Sidebar>
  );
}


"use client";

import type { ReactNode } from "react";
import { PatientAuthProvider, usePatientAuth } from "@/contexts/patient-auth-context";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, UserCircle } from "lucide-react";
import Link from "next/link";
import { Toaster } from "@/components/ui/toaster"; // Added Toaster for patient portal
import { cn } from "@/lib/utils";

function PatientPortalLayoutContent({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout, patientName, isLoading } = usePatientAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      {isAuthenticated && (
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
          <Link href="/patient-portal/dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
                <UserCircle className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{patientName || "Patient"}</span>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>
      )}
      <main className={cn("flex-1 bg-muted/20", isAuthenticated ? "p-4 md:p-6 lg:p-8" : "")}>
        {children}
      </main>
      <Toaster />
    </div>
  );
}

export default function PatientPortalLayout({ children }: { children: ReactNode }) {
  return (
    <PatientAuthProvider>
      <PatientPortalLayoutContent>{children}</PatientPortalLayoutContent>
    </PatientAuthProvider>
  );
}

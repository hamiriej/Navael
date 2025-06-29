// src/app/layout.tsx

// Removed: import AuthManager from '@/components/AuthManager'; // <-- Removed this import

import type { Metadata } from 'next';
import { Inter, Literata } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/contexts/auth-context';
import { AppearanceSettingsProvider } from '@/contexts/appearance-settings-context';
import { ThemeApplicator } from '@/components/shared/theme-applicator';
import { PatientProvider } from '@/contexts/patient-context';
import { AppointmentProvider } from '@/contexts/appointment-context';
import { LabOrderProvider } from '@/contexts/lab-order-context';
import { PharmacyProvider } from '@/contexts/pharmacy-context';
import { ConsultationProvider } from '@/contexts/consultation-context';
import { InvoiceProvider } from '@/contexts/invoice-context';

const fontInter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const fontLiterata = Literata({
  subsets: ['latin', 'vietnamese'], // Added 'vietnamese' based on common Literata usage, adjust if needed
  variable: '--font-literata',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'Navael - Healthcare Management',
  description: 'Streamlining healthcare operations with Navael.',
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Your existing head content would go here */}
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-body antialiased",
          fontInter.variable,
          fontLiterata.variable
        )}
      >
        <AuthProvider>
          {/* Removed: <AuthManager /> */} {/* <--- AUTHMANAGER REMOVED FROM HERE */}

          {/* All your existing Context Providers */}
          <PatientProvider>
            <AppointmentProvider>
              <LabOrderProvider>
                <PharmacyProvider>
                  <ConsultationProvider>
                    <AppearanceSettingsProvider>
                      <InvoiceProvider>
                        {/* ThemeApplicator wraps the main children content */}
                        <ThemeApplicator>{children}</ThemeApplicator>
                      </InvoiceProvider>
                    </AppearanceSettingsProvider>
                  </ConsultationProvider>
                </PharmacyProvider>
              </LabOrderProvider>
            </AppointmentProvider>
          </PatientProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}

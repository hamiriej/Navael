// src/contexts/invoice-context.tsx

"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { logActivity } from '@/lib/activityLog';
import { useAuth } from './auth-context';
import { formatCurrency } from '@/lib/utils';
import { useAppearanceSettings } from './appearance-settings-context';

// NEW: Import useAppointments context
import { useAppointments } from './appointment-context';

// Firestore imports
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Ensure this path is correct for your Firebase db instance


const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

export type InvoiceStatus =
  "Draft" | "Pending Payment" | "Partially Paid" | "Paid" |
  "Overdue" | "Cancelled" | "Awaiting Push Payment" | "Billed";


export interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sourceType?: 'consultation' | 'lab' | 'prescription' | 'manual' | 'general_service' | 'hospital_stay' | 'procedure' | 'other';
  sourceId?: string;
}


export interface Invoice {
  id: string;
  patientId: string;
  patientName: string;
  date: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  lineItems: InvoiceLineItem[];
  subTotal: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount: number;
  amountPaid: number;
  status: InvoiceStatus;
  notes?: string;
  source?: string;
  appointmentId?: string;
}

interface InvoiceContextType {
  invoices: Invoice[];
  isLoadingInvoices: boolean;
  fetchInvoices: () => Promise<void>;
  fetchInvoiceById: (invoiceId: string) => Promise<Invoice | undefined>;
  createInvoice: (newInvoiceData: Omit<Invoice, 'id'>) => Promise<Invoice>;
  updateInvoice: (invoiceId: string, updatedData: Partial<Omit<Invoice, 'id'>>) => Promise<Invoice | undefined>;
  fetchInvoicesForPatient: (patientId: string) => Promise<Invoice[]>;
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined);

async function callApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      // If response is not JSON, use default error message
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export function InvoiceProvider({ children }: { children: ReactNode }) {
  const [invoicesState, setInvoicesState] = useState<Invoice[]>([]);
  const [isLoadingInvoicesState, setIsLoadingInvoicesState] = useState(true);
  const { userRole, username } = useAuth();
  const { currency } = useAppearanceSettings();

  // NEW: Get appointments and updateAppointment from useAppointments
  // This is a cross-context dependency, which is acceptable for centralized logic.
  const { appointments, updateAppointment } = useAppointments();


  const fetchInvoices = useCallback(async () => {
    setIsLoadingInvoicesState(true);
    try {
      const dataFromApi = await callApi<Invoice[]>(`${API_BASE_URL}/invoices`);
      const sorted = dataFromApi.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setInvoicesState(sorted);
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
      setInvoicesState([]);
    } finally {
      setIsLoadingInvoicesState(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const fetchInvoiceById = useCallback(async (invoiceId: string) => {
    try {
      const invoice = await callApi<Invoice>(`${API_BASE_URL}/invoices/${invoiceId}`);
      return invoice;
    } catch (error: any) {
      console.error(`Failed to fetch invoice ${invoiceId}:`, error);
      return undefined;
    }
  }, []);

  const fetchInvoicesForPatient = useCallback(async (patientId: string): Promise<Invoice[]> => {
    try {
      const patientInvoices = await callApi<Invoice[]>(`${API_BASE_URL}/invoices?patientId=${patientId}`);
      const sorted = patientInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return sorted;
    } catch (error: any) {
      console.error(`Failed to fetch invoices for patient ${patientId}:`, error);
      return [];
    }
  }, []);

  const createInvoice = useCallback(async (newInvoiceData: Omit<Invoice, 'id'>): Promise<Invoice> => {
    setIsLoadingInvoicesState(true);
    try {
      const createdApi = await callApi<Invoice>(`${API_BASE_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInvoiceData),
      });

      setInvoicesState(prev => [...prev, createdApi].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

      logActivity({
        actorRole: userRole || "System", actorName: username || "System",
        actionDescription: `Created Invoice ${createdApi.id} for ${createdApi.patientName}, Amount: ${formatCurrency(createdApi.totalAmount, currency)}`,
        targetEntityType: "Invoice", targetEntityId: createdApi.id, iconName: "FileText",
      });
      return createdApi;
    } catch (error) {
      console.error("Failed to create invoice:", error);
      fetchInvoices();
      throw error;
    } finally {
      setIsLoadingInvoicesState(false);
    }
  }, [userRole, username, currency, fetchInvoices]);

  const updateInvoice = useCallback(async (invoiceId: string, updatedData: Partial<Omit<Invoice, 'id'>>) => {
    setIsLoadingInvoicesState(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      
      if (!response.ok) throw new Error("Failed to update invoice.");
      const updatedApi = await response.json() as Invoice;

      setInvoicesState(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, ...updatedApi } : inv)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

      // --- NEW LOGIC TO UPDATE RELATED LABORDER (FRONTEND WORKAROUND) ---
      if (updatedApi.status === "Paid") {
        try {
          const labOrdersRef = collection(db, "labOrders");
          const q = query(labOrdersRef, where("invoiceId", "==", updatedApi.id));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            querySnapshot.forEach(async (labOrderDoc) => {
              const labOrderRef = doc(db, "labOrders", labOrderDoc.id);
              await updateDoc(labOrderRef, {
                paymentStatus: "Paid"
              });
              console.log(`Successfully updated LabOrder ${labOrderDoc.id} paymentStatus to Paid for Invoice ${updatedApi.id}.`);
            });
          } else {
            console.log(`No LabOrder found linked to Invoice ${updatedApi.id}.`);
          }
        } catch (labOrderUpdateError: any) {
          console.error(`Error updating related LabOrder paymentStatus for Invoice ${updatedApi.id}:`, labOrderUpdateError);
        }
      }
      // --- END NEW LOGIC ---

      // --- NEW LOGIC TO UPDATE RELATED APPOINTMENT (FRONTEND WORKAROUND) ---
      // Only update if the invoice's payment status indicates a change relevant to appointments
      if (updatedApi.status === "Paid" || updatedApi.status === "Partially Paid") {
        const relatedInvoiceId = updatedApi.id;
        console.log(`InvoiceContext: Searching for appointment linked to invoiceId: ${relatedInvoiceId}`);
        console.log("InvoiceContext: All appointments in context (ID and invoiceId):", appointments.map(appt => ({ id: appt.id, invoiceId: appt.invoiceId })));

        const relatedAppointment = appointments.find(appt => appt.invoiceId === relatedInvoiceId);

        if (relatedAppointment) {
          console.log(`InvoiceContext: Match found! Related appointment ID: '${relatedAppointment.id}', Current paymentStatus: '${relatedAppointment.paymentStatus}'`);
          // Use the updateAppointment function from useAppointments context
          await updateAppointment(relatedAppointment.id, { paymentStatus: updatedApi.status });
          console.log(`InvoiceContext: Successfully updated appointment '${relatedAppointment.id}' paymentStatus to: '${updatedApi.status}'`);
        } else {
          console.warn(`InvoiceContext: No appointment found linked to Invoice ${relatedInvoiceId}.`);
        }
      }
      // --- END NEW LOGIC ---


      let logMessage = `Updated Invoice ${invoiceId} for ${updatedApi.patientName}. New Status: ${updatedApi.status}.`;
      if (updatedData.amountPaid !== undefined) {
         logMessage += ` Payment updated to ${formatCurrency(updatedData.amountPaid, currency)}.`;
      }
      
      logActivity({
        actorRole: userRole || "System", actorName: username || "System",
        actionDescription: logMessage, targetEntityType: "Invoice", targetEntityId: invoiceId, iconName: "Edit",
      });
      return updatedApi;
    } catch (error) {
      console.error("Failed to update invoice:", error);
      fetchInvoices();
      throw error;
    } finally {
      setIsLoadingInvoicesState(false);
    }
  }, [userRole, username, currency, fetchInvoices, appointments, updateAppointment]); // Add appointments and updateAppointment to dependencies

  return (
    <InvoiceContext.Provider value={{
      invoices: invoicesState, isLoadingInvoices: isLoadingInvoicesState,
      fetchInvoices, fetchInvoiceById, createInvoice, updateInvoice, fetchInvoicesForPatient,
    }}>
      {children}
    </InvoiceContext.Provider>
  );
}

export function useInvoices() {
  const context = useContext(InvoiceContext);
  if (context === undefined) {
    throw new Error('useInvoices must be used within an InvoiceProvider');
  }
  return context;
}

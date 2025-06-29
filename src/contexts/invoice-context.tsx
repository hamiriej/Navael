"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import type { Invoice } from '@/app/dashboard/billing/page'; // Assuming your Invoice type is defined here
import { logActivity } from '@/lib/activityLog';
import { useAuth } from './auth-context';
import { formatCurrency } from '@/lib/utils';
import { useAppearanceSettings } from './appearance-settings-context';
// No longer need 'format' from date-fns for default dates if Firestore handles timestamps
// import { format } from 'date-fns';

// Import Firestore SDK functions
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot, // For real-time updates!
  QueryDocumentSnapshot,
  SnapshotOptions,
  DocumentData,
  // Firestore, // Type for db instance - not directly used in component
  // Timestamp, // If you decide to use Firestore Timestamps - not directly used in component for now
} from 'firebase/firestore';

// Import your initialized Firestore instance
import { db } from '@/firebase/config'; // Assuming you have an initialized 'db' instance exported from a config file


// --- Firestore Collection Reference ---
const INVOICES_COLLECTION = 'invoices'; // Name of your Firestore collection for invoices

// --- Data Converter (Optional but Recommended for complex types) ---
// This helps automatically convert between your TypeScript Invoice object and Firestore's format.
// For dates, if you switch to Timestamp, this is where you'd convert.
// For now, it assumes string dates and maps directly.
// src/contexts/invoice-context.tsx

const invoiceConverter = {
  toFirestore(invoice: Invoice): DocumentData {
    return {
      patientId: invoice.patientId,
      patientName: invoice.patientName,
      date: invoice.date,
      dueDate: invoice.dueDate,
      lineItems: invoice.lineItems,
      subTotal: invoice.subTotal,
      // FIX: Use nullish coalescing (??) to default undefined or null to 0 for taxRate
      taxRate: invoice.taxRate ?? 0, 
      // FIX: Use nullish coalescing (??) to default undefined or null to 0 for taxAmount
      taxAmount: invoice.taxAmount ?? 0, 
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      status: invoice.status,
      notes: invoice.notes || '', // This is already good for converting undefined/null strings to empty string
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Invoice {
    const data = snapshot.data(options)!;
    return {
      id: snapshot.id,
      patientId: data.patientId,
      patientName: data.patientName,
      date: data.date,
      dueDate: data.dueDate,
      lineItems: data.lineItems,
      subTotal: data.subTotal,
      taxRate: data.taxRate, // Reads back from Firestore, 0 or actual value
      taxAmount: data.taxAmount, // Reads back from Firestore, 0 or actual value
      totalAmount: data.totalAmount,
      amountPaid: data.amountPaid,
      status: data.status,
      notes: data.notes || '',
    } as Invoice;
  }
};



interface InvoiceContextType {
  invoices: Invoice[];
  isLoadingInvoices: boolean;
  fetchInvoices: () => Promise<void>; // This will now set up a real-time listener (internally)
  fetchInvoiceById: (invoiceId: string) => Promise<Invoice | undefined>;
  createInvoice: (newInvoiceData: Omit<Invoice, 'id'>) => Promise<Invoice>;
  updateInvoice: (invoiceId: string, updatedData: Partial<Omit<Invoice, 'id'>>) => Promise<Invoice | undefined>;
  fetchInvoicesForPatient: (patientId: string) => Promise<Invoice[]>;
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined);


export function InvoiceProvider({ children }: { children: ReactNode }) {
  const [invoicesState, setInvoicesState] = useState<Invoice[]>([]);
  const [isLoadingInvoicesState, setIsLoadingInvoicesState] = useState(true);
  const { userRole, username } = useAuth();
  const { currency } = useAppearanceSettings();

  // ----------------------------------------------------
  // Refactored: Fetch Invoices (Real-time with onSnapshot)
  // ----------------------------------------------------
  // This useCallback returns the unsubscribe function.
  // The actual listener is started in useEffect.
  const setupRealtimeInvoiceListener = useCallback(() => {
    setIsLoadingInvoicesState(true); // Indicate loading when setting up or re-setting up listener
    const invoicesCollectionRef = collection(db, INVOICES_COLLECTION).withConverter(invoiceConverter);
    const q = query(invoicesCollectionRef, orderBy('date', 'desc')); // Order by date (newest first)

    // onSnapshot returns an unsubscribe function, which is crucial for cleanup
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedInvoices: Invoice[] = [];
      snapshot.forEach((doc) => {
        fetchedInvoices.push(doc.data()); // .data() already returns Invoice due to converter
      });
      setInvoicesState(fetchedInvoices);
      setIsLoadingInvoicesState(false); // Only set false after initial data received
    }, (error) => {
      console.error("Firebase Error: Failed to fetch invoices in real-time:", error);
      setInvoicesState([]); // Clear invoices on error
      setIsLoadingInvoicesState(false); // Ensure loading state is reset
    });

    // Return the unsubscribe function for useEffect cleanup
    return unsubscribe;
  }, []); // No dependencies for initial setup of listener


  // The `fetchInvoices` function simply triggers the listener setup (for external calls)
  const fetchInvoices = useCallback(async () => {
    // For external calls, we might not need to do anything as the listener is always active.
    // However, if you want to allow a manual "refresh" that forces a re-read,
    // you could re-initialize the listener by unsubscribing and re-subscribing.
    // For now, it simply relies on the useEffect.
    console.log("InvoiceContext: fetchInvoices called (real-time listener is active)");
  }, []);

  useEffect(() => {
    // Start listening when component mounts
    const unsubscribe = setupRealtimeInvoiceListener();
    return () => {
      unsubscribe(); // Unsubscribe when component unmounts to prevent memory leaks
    };
  }, [setupRealtimeInvoiceListener]); // Run once when setupRealtimeInvoiceListener is stable


  // ----------------------------------------------------
  // Refactored: Fetch Invoice by ID (One-time fetch)
  // ----------------------------------------------------
  const fetchInvoiceById = useCallback(async (invoiceId: string) => {
    try {
      const invoiceDocRef = doc(db, INVOICES_COLLECTION, invoiceId).withConverter(invoiceConverter);
      const invoiceSnapshot = await getDoc(invoiceDocRef);
      if (invoiceSnapshot.exists()) {
        return invoiceSnapshot.data(); // .data() already returns Invoice due to converter
      } else {
        console.warn(`Firebase: Invoice with ID ${invoiceId} not found.`);
        return undefined;
      }
    } catch (error: any) {
      console.error(`Firebase Error: Failed to fetch invoice ${invoiceId}:`, error);
      return undefined;
    }
  }, []);

  // ----------------------------------------------------
  // Refactored: Fetch Invoices for Patient (One-time fetch with query)
  // ----------------------------------------------------
  const fetchInvoicesForPatient = useCallback(async (patientId: string): Promise<Invoice[]> => {
    try {
      const invoicesCollectionRef = collection(db, INVOICES_COLLECTION).withConverter(invoiceConverter);
      const q = query(
        invoicesCollectionRef,
        where('patientId', '==', patientId),
        orderBy('date', 'desc') // Order by date for consistency
      );
      const querySnapshot = await getDocs(q);
      const patientInvoices: Invoice[] = [];
      querySnapshot.forEach((doc) => {
        patientInvoices.push(doc.data());
      });
      return patientInvoices;
    } catch (error: any) {
      console.error(`Firebase Error: Failed to fetch invoices for patient ${patientId}:`, error);
      return [];
    }
  }, []);

  // ----------------------------------------------------
  // Refactored: Create Invoice
  // ----------------------------------------------------
  const createInvoice = useCallback(async (newInvoiceData: Omit<Invoice, 'id'>): Promise<Invoice> => {
    setIsLoadingInvoicesState(true);
    try {
      const invoicesCollectionRef = collection(db, INVOICES_COLLECTION).withConverter(invoiceConverter);
      // addDoc auto-generates the ID for the new document
      const docRef = await addDoc(invoicesCollectionRef, newInvoiceData as Invoice); // Cast to Invoice for converter
      const createdInvoice = { ...newInvoiceData, id: docRef.id }; // Add the generated ID to your object
      
      // Note: setInvoicesState is no longer explicitly called here for adding.
      // The onSnapshot listener (setupRealtimeInvoiceListener in useEffect) will automatically
      // pick up the new document from Firestore and update the state in real-time.
      // This ensures your local state is always consistent with the database.

      logActivity({
        actorRole: userRole || "System", actorName: username || "System",
        actionDescription: `Created Invoice ${createdInvoice.id} for ${createdInvoice.patientName}, Amount: ${formatCurrency(createdInvoice.totalAmount, currency)}`,
        targetEntityType: "Invoice", targetEntityId: createdInvoice.id, iconName: "FileText",
      });
      return createdInvoice;
    } catch (error: any) {
      console.error("Firebase Error: Failed to create invoice:", error);
      // No need to call fetchInvoices here because onSnapshot handles real-time sync.
      throw error; // Re-throw for component to handle
    } finally {
      setIsLoadingInvoicesState(false);
    }
  }, [userRole, username, currency]); // Dependencies: userRole, username, currency


  // ----------------------------------------------------
  // Refactored: Update Invoice
  // ----------------------------------------------------
  const updateInvoice = useCallback(async (invoiceId: string, updatedData: Partial<Omit<Invoice, 'id'>>) => {
    setIsLoadingInvoicesState(true);
    try {
      const invoiceDocRef = doc(db, INVOICES_COLLECTION, invoiceId).withConverter(invoiceConverter);
      // updateDoc handles partial updates directly; Firestore will merge changes.
      await updateDoc(invoiceDocRef, updatedData); 

      // Note: setInvoicesState is no longer explicitly called here for mapping.
      // The onSnapshot listener will automatically pick up the updated document from Firestore
      // and update the local state in real-time.

      // To get the fully updated object to return for component logic (e.g., optimistic updates):
      // The most reliable way is to fetch it directly from Firestore after the update.
      const updatedInvoice = await fetchInvoiceById(invoiceId); // Re-use existing fetchById

      // Constructing log message:
      let logMessage = `Updated Invoice ${invoiceId}`;
      if (updatedInvoice) { // If we successfully fetched the updated invoice
        logMessage += ` for ${updatedInvoice.patientName}. New Status: ${updatedInvoice.status}.`;

        // Check if amountPaid was part of updatedData to log payment
        if (updatedData.amountPaid !== undefined) {
          // To accurately calculate paymentMade, you would ideally compare with the invoice's state *before* this update.
          // Since the real-time listener updates `invoicesState` immediately, getting the 'original' from `invoicesState`
          // here might fetch the *already updated* version.
          // A robust solution for delta logging might involve:
          // 1. Passing the original `amountPaid` from the calling component.
          // 2. Doing a `getDoc` for the original before `updateDoc`.
          // For simplicity here, we'll just log the current total amount paid if it changed.
          const originalAmountPaid = invoicesState.find(inv => inv.id === invoiceId)?.amountPaid || 0;
          if (updatedData.amountPaid > originalAmountPaid) {
             const paymentMade = updatedData.amountPaid - originalAmountPaid;
             logMessage += ` Payment of ${formatCurrency(paymentMade, currency)} recorded.`;
          } else if (updatedData.amountPaid < originalAmountPaid) {
             const refundMade = originalAmountPaid - updatedData.amountPaid;
             logMessage += ` Refund of ${formatCurrency(refundMade, currency)} recorded.`;
          }
        }
      } else {
        logMessage += `. Details: Status changed or amount paid.`; // Fallback if updatedInvoice couldn't be fetched
      }
     
      logActivity({
        actorRole: userRole || "System", actorName: username || "System",
        actionDescription: logMessage, targetEntityType: "Invoice", targetEntityId: invoiceId, iconName: "Edit",
      });
      return updatedInvoice; // Return the fetched, complete updated object
    } catch (error: any) {
      console.error("Firebase Error: Failed to update invoice:", error);
      throw error; // Re-throw for component to handle
    } finally {
      setIsLoadingInvoicesState(false);
    }
  }, [userRole, username, currency, fetchInvoiceById, invoicesState]); // fetchInvoiceById is a dep, invoicesState for logging delta


  return (
    <InvoiceContext.Provider value={{
      invoices: invoicesState,
      isLoadingInvoices: isLoadingInvoicesState,
      fetchInvoices, // Exposed for consumers to trigger a fetch (though mostly handled by listener)
      fetchInvoiceById,
      createInvoice,
      updateInvoice,
      fetchInvoicesForPatient,
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

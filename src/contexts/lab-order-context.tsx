// src/contexts/lab-order-context.ts

"use client";
import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from 'react';
import { logActivity } from '@/lib/activityLog';
import { useAuth } from './auth-context';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  // Removed addDoc as we'll use the API for creation
  updateDoc,
  query,
  where,
  // Timestamp is not used directly here, but keep if other parts of the app need it
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LabOrder } from '@/app/dashboard/lab/types';
export type { LabOrder } from '@/app/dashboard/lab/types';

interface LabOrderContextType {
  labOrders: LabOrder[];
  isLoadingLabOrders: boolean;
  error: string | null;
  fetchLabOrders: () => Promise<void>;
  fetchLabOrderById: (id: string) => Promise<LabOrder | undefined>;
  fetchLabOrdersForPatient: (patientId: string) => Promise<LabOrder[]>;
  createLabOrder: (data: Omit<LabOrder, 'id' | 'createdAt' | 'updatedAt' | 'orderDate'>) => Promise<LabOrder>; // Adjusted expected input type
  updateLabOrder: (id: string, data: Partial<Omit<LabOrder, 'id'>>) => Promise<LabOrder | undefined>;
}

const LabOrderContext = createContext<LabOrderContextType | undefined>(undefined);

export function LabOrderProvider({ children }: { children: ReactNode }) {
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userRole, username } = useAuth();

  const fetchLabOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // We will now use your server-side API to fetch orders as well
      // This ensures consistency of data format (like timestamps)
      const response = await fetch('/api/v1/lab/orders');
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      const data: LabOrder[] = await response.json();
      setLabOrders(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch lab orders.");
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies for initial fetch

  useEffect(() => {
    fetchLabOrders();
  }, [fetchLabOrders]); // Rerun if fetchLabOrders function reference changes (unlikely for useCallback)

  const fetchLabOrderById = useCallback(async (id: string): Promise<LabOrder | undefined> => {
    setError(null);
    try {
      // This can still directly query Firestore as the ID is known
      const docRef = doc(db, "labOrders", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<LabOrder, 'id'> & { orderDate?: any; createdAt?: any; updatedAt?: any; };

        // Convert Firestore Timestamps to ISO strings for consistency with API response
        const orderDate = data.orderDate instanceof Timestamp ? data.orderDate.toDate().toISOString() : data.orderDate;
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt;
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt;

        return {
          id: docSnap.id,
          ...data,
          orderDate,
          createdAt,
          updatedAt,
        } as LabOrder;
      }
      return undefined;
    } catch (err: any) {
      setError(err.message || "Failed to fetch lab order.");
      return undefined;
    }
  }, []);

  const fetchLabOrdersForPatient = useCallback(async (patientId: string): Promise<LabOrder[]> => {
    setError(null);
    try {
      // You can either query the client-side Firestore directly as before,
      // or you could make an API call to /api/v1/lab/orders?patientId=...
      // For now, keeping client-side query as it works well for reads.
      const q = query(collection(db, "labOrders"), where("patientId", "==", patientId));
      const snapshot = await getDocs(q);
      const data: LabOrder[] = snapshot.docs.map(doc => {
        const docData = doc.data() as Omit<LabOrder, 'id'> & { orderDate?: any; createdAt?: any; updatedAt?: any; };
        // Convert Firestore Timestamps to ISO strings
        const orderDate = docData.orderDate instanceof Timestamp ? docData.orderDate.toDate().toISOString() : docData.orderDate;
        const createdAt = docData.createdAt instanceof Timestamp ? docData.createdAt.toDate().toISOString() : docData.createdAt;
        const updatedAt = docData.updatedAt instanceof Timestamp ? docData.updatedAt.toDate().toISOString() : docData.updatedAt;

        return {
          id: doc.id,
          ...docData,
          orderDate,
          createdAt,
          updatedAt,
        } as LabOrder;
      });
      return data;
    } catch (err: any) {
      setError(err.message || `Failed to fetch lab orders for patient ${patientId}.`);
      console.error("Error fetching lab orders for patient:", err);
      return [];
    }
  }, []);

  const createLabOrder = useCallback(async (data: Omit<LabOrder, 'id' | 'createdAt' | 'updatedAt' | 'orderDate'>): Promise<LabOrder> => {
    setIsLoading(true);
    setError(null);
    try {
      // **THIS IS THE KEY CHANGE:**
      // Now, we make an HTTP POST request to your Next.js API route.
      // Your API route will handle the custom ID generation and Firestore write.
      const response = await fetch('/api/v1/lab/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data), // Send the new lab order data from the frontend
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `API error: ${response.statusText}`);
      }

      // The API should return the full created LabOrder object, including its new ID
      const createdLabOrder: LabOrder = await response.json();

      logActivity({
        actorRole: userRole || "System",
        actorName: username || "System",
        actionDescription: `Created Lab Order ${createdLabOrder.id} for ${createdLabOrder.patientName}`,
        targetEntityType: "Lab Order",
        targetEntityId: createdLabOrder.id, // Use the ID returned by your API
        iconName: "FlaskConical",
      });

      // After successful creation via the API, re-fetch all lab orders
      // to ensure the local state is synchronized with the backend.
      await fetchLabOrders(); // Important: Await this to ensure state is updated before returning

      return createdLabOrder;
    } catch (err: any) {
      setError(err.message || "Failed to create lab order.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userRole, username, fetchLabOrders]); // Include fetchLabOrders in dependencies

  const updateLabOrder = useCallback(async (id: string, data: Partial<Omit<LabOrder, 'id'>>): Promise<LabOrder | undefined> => {
    setIsLoading(true);
    setError(null);
    try {
      const docRef = doc(db, "labOrders", id);
      await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() }); // Update timestamp
      logActivity({
        actorRole: userRole || "System",
        actorName: username || "System",
        actionDescription: `Updated Lab Order ${id}`,
        targetEntityType: "Lab Order",
        targetEntityId: id,
        iconName: "Edit",
      });
      // After update, we might want to re-fetch all orders or update only the specific one in state
      await fetchLabOrders(); // Re-fetch to ensure consistency across the app
      const updatedSnap = await getDoc(docRef); // Fetch the updated document
      if (updatedSnap.exists()) {
        const updatedData = updatedSnap.data() as Omit<LabOrder, 'id'> & { orderDate?: any; createdAt?: any; updatedAt?: any; };
        const orderDate = updatedData.orderDate instanceof Timestamp ? updatedData.orderDate.toDate().toISOString() : updatedData.orderDate;
        const createdAt = updatedData.createdAt instanceof Timestamp ? updatedData.createdAt.toDate().toISOString() : updatedData.createdAt;
        const updatedAt = updatedData.updatedAt instanceof Timestamp ? updatedData.updatedAt.toDate().toISOString() : updatedData.updatedAt;

        return {
          id: updatedSnap.id,
          ...updatedData,
          orderDate,
          createdAt,
          updatedAt,
        } as LabOrder;
      }
      return undefined;
    } catch (err: any) {
      setError(err.message || "Failed to update lab order.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userRole, username, fetchLabOrders]); // Include fetchLabOrders in dependencies

  return (
    <LabOrderContext.Provider value={{
      labOrders,
      isLoadingLabOrders: isLoading,
      error,
      fetchLabOrders,
      fetchLabOrderById,
      fetchLabOrdersForPatient,
      createLabOrder,
      updateLabOrder,
    }}>
      {children}
    </LabOrderContext.Provider>
  );
}

export function useLabOrders() {
  const context = useContext(LabOrderContext);
  if (!context) throw new Error('useLabOrders must be used within a LabOrderProvider');
  return context;
}

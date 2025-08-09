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
  addDoc,
  updateDoc,
  query, // <--- Import query
  where, // <--- Import where
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
  fetchLabOrdersForPatient: (patientId: string) => Promise<LabOrder[]>; // <--- NEW: Add this to your type
  createLabOrder: (data: Omit<LabOrder, 'id'>) => Promise<LabOrder>;
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
      const snapshot = await getDocs(collection(db, "labOrders"));
      const data: LabOrder[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<LabOrder, 'id'>
      }));
      setLabOrders(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch lab orders.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabOrders();
  }, [fetchLabOrders]);

  const fetchLabOrderById = useCallback(async (id: string): Promise<LabOrder | undefined> => {
    setError(null);
    try {
      const docRef = doc(db, "labOrders", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() as Omit<LabOrder, 'id'> };
      }
      return undefined;
    } catch (err: any) {
      setError(err.message || "Failed to fetch lab order.");
      return undefined;
    }
  }, []);

  // <--- NEW FUNCTION IMPLEMENTATION START ---
  const fetchLabOrdersForPatient = useCallback(async (patientId: string): Promise<LabOrder[]> => {
    setError(null);
    try {
      const q = query(collection(db, "labOrders"), where("patientId", "==", patientId));
      const snapshot = await getDocs(q);
      const data: LabOrder[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<LabOrder, 'id'>
      }));
      return data;
    } catch (err: any) {
      setError(err.message || `Failed to fetch lab orders for patient ${patientId}.`);
      console.error("Error fetching lab orders for patient:", err);
      return [];
    }
  }, []);
  // <--- NEW FUNCTION IMPLEMENTATION END ---

  const createLabOrder = useCallback(async (data: Omit<LabOrder, 'id'>): Promise<LabOrder> => {
    setIsLoading(true);
    setError(null);
    try {
      const docRef = await addDoc(collection(db, "labOrders"), data);
      logActivity({
        actorRole: userRole || "System",
        actorName: username || "System",
        actionDescription: `Created Lab Order ${docRef.id} for ${data.patientName}`,
        targetEntityType: "Lab Order",
        targetEntityId: docRef.id,
        iconName: "FlaskConical",
      });
      return { id: docRef.id, ...data };
    } catch (err: any) {
      setError(err.message || "Failed to create lab order.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userRole, username]);

  const updateLabOrder = useCallback(async (id: string, data: Partial<Omit<LabOrder, 'id'>>): Promise<LabOrder | undefined> => {
    setIsLoading(true);
    setError(null);
    try {
      const docRef = doc(db, "labOrders", id);
      await updateDoc(docRef, data);
      logActivity({
        actorRole: userRole || "System",
        actorName: username || "System",
        actionDescription: `Updated Lab Order ${id}`,
        targetEntityType: "Lab Order",
        targetEntityId: id,
        iconName: "Edit",
      });
      const updatedSnap = await getDoc(docRef);
      if (updatedSnap.exists()) {
        return { id: updatedSnap.id, ...updatedSnap.data() as Omit<LabOrder, 'id'> };
      }
      return undefined;
    } catch (err: any) {
      setError(err.message || "Failed to update lab order.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userRole, username]);

  return (
    <LabOrderContext.Provider value={{
      labOrders,
      isLoadingLabOrders: isLoading,
      error,
      fetchLabOrders,
      fetchLabOrderById,
      fetchLabOrdersForPatient, // <--- NEW: Add this to the provider value
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

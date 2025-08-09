"use client";

import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from 'react';
import { type Appointment } from '@/app/dashboard/appointments/page';
import { logActivity } from '@/lib/activityLog';
import { useAuth } from './auth-context';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AppointmentContextType {
  appointments: Appointment[];
  isLoadingAppointments: boolean;
  error: string | null;
  fetchAppointments: () => Promise<void>;
  fetchAppointmentById: (appointmentId: string) => Promise<Appointment | undefined>;
  createAppointment: (newAppointmentData: Omit<Appointment, 'id'>) => Promise<Appointment>;
  updateAppointment: (appointmentId: string, updatedData: Partial<Omit<Appointment, 'id'>>) => Promise<Appointment | undefined>;
  cancelAppointment: (appointmentId: string) => Promise<void>;
  getAppointmentsForPatient: (patientId: string) => Promise<Appointment[]>;
}

const AppointmentContext = createContext<AppointmentContextType | undefined>(undefined);

const APPOINTMENTS_COLLECTION = "appointments";

// ---------- Firestore Helper Functions ----------

async function fetchAppointmentsFromFirestore(): Promise<Appointment[]> {
  const snapshot = await getDocs(collection(db, APPOINTMENTS_COLLECTION));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Appointment));
}

async function fetchAppointmentByIdFromFirestore(id: string): Promise<Appointment | undefined> {
  const ref = doc(db, APPOINTMENTS_COLLECTION, id);
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as Appointment : undefined;
}

async function createAppointmentInFirestore(newAppointment: Omit<Appointment, "id">): Promise<Appointment> {
  const ref = await addDoc(collection(db, APPOINTMENTS_COLLECTION), newAppointment);
  return { id: ref.id, ...newAppointment };
}

async function updateAppointmentInFirestore(id: string, updatedData: Partial<Omit<Appointment, "id">>): Promise<Appointment> {
  const ref = doc(db, APPOINTMENTS_COLLECTION, id);
  await updateDoc(ref, updatedData);
  const updatedSnapshot = await getDoc(ref);
  return { id: ref.id, ...updatedSnapshot.data() } as Appointment;
}

async function fetchAppointmentsForPatientFromFirestore(patientId: string): Promise<Appointment[]> {
  const q = query(collection(db, APPOINTMENTS_COLLECTION), where("patientId", "==", patientId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
}

// ---------- Context Provider ----------

export function AppointmentProvider({ children }: { children: ReactNode }) {
  const [appointmentsState, setAppointmentsState] = useState<Appointment[]>([]);
  const [isLoadingAppointmentsState, setIsLoadingAppointmentsState] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const { userRole, username } = useAuth();

  const fetchAppointments = useCallback(async () => {
    setIsLoadingAppointmentsState(true);
    setErrorState(null);
    try {
      const appointments = await fetchAppointmentsFromFirestore();
      setAppointmentsState(
        appointments.sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() ||
          a.time.localeCompare(b.time)
        )
      );
    } catch (error: any) {
      setErrorState(error.message || "Failed to fetch appointments.");
    } finally {
      setIsLoadingAppointmentsState(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const fetchAppointmentById = useCallback(async (appointmentId: string) => {
    setErrorState(null);
    try {
      return await fetchAppointmentByIdFromFirestore(appointmentId);
    } catch (error: any) {
      setErrorState(error.message || "Error fetching appointment.");
      return undefined;
    }
  }, []);

  const createAppointment = useCallback(async (data: Omit<Appointment, 'id'>) => {
    setIsLoadingAppointmentsState(true);
    setErrorState(null);
    try {
      const created = await createAppointmentInFirestore(data);
      setAppointmentsState(prev => [created, ...prev]);
      logActivity({
        actorRole: userRole || "System",
        actorName: username || "System",
        actionDescription: `Booked ${created.type} for ${created.patientName} with ${created.providerName}`,
        targetEntityType: "Appointment",
        targetEntityId: created.id,
        iconName: "CalendarPlus",
      });
      return created;
    } catch (error: any) {
      setErrorState(error.message || "Failed to create appointment.");
      throw error;
    } finally {
      setIsLoadingAppointmentsState(false);
    }
  }, [userRole, username]);

  const updateAppointment = useCallback(async (appointmentId: string, updatedData: Partial<Omit<Appointment, 'id'>>) => {
    setIsLoadingAppointmentsState(true);
    setErrorState(null);
    try {
      const updated = await updateAppointmentInFirestore(appointmentId, updatedData);
      setAppointmentsState(prev => prev.map(app => app.id === appointmentId ? updated : app));
      logActivity({
        actorRole: userRole || "System",
        actorName: username || "System",
        actionDescription: `Updated appointment ${appointmentId}. Status: ${updated.status}`,
        targetEntityType: "Appointment",
        targetEntityId: updated.id,
        iconName: "Edit",
      });
      return updated;
    } catch (error: any) {
      setErrorState(error.message || "Error updating appointment.");
      throw error;
    } finally {
      setIsLoadingAppointmentsState(false);
    }
  }, [userRole, username]);

  const cancelAppointment = useCallback(async (appointmentId: string) => {
    await updateAppointment(appointmentId, { status: "Cancelled" });
  }, [updateAppointment]);

  const getAppointmentsForPatient = useCallback(async (patientId: string) => {
    try {
      return await fetchAppointmentsForPatientFromFirestore(patientId);
    } catch (error: any) {
      setErrorState(error.message || "Error fetching patient appointments.");
      return [];
    }
  }, []);

  return (
    <AppointmentContext.Provider
      value={{
        appointments: appointmentsState,
        isLoadingAppointments: isLoadingAppointmentsState,
        error: errorState,
        fetchAppointments,
        fetchAppointmentById,
        createAppointment,
        updateAppointment,
        cancelAppointment,
        getAppointmentsForPatient,
      }}
    >
      {children}
    </AppointmentContext.Provider>
  );
}

export function useAppointments() {
  const context = useContext(AppointmentContext);
  if (!context) {
    throw new Error("useAppointments must be used within an AppointmentProvider");
  }
  return context;
}
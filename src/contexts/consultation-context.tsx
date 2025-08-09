"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import type { Consultation } from '@/app/dashboard/consultations/page';
import { logActivity } from '@/lib/activityLog';
import { useAuth } from './auth-context';
import { db, Timestamp } from '@/lib/firebase';
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
  onSnapshot,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';

const CONSULTATIONS_COLLECTION = 'consultations';

interface ConsultationContextType {
  consultations: Consultation[];
  isLoadingConsultations: boolean;
  fetchConsultationById: (consultationId: string) => Promise<Consultation | undefined>;
  createConsultation: (data: Omit<Consultation, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'reason'>) => Promise<Consultation>;
  updateConsultation: (consultationId: string, updatedData: Partial<Omit<Consultation, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'reason'>>) => Promise<Consultation | undefined>;
  fetchConsultationsForPatient: (patientId: string) => Promise<Consultation[]>;
}

const ConsultationContext = createContext<ConsultationContextType | undefined>(undefined);

// Helper to map Firestore doc to Consultation type
function mapFirestoreDocToConsultation(doc: DocumentData): Consultation {
  const data = doc.data();
  const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt;
  const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt;
  const displayTime = data.consultationDate ? new Date(data.consultationDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const displayReason = data.presentingComplaint ? data.presentingComplaint.substring(0, 50) : '';
  return {
    id: doc.id,
    ...data,
    createdAt,
    updatedAt,
    time: displayTime,
    reason: displayReason,
  } as Consultation;
}

async function fetchConsultationByIdFromFirestore(consultationId: string): Promise<Consultation | undefined> {
  const docRef = doc(db, CONSULTATIONS_COLLECTION, consultationId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? mapFirestoreDocToConsultation(docSnap) : undefined;
}

async function createConsultationInFirestore(data: Omit<Consultation, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'reason'>): Promise<Consultation> {
  const dataToStore = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, CONSULTATIONS_COLLECTION), dataToStore);
  const newDocSnap = await getDoc(docRef);
  if (newDocSnap.exists()) {
    return mapFirestoreDocToConsultation(newDocSnap);
  }
  throw new Error("Failed to retrieve created consultation document.");
}

async function updateConsultationInFirestore(consultationId: string, updatedData: Partial<Omit<Consultation, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'reason'>>): Promise<Consultation | undefined> {
  const docRef = doc(db, CONSULTATIONS_COLLECTION, consultationId);
  const dataToUpdate = {
    ...updatedData,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(docRef, dataToUpdate);
  const updatedDocSnap = await getDoc(docRef);
  return updatedDocSnap.exists() ? mapFirestoreDocToConsultation(updatedDocSnap) : undefined;
}

async function fetchConsultationsForPatientFromFirestore(patientId: string): Promise<Consultation[]> {
  const q = query(
    collection(db, CONSULTATIONS_COLLECTION),
    where("patientId", "==", patientId),
    orderBy('consultationDate', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(mapFirestoreDocToConsultation);
}

export function ConsultationProvider({ children }: { children: ReactNode }) {
  const [consultationsState, setConsultationsState] = useState<Consultation[]>([]);
  const [isLoadingConsultationsState, setIsLoadingConsultationsState] = useState(true);
  const { userRole, username } = useAuth();

  useEffect(() => {
    setIsLoadingConsultationsState(true);
    const q = query(collection(db, CONSULTATIONS_COLLECTION), orderBy('consultationDate', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const consultations = querySnapshot.docs.map(mapFirestoreDocToConsultation);
      setConsultationsState(consultations);
      setIsLoadingConsultationsState(false);
    }, () => {
      setIsLoadingConsultationsState(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchConsultationById = useCallback(async (consultationId: string) => {
    return fetchConsultationByIdFromFirestore(consultationId);
  }, []);

  const fetchConsultationsForPatient = useCallback(async (patientId: string) => {
    return fetchConsultationsForPatientFromFirestore(patientId);
  }, []);

  const createConsultation = useCallback(async (data: Omit<Consultation, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'reason'>): Promise<Consultation> => {
    setIsLoadingConsultationsState(true);
    try {
      const createdConsultation = await createConsultationInFirestore(data);
      logActivity({
        actorRole: userRole || "System",
        actorName: username || "System",
        actionDescription: `Created consultation note for ${createdConsultation.patientName} with Dr. ${createdConsultation.doctorName}`,
        targetEntityType: "Consultation",
        targetEntityId: createdConsultation.id,
        iconName: "MessageSquareText",
      });
      return createdConsultation;
    } finally {
      setIsLoadingConsultationsState(false);
    }
  }, [userRole, username]);

  const updateConsultation = useCallback(async (consultationId: string, updatedData: Partial<Omit<Consultation, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'reason'>>) => {
    setIsLoadingConsultationsState(true);
    try {
      const updatedConsultation = await updateConsultationInFirestore(consultationId, updatedData);
      logActivity({
        actorRole: userRole || "System",
        actorName: username || "System",
        actionDescription: `Updated consultation note ${consultationId} for ${updatedConsultation?.patientName || "Unknown Patient"}`,
        targetEntityType: "Consultation",
        targetEntityId: consultationId,
        iconName: "FileEdit",
      });
      return updatedConsultation;
    } finally {
      setIsLoadingConsultationsState(false);
    }
  }, [userRole, username]);

  return (
    <ConsultationContext.Provider value={{
      consultations: consultationsState,
      isLoadingConsultations: isLoadingConsultationsState,
      fetchConsultationById,
      createConsultation,
      updateConsultation,
      fetchConsultationsForPatient,
    }}>
      {children}
    </ConsultationContext.Provider>
  );
}

export function useConsultations() {
  const context = useContext(ConsultationContext);
  if (!context) {
    throw new Error('useConsultations must be used within a ConsultationProvider');
  }
  return context;
}
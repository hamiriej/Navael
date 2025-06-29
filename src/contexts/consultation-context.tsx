"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import type { Consultation } from '@/app/dashboard/consultations/page';
import { logActivity } from '@/lib/activityLog';
import { useAuth } from './auth-context';

// Import Firestore functions and the db instance
import { db, Timestamp } from '@/lib/firebase'; // Assuming db and Timestamp are exported from here
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy, // Often useful for sorting
    onSnapshot, // For real-time updates
    serverTimestamp, // For creation/update timestamps
    type DocumentData, // For type inference from Firestore
} from 'firebase/firestore';

// Define the Firestore collection reference
const CONSULTATIONS_COLLECTION = 'consultations';

interface ConsultationContextType {
    consultations: Consultation[];
    isLoadingConsultations: boolean;
    fetchConsultations: () => Promise<void>; // Will be updated to handle real-time listener cleanup
    fetchConsultationById: (consultationId: string) => Promise<Consultation | undefined>;
    createConsultation: (newConsultationData: Omit<Consultation, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'reason'>) => Promise<Consultation>;
    updateConsultation: (consultationId: string, updatedData: Partial<Omit<Consultation, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'reason'>>) => Promise<Consultation | undefined>;
    fetchConsultationsForPatient: (patientId: string) => Promise<Consultation[]>;
}

const ConsultationContext = createContext<ConsultationContextType | undefined>(undefined);

// --- Firestore API Wrappers ---

// Helper to convert Firestore DocumentData to your Consultation type
// Handles Firestore Timestamp objects by converting them to Date or ISO strings
const mapFirestoreDocToConsultation = (doc: DocumentData): Consultation => {
    const data = doc.data();

    const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt;
    const updatedAt = data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate().toISOString()
        : data.updatedAt;

    // Reconstruct 'time' and 'reason' for display from other fields
    // Assuming 'time' and 'reason' are derived/display-only properties not stored in DB
    const displayTime = data.consultationDate ? new Date(data.consultationDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const displayReason = data.presentingComplaint ? data.presentingComplaint.substring(0, 50) : '';

    return {
        id: doc.id,
        ...data,
        createdAt,
        updatedAt,
        time: displayTime, // Derived from consultationDate
        reason: displayReason, // Derived from presentingComplaint
    } as Consultation; // Cast to Consultation type, ensure all properties match or are derived
};

async function fetchConsultationsFromFirestore(): Promise<Consultation[]> {
    console.log("Firestore Call: Fetching all consultations");
    const q = query(collection(db, CONSULTATIONS_COLLECTION), orderBy('consultationDate', 'desc')); // Order by date
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapFirestoreDocToConsultation);
}

async function fetchConsultationByIdFromFirestore(consultationId: string): Promise<Consultation | undefined> {
    console.log(`Firestore Call: Fetching consultation by ID: ${consultationId}`);
    const docRef = doc(db, CONSULTATIONS_COLLECTION, consultationId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return mapFirestoreDocToConsultation(docSnap);
    } else {
        console.log("No such consultation document!");
        return undefined;
    }
}

async function createConsultationInFirestore(newConsultationData: Omit<Consultation, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'reason'>): Promise<Consultation> {
    console.log("Firestore Call: Creating new consultation", newConsultationData);

    const dataToStore = {
        ...newConsultationData,
        createdAt: serverTimestamp(), // Firestore automatically sets this when adding
        updatedAt: serverTimestamp(),
        // Fields like 'time' and 'reason' are derived, not stored directly
    };

    const docRef = await addDoc(collection(db, CONSULTATIONS_COLLECTION), dataToStore);

    // Return the created consultation with its Firestore-generated ID and server timestamps
    // We'll fetch it to get the actual server timestamp values
    const newDocSnap = await getDoc(docRef);
    if (newDocSnap.exists()) {
        return mapFirestoreDocToConsultation(newDocSnap);
    } else {
        // This case should ideally not happen if addDoc succeeded
        throw new Error("Failed to retrieve created consultation document.");
    }
}

async function updateConsultationInFirestore(consultationId: string, updatedData: Partial<Omit<Consultation, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'reason'>>): Promise<Consultation | undefined> {
    console.log(`Firestore Call: Updating consultation ID: ${consultationId}`, updatedData);
    const docRef = doc(db, CONSULTATIONS_COLLECTION, consultationId);

    const dataToUpdate = {
        ...updatedData,
        updatedAt: serverTimestamp(), // Update timestamp on every modification
    };

    await updateDoc(docRef, dataToUpdate);

    // Fetch the updated document to return its current state including new serverTimestamp
    const updatedDocSnap = await getDoc(docRef);
    if (updatedDocSnap.exists()) {
        return mapFirestoreDocToConsultation(updatedDocSnap);
    } else {
        console.log("Consultation document not found after update attempt.");
        return undefined;
    }
}

async function fetchConsultationsForPatientFromFirestore(patientId: string): Promise<Consultation[]> {
    console.log(`Firestore Call: Fetching consultations for patient ID: ${patientId}`);
    const q = query(
        collection(db, CONSULTATIONS_COLLECTION),
        where("patientId", "==", patientId),
        orderBy('consultationDate', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapFirestoreDocToConsultation);
}

// --- Consultation Provider ---

export function ConsultationProvider({ children }: { children: ReactNode }) {
    const [consultationsState, setConsultationsState] = useState<Consultation[]>([]);
    const [isLoadingConsultationsState, setIsLoadingConsultationsState] = useState(true);
    const { userRole, username } = useAuth(); // Assuming useAuth provides actorRole and actorName

    // Real-time listener for all consultations
    useEffect(() => {
        setIsLoadingConsultationsState(true);
        const q = query(collection(db, CONSULTATIONS_COLLECTION), orderBy('consultationDate', 'desc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const consultations = querySnapshot.docs.map(mapFirestoreDocToConsultation);
            setConsultationsState(consultations);
            setIsLoadingConsultationsState(false);
            console.log("Real-time update: Consultations fetched and state updated.");
        }, (error) => {
            console.error("Failed to listen for consultations:", error);
            setIsLoadingConsultationsState(false);
        });

        // Cleanup the listener when the component unmounts
        return () => unsubscribe();
    }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

    // fetchConsultations no longer needs to be async, it's driven by onSnapshot
    const fetchConsultations = useCallback(async () => {
        // The useEffect above with onSnapshot handles the continuous fetching.
        // If you need a forced one-time refresh outside of real-time,
        // you could call fetchConsultationsFromFirestore() here,
        // but typically onSnapshot covers most use cases.
        // For now, it will just re-trigger the listener or log a message.
        console.log("fetchConsultations called. Real-time listener is active.");
    }, []);

    const fetchConsultationById = useCallback(async (consultationId: string) => {
        return fetchConsultationByIdFromFirestore(consultationId);
    }, []);

    const fetchConsultationsForPatient = useCallback(async (patientId: string) => {
        return fetchConsultationsForPatientFromFirestore(patientId);
    }, []);

    const createConsultation = useCallback(async (newConsultationData: Omit<Consultation, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'reason'>): Promise<Consultation> => {
        setIsLoadingConsultationsState(true); // Indicate loading for this specific action
        try {
            const createdConsultation = await createConsultationInFirestore(newConsultationData);
            // State will be updated by the onSnapshot listener, no need to manually add here
            logActivity({
                actorRole: userRole || "System", actorName: username || "System",
                actionDescription: `Created consultation note for ${createdConsultation.patientName} with Dr. ${createdConsultation.doctorName}`,
                targetEntityType: "Consultation", targetEntityId: createdConsultation.id, iconName: "MessageSquareText",
            });
            return createdConsultation;
        } catch (error) {
            console.error("Failed to create consultation:", error);
            throw error; // Re-throw for component to handle
        } finally {
            setIsLoadingConsultationsState(false);
        }
    }, [userRole, username]); // Removed fetchConsultations from dependency array as it's now a no-op / handled by onSnapshot

    const updateConsultation = useCallback(async (consultationId: string, updatedData: Partial<Omit<Consultation, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'reason'>>) => {
        setIsLoadingConsultationsState(true);
        try {
            const updatedConsultation = await updateConsultationInFirestore(consultationId, updatedData);
            // State will be updated by the onSnapshot listener, no need to manually update here
            logActivity({
                actorRole: userRole || "System", actorName: username || "System",
                actionDescription: `Updated consultation note ${consultationId} for ${updatedConsultation?.patientName || "Unknown Patient"}`,
                targetEntityType: "Consultation", targetEntityId: consultationId, iconName: "FileEdit",
            });
            return updatedConsultation;
        } catch (error) {
            console.error("Failed to update consultation:", error);
            throw error; // Re-throw
        } finally {
            setIsLoadingConsultationsState(false);
        }
    }, [userRole, username]); // Removed fetchConsultations from dependency array

    return (
        <ConsultationContext.Provider value={{
            consultations: consultationsState, isLoadingConsultations: isLoadingConsultationsState,
            fetchConsultations, fetchConsultationById, createConsultation, updateConsultation, fetchConsultationsForPatient,
        }}>
            {children}
        </ConsultationContext.Provider>
    );
}

export function useConsultations() {
    const context = useContext(ConsultationContext);
    if (context === undefined) {
        throw new Error('useConsultations must be used within a ConsultationProvider');
    }
    return context;
}

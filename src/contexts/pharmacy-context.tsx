"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Medication, Prescription } from '@/app/dashboard/pharmacy/page';

export type { Medication, Prescription } from '@/app/dashboard/pharmacy/page';

interface PharmacyContextType {
  medications: Medication[];
  prescriptions: Prescription[];
  isLoadingMedications: boolean;
  isLoadingPrescriptions: boolean;
  fetchMedications: () => Promise<void>;
  fetchPrescriptions: () => Promise<void>;
  fetchPrescriptionsForPatientId: (patientId: string) => Promise<Prescription[]>;
  fetchPrescriptionsForAppointmentId: (appointmentId: string) => Promise<Prescription[]>; // <-- Added!
  addMedication: (newMed: Omit<Medication, 'id' | 'status'>) => Promise<Medication | undefined>;
  updateMedicationInInventory: (medId: string, updates: Partial<Medication>) => Promise<Medication | undefined>;
  deleteMedication: (medId: string) => Promise<void>;
  addPrescription: (newRx: Omit<Prescription, 'id'>) => Promise<Prescription | undefined>;
  updatePrescription: (rxId: string, updates: Partial<Prescription>) => Promise<Prescription | undefined>;
  deletePrescription: (rxId: string) => Promise<void>;
  getPrescriptionById: (id: string) => Promise<Prescription | undefined>;
}

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined);

const API_MEDICATIONS_URL = '/api/pharmacy/medications';
const API_PRESCRIPTIONS_URL = '/api/pharmacy/prescriptions';

export const PharmacyProvider = ({ children }: { children: React.ReactNode }) => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoadingMedications, setIsLoadingMedications] = useState(false);
  const [isLoadingPrescriptions, setIsLoadingPrescriptions] = useState(false);
  const { toast } = useToast();

  // --- Medication API Calls ---
  const fetchMedications = useCallback(async () => {
    setIsLoadingMedications(true);
    try {
      const response = await fetch(API_MEDICATIONS_URL);
      if (!response.ok) throw new Error("Failed to fetch medications");
      const data = await response.json();
      setMedications(data);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not load medications.", variant: "destructive" });
      setMedications([]);
    } finally {
      setIsLoadingMedications(false);
    }
  }, [toast]);

  const addMedication = useCallback(async (newMed: Omit<Medication, 'id' | 'status'>) => {
    try {
      const response = await fetch(API_MEDICATIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMed),
      });
      if (!response.ok) throw new Error("Failed to add medication");
      const addedMed = await response.json();
      setMedications(prev => [...prev, addedMed]);
      toast({ title: "Medication Added", description: `${addedMed.name} has been added.` });
      return addedMed;
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not add medication.", variant: "destructive" });
      return undefined;
    }
  }, [toast]);

  const updateMedicationInInventory = useCallback(async (medId: string, updates: Partial<Medication>) => {
    try {
      const response = await fetch(`${API_MEDICATIONS_URL}/${medId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update medication");
      const updatedMed = await response.json();
      setMedications(prev => prev.map(med => (med.id === medId ? updatedMed : med)));
      toast({ title: "Medication Updated", description: `${updatedMed.name} updated.` });
      return updatedMed;
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not update medication.", variant: "destructive" });
      return undefined;
    }
  }, [toast]);

  const deleteMedication = useCallback(async (medId: string) => {
    try {
      const response = await fetch(`${API_MEDICATIONS_URL}/${medId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Failed to delete medication");
      setMedications(prev => prev.filter(med => med.id !== medId));
      toast({ title: "Medication Deleted", description: "Medication removed successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not delete medication.", variant: "destructive" });
    }
  }, [toast]);

  // --- Prescription API Calls ---
  const fetchPrescriptions = useCallback(async () => {
    setIsLoadingPrescriptions(true);
    try {
      const response = await fetch(API_PRESCRIPTIONS_URL);
      if (!response.ok) throw new Error("Failed to fetch prescriptions");
      const data = await response.json();
      setPrescriptions(data);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not load prescriptions.", variant: "destructive" });
      setPrescriptions([]);
    } finally {
      setIsLoadingPrescriptions(false);
    }
  }, [toast]);

  const fetchPrescriptionsForPatientId = useCallback(async (patientId: string): Promise<Prescription[]> => {
    setIsLoadingPrescriptions(true);
    try {
      const url = new URL(API_PRESCRIPTIONS_URL, window.location.origin);
      url.searchParams.append('patientId', patientId);
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Failed to fetch prescriptions for patient");
      const data: Prescription[] = await response.json();
      return data;
    } catch (error: any) {
      toast({ title: "Error", description: error.message || `Could not load prescriptions for patient ${patientId}.`, variant: "destructive" });
      return [];
    } finally {
      setIsLoadingPrescriptions(false);
    }
  }, [toast]);

  // --- NEW: Fetch prescriptions for a specific appointment ---
  const fetchPrescriptionsForAppointmentId = useCallback(async (appointmentId: string): Promise<Prescription[]> => {
    setIsLoadingPrescriptions(true);
    try {
      const url = new URL(API_PRESCRIPTIONS_URL, window.location.origin);
      url.searchParams.append('linkedAppointmentId', appointmentId);
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Failed to fetch prescriptions for appointment");
      const data: Prescription[] = await response.json();
      return data;
    } catch (error: any) {
      toast({ title: "Error", description: error.message || `Could not load prescriptions for appointment ${appointmentId}.`, variant: "destructive" });
      return [];
    } finally {
      setIsLoadingPrescriptions(false);
    }
  }, [toast]);

  const addPrescription = useCallback(async (newRx: Omit<Prescription, 'id'>) => {
    try {
      const response = await fetch(API_PRESCRIPTIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRx),
      });
      if (!response.ok) throw new Error("Failed to add prescription");
      const addedRx = await response.json();
      setPrescriptions(prev => [...prev, addedRx]);
      toast({ title: "Prescription Added", description: `Prescription for ${addedRx.patientName} added.` });
      return addedRx;
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not add prescription.", variant: "destructive" });
      return undefined;
    }
  }, [toast]);

  const updatePrescription = useCallback(async (rxId: string, updates: Partial<Prescription>) => {
    try {
      const response = await fetch(`${API_PRESCRIPTIONS_URL}/${rxId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update prescription");
      const updatedRx = await response.json();
      setPrescriptions(prev => prev.map(rx => (rx.id === rxId ? updatedRx : rx)));
      toast({ title: "Prescription Updated", description: `Prescription ${rxId} updated.` });
      return updatedRx;
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not update prescription.", variant: "destructive" });
      return undefined;
    }
  }, [toast]);

  const deletePrescription = useCallback(async (rxId: string) => {
    try {
      const response = await fetch(`${API_PRESCRIPTIONS_URL}/${rxId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Failed to delete prescription");
      setPrescriptions(prev => prev.filter(rx => rx.id !== rxId));
      toast({ title: "Prescription Deleted", description: "Prescription removed successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not delete prescription.", variant: "destructive" });
    }
  }, [toast]);

  const getPrescriptionById = useCallback(async (id: string): Promise<Prescription | undefined> => {
    setIsLoadingPrescriptions(true);
    try {
      const response = await fetch(`${API_PRESCRIPTIONS_URL}/${id}`);
      if (!response.ok) {
        if (response.status === 404) return undefined;
        throw new Error("Failed to fetch prescription");
      }
      const data: Prescription = await response.json();
      return data;
    } catch (error: any) {
      toast({ title: "Error", description: error.message || `Could not load prescription ${id}.`, variant: "destructive" });
      return undefined;
    } finally {
      setIsLoadingPrescriptions(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMedications();
    fetchPrescriptions();
  }, [fetchMedications, fetchPrescriptions]);

  const contextValue = React.useMemo(() => ({
    medications,
    prescriptions,
    isLoadingMedications,
    isLoadingPrescriptions,
    fetchMedications,
    fetchPrescriptions,
    fetchPrescriptionsForPatientId,
    fetchPrescriptionsForAppointmentId, // <-- Added!
    addMedication,
    updateMedicationInInventory,
    deleteMedication,
    addPrescription,
    updatePrescription,
    deletePrescription,
    getPrescriptionById,
  }), [
    medications,
    prescriptions,
    isLoadingMedications,
    isLoadingPrescriptions,
    fetchMedications,
    fetchPrescriptions,
    fetchPrescriptionsForPatientId,
    fetchPrescriptionsForAppointmentId, // <-- Added!
    addMedication,
    updateMedicationInInventory,
    deleteMedication,
    addPrescription,
    updatePrescription,
    deletePrescription,
    getPrescriptionById,
  ]);

  return (
    <PharmacyContext.Provider value={contextValue}>
      {children}
    </PharmacyContext.Provider>
  );
};

export const usePharmacy = () => {
  const context = useContext(PharmacyContext);
  if (context === undefined) {
    throw new Error('usePharmacy must be used within a PharmacyProvider');
  }
  return context;
};
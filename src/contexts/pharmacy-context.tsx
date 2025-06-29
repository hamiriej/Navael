// src/contexts/pharmacy-context.tsx

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Medication, Prescription } from '@/app/dashboard/pharmacy/page'; // Adjust path if Medication is elsewhere

// If you've removed localStorage usage, these lines can stay commented or be deleted.
// export const PHARMACY_MEDICATIONS_STORAGE_KEY = 'navael_pharmacy_medications';
// export const PHARMACY_PRESCRIPTIONS_STORAGE_KEY = 'navael_pharmacy_prescriptions';

export type { Medication, Prescription } from '@/app/dashboard/pharmacy/page'; // Add 'export type' here


interface PharmacyContextType {
  medications: Medication[];
  prescriptions: Prescription[];
  isLoadingMedications: boolean;
  isLoadingPrescriptions: boolean;
  fetchMedications: () => Promise<void>;
  fetchPrescriptions: () => Promise<void>;
  fetchPrescriptionsForPatientId: (patientId: string) => Promise<Prescription[]>;
  addMedication: (newMed: Omit<Medication, 'id' | 'status'>) => Promise<Medication | undefined>;
  updateMedicationInInventory: (medId: string, updates: Partial<Medication>) => Promise<Medication | undefined>;
  deleteMedication: (medId: string) => Promise<void>;
  addPrescription: (newRx: Omit<Prescription, 'id'>) => Promise<Prescription | undefined>;
  updatePrescription: (rxId: string, updates: Partial<Prescription>) => Promise<Prescription | undefined>;
  deletePrescription: (rxId: string) => Promise<void>;
  getPrescriptionById: (id: string) => Promise<Prescription | undefined>; // This is now fully supported!

}

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined);

// API Endpoints
const API_MEDICATIONS_URL = '/api/pharmacy/medications';
const API_PRESCRIPTIONS_URL = '/api/pharmacy/prescriptions'; // For future prescription management API

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
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText || `API Error: ${response.status}`}));
        throw new Error(`Failed to fetch medications: ${errorData.message}`);
      }
      const data = await response.json();
      setMedications(data);
    } catch (error: any) {
      console.error("Error fetching medications:", error);
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText || `API Error: ${response.status}`}));
        throw new Error(`Failed to add medication: ${errorData.message}`);
      }

      const addedMed = await response.json();
      setMedications(prev => [...prev, addedMed]);
      toast({ title: "Medication Added", description: `${addedMed.name} has been added.` });
      return addedMed;
    } catch (error: any) {
      console.error("Error adding medication:", error);
      toast({ title: "Error", description: error.message || "Could not add medication.", variant: "destructive" });
      return undefined;
    }
  }, [toast]);

  const updateMedicationInInventory = useCallback(async (medId: string, updates: Partial<Medication>) => {
    try {
      const response = await fetch(`${API_MEDICATIONS_URL}/${medId}`, {
        method: 'PATCH', // Use PATCH for partial updates
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText || `API Error: ${response.status}`}));
        throw new Error(`Failed to update medication: ${errorData.message}`);
      }

      const updatedMed = await response.json();
      setMedications(prev => prev.map(med => (med.id === medId ? updatedMed : med)));
      toast({ title: "Medication Updated", description: `${updatedMed.name} updated.` });
      return updatedMed;
    } catch (error: any) {
      console.error("Error updating medication:", error);
      toast({ title: "Error", description: error.message || "Could not update medication.", variant: "destructive" });
      return undefined;
    }
  }, [toast]);

  const deleteMedication = useCallback(async (medId: string) => {
    try {
      const response = await fetch(`${API_MEDICATIONS_URL}/${medId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText || `API Error: ${response.status}`}));
        throw new Error(`Failed to delete medication: ${errorData.message}`);
      }

      setMedications(prev => prev.filter(med => med.id !== medId));
      toast({ title: "Medication Deleted", description: "Medication removed successfully." });
    } catch (error: any) {
      console.error("Error deleting medication:", error);
      toast({ title: "Error", description: error.message || "Could not delete medication.", variant: "destructive" });
    }
  }, [toast]);

  // --- Prescription API Calls ---

  const fetchPrescriptions = useCallback(async () => {
    setIsLoadingPrescriptions(true);
    try {
      const response = await fetch(API_PRESCRIPTIONS_URL);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText || `API Error: ${response.status}`}));
        throw new Error(`Failed to fetch prescriptions: ${errorData.message}`);
      }
      const data = await response.json();
      setPrescriptions(data); // This populates the prescriptions state!
    } catch (error: any) {
      console.error("Error fetching prescriptions:", error);
      toast({ title: "Error", description: error.message || "Could not load prescriptions.", variant: "destructive" });
      setPrescriptions([]);
    } finally {
      setIsLoadingPrescriptions(false);
    }
  }, [toast]);

  // NEW FUNCTION: Fetch prescriptions for a specific patient
  const fetchPrescriptionsForPatientId = useCallback(async (patientId: string): Promise<Prescription[]> => {
    setIsLoadingPrescriptions(true);
    try {
      // Assuming your API supports filtering prescriptions by patientId via a query parameter
      const url = new URL(API_PRESCRIPTIONS_URL, window.location.origin);
      url.searchParams.append('patientId', patientId);

      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText || `API Error: ${response.status}`}));
        throw new Error(`Failed to fetch prescriptions for patient ${patientId}: ${errorData.message}`);
      }
      const data: Prescription[] = await response.json();
      return data;
    } catch (error: any) {
      console.error(`Error fetching prescriptions for patient ${patientId}:`, error);
      toast({ title: "Error", description: error.message || `Could not load prescriptions for patient ${patientId}.`, variant: "destructive" });
      return []; // Return empty array on error
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
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText || `API Error: ${response.status}`}));
        throw new Error(`Failed to add prescription: ${errorData.message}`);
      }
      const addedRx = await response.json();
      // After adding, you might want to re-fetch all prescriptions
      // or simply add the new one to the existing state if the API returns the full object
      setPrescriptions(prev => [...prev, addedRx]);
      toast({ title: "Prescription Added", description: `Prescription for ${addedRx.patientName} added.` });
      return addedRx;
    } catch (error: any) {
      console.error("Error adding prescription:", error);
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
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText || `API Error: ${response.status}`}));
        throw new Error(`Failed to update prescription: ${errorData.message}`);
      }
      const updatedRx = await response.json();
      setPrescriptions(prev => prev.map(rx => (rx.id === rxId ? updatedRx : rx)));
      toast({ title: "Prescription Updated", description: `Prescription ${rxId} updated.` });
      return updatedRx;
    } catch (error: any) {
      console.error("Error updating prescription:", error);
      toast({ title: "Error", description: error.message || "Could not update prescription.", variant: "destructive" });
      return undefined;
    }
  }, [toast]);

  const deletePrescription = useCallback(async (rxId: string) => {
    try {
      const response = await fetch(`${API_PRESCRIPTIONS_URL}/${rxId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText || `API Error: ${response.status}`}));
        throw new Error(`Failed to delete prescription: ${errorData.message}`);
      }
      setPrescriptions(prev => prev.filter(rx => rx.id !== rxId));
      toast({ title: "Prescription Deleted", description: "Prescription removed successfully." });
    } catch (error: any) {
      console.error("Error deleting prescription:", error);
      toast({ title: "Error", description: error.message || "Could not delete prescription.", variant: "destructive" });
    }
  }, [toast]);

  // Function to get a single prescription by ID - now correctly defined!
  const getPrescriptionById = useCallback(async (id: string): Promise<Prescription | undefined> => {
    setIsLoadingPrescriptions(true); // You might want a more specific loading state for single fetches
    try {
      const response = await fetch(`${API_PRESCRIPTIONS_URL}/${id}`);
      if (!response.ok) {
        // Handle 404 specifically if you expect it for non-existent IDs
        if (response.status === 404) {
          console.warn(`Prescription with ID ${id} not found.`);
          return undefined; // Return undefined if not found
        }
        const errorData = await response.json().catch(() => ({ message: response.statusText || `API Error: ${response.status}`}));
        throw new Error(`Failed to fetch prescription ${id}: ${errorData.message}`);
      }
      const data: Prescription = await response.json();
      return data;
    } catch (error: any) {
      console.error(`Error fetching prescription ${id}:`, error);
      toast({ title: "Error", description: error.message || `Could not load prescription ${id}.`, variant: "destructive" });
      return undefined; // Return undefined on error
    } finally {
      setIsLoadingPrescriptions(false); // Reset loading state
    }
  }, [toast]);


  // Initial data load on component mount - CORRECTED TO FETCH PRESCRIPTIONS!
  useEffect(() => {
    fetchMedications();
    // This now actively calls your API to fetch the prescriptions!
    fetchPrescriptions();
  }, [fetchMedications, fetchPrescriptions]); // Ensure both are in the dependency array

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
    medications,
    prescriptions,
    isLoadingMedications,
    isLoadingPrescriptions,
    fetchMedications,
    fetchPrescriptions,
    fetchPrescriptionsForPatientId,
    addMedication,
    updateMedicationInInventory,
    deleteMedication,
    addPrescription,
    updatePrescription,
    deletePrescription,
    getPrescriptionById, // <== Explicitly included in the value object!
  }), [
    medications,
    prescriptions,
    isLoadingMedications,
    isLoadingPrescriptions,
    fetchMedications,
    fetchPrescriptions,
    fetchPrescriptionsForPatientId,
    addMedication,
    updateMedicationInInventory,
    deleteMedication,
    addPrescription,
    updatePrescription,
    deletePrescription,
    getPrescriptionById, // <== Explicitly included in the dependency array!
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

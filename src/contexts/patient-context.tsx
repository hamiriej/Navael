// src/contexts/patient-context.tsx

"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { logActivity } from '@/lib/activityLog'; // Assuming this path is correct
import { useAuth } from './auth-context'; // Assuming this path is correct
import { format } from 'date-fns'; // Using date-fns for date formatting

export const PATIENTS_STORAGE_KEY = 'navael_patients';

// --- Refined Patient Interface (for Database Storage) ---
// This interface defines the structure of a patient object AS IT WILL BE STORED IN FIRESTORE.
export interface Patient {
  id: string; // Firestore document ID
  firstName: string; // Stored separately
  lastName: string;  // Stored separately
  gender: "Male" | "Female" | "Other" | "Prefer not to say";
  dateOfBirth: string; // Stored as ISO string (YYYY-MM-DD)
  contactNumber: string;
  email: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  emergencyContact: {
    name: string;
    relationship: string;
    number: string;
  };
  insurance?: { // Making provider and policyNumber optional within the object
    provider?: string;
    policyNumber?: string;
  };
  allergies?: string[]; // Array of strings
  currentMedications?: { name: string; dosage: string; frequency: string }[]; // Array of objects
  medicalHistoryNotes?: string;
  lastVisit: string; // Stored as ISO string (YYYY-MM-DD)
  status: "Active" | "Inactive" | "Pending";
  profilePictureUrl?: string;
  createdAt?: string; // Timestamp when created in DB (ISO string)
}

// --- NewPatientFormData Interface (for Form Input) ---
// This perfectly reflects the data collected from your "Add New Patient" form.
export interface NewPatientFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: Date; // Date object from form input
  gender: "Male" | "Female" | "Other" | "Prefer not to say";
  contactNumber: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  insuranceProvider?: string; // These are string | undefined from form
  insurancePolicyNumber?: string; // These are string | undefined from form
  allergies?: string; // Comma-separated string from form
  currentMedicationsNotes?: string; // Multiline text from form
  medicalHistoryNotes?: string;
}

// --- Augmented Patient for Frontend Display ---
// This type is used when components consume the context. It adds 'name' and 'age'
// back to the Patient object, derived from firstName/lastName and dateOfBirth.
export type AugmentedPatient = Patient & {
  name: string;
  age: number;
};

// --- PatientContextType ---
// This defines the public API of our context, including augmented patients for convenience.
interface PatientContextType {
  patients: AugmentedPatient[]; // Array of patients augmented for frontend display
  fetchPatients: (queryParams?: Record<string, string>) => Promise<void>;
  addPatient: (patientData: NewPatientFormData) => Promise<AugmentedPatient>;
  updatePatient: (
    patientId: string,
    updatedPatientData: Partial<
      Omit<Patient, 'id' | 'createdAt'> & { // Base for DB fields
        dateOfBirth?: Date;
        allergies?: string;
        currentMedicationsNotes?: string;
        // Address parts for partial update
        addressLine1?: string; addressLine2?: string; city?: string; state?: string; postalCode?: string;
        // Emergency Contact parts for partial update
        emergencyContactName?: string; emergencyContactRelationship?: string; emergencyContactNumber?: string;
        // Insurance parts for partial update (from form)
        insuranceProvider?: string; insurancePolicyNumber?: string;
      }
    >
  ) => Promise<AugmentedPatient>;
  deletePatient: (patientId: string) => Promise<void>;
  getPatientById: (patientId: string) => Promise<AugmentedPatient | undefined>;
  isLoading: boolean;
  error: string | null;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

// Helper function to augment a Patient object with 'name' and 'age' for frontend display
// This function takes the DB-structured Patient and adds display properties
function augmentPatientForFrontend(patient: Patient): AugmentedPatient {
  // Ensure dateOfBirth is a valid date string before parsing
  let age = 0;
  try {
    const birthDate = new Date(patient.dateOfBirth);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
  } catch (e) {
    console.warn("Could not parse dateOfBirth for age calculation:", patient.dateOfBirth, e);
    // age remains 0 or handle error more specifically
  }

  return {
    ...patient,
    name: `${patient.firstName} ${patient.lastName}`,
    age: age,
  };
}

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patientsState, setPatientsState] = useState<AugmentedPatient[]>([]);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const { userRole, username } = useAuth(); // Assuming useAuth provides these

  // --- FETCH PATIENTS ---
  const fetchPatients = useCallback(async (queryParams?: Record<string, string>) => {
    setIsLoadingState(true);
    setErrorState(null);
    try {
      // Construct URL relative to current origin, adding query params if any
      const url = new URL('/api/patients', window.location.origin);
      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch patient data.");
      }
      const data: Patient[] = await response.json(); // Data from API is in 'Patient' (DB) format

      // Augment each patient for frontend display before setting state
      const augmentedPatients = data.map(augmentPatientForFrontend);
      setPatientsState(augmentedPatients);

    } catch (error: any) {
      console.error("Failed to fetch patients:", error);
      setErrorState(error.message || "Failed to fetch patient data.");
      setPatientsState([]); // Set to empty on error
    } finally {
      setIsLoadingState(false);
    }
  }, []); // Empty dependency array as it only depends on initial setup

  // Initial fetch on component mount
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // --- GET PATIENT BY ID ---
  const getPatientById = useCallback(async (patientId: string): Promise<AugmentedPatient | undefined> => {
    setErrorState(null); // Clear previous errors for this specific fetch
    try {
      const response = await fetch(`/api/patients/${patientId}`);
      if (!response.ok) {
        if (response.status === 404) return undefined; // Patient not found, return undefined gracefully
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch patient ${patientId}.`);
      }
      const patient: Patient = await response.json(); // Data from API is in 'Patient' (DB) format

      // Augment the patient for frontend display before returning
      return augmentPatientForFrontend(patient);
    } catch (error: any) {
      console.error(`Failed to fetch patient ${patientId}:`, error);
      setErrorState(error.message || `Failed to fetch patient ${patientId}.`);
      return undefined;
    }
  }, []);


  // --- ADD PATIENT ---
  const addPatient = useCallback(async (newPatientFormData: NewPatientFormData): Promise<AugmentedPatient> => {
    setIsLoadingState(true);
    setErrorState(null);

    // Transform NewPatientFormData into the Patient format suitable for Firestore storage.
    // This structure will be sent to the backend.
    const patientDataForFirestore: Omit<Patient, 'id' | 'createdAt'> = {
      firstName: newPatientFormData.firstName,
      lastName: newPatientFormData.lastName,
      gender: newPatientFormData.gender,
      dateOfBirth: format(newPatientFormData.dateOfBirth, "yyyy-MM-dd"), // Format Date object to string
      contactNumber: newPatientFormData.contactNumber,
      email: newPatientFormData.email || "",
      address: {
        line1: newPatientFormData.addressLine1,
        line2: newPatientFormData.addressLine2 || undefined, // Ensure undefined if empty
        city: newPatientFormData.city,
        state: newPatientFormData.state,
        postalCode: newPatientFormData.postalCode,
      },
      emergencyContact: {
        name: newPatientFormData.emergencyContactName,
        relationship: newPatientFormData.emergencyContactRelationship,
        number: newPatientFormData.emergencyContactNumber,
      },
      // Construct insurance object only if provider or policyNumber is present
      insurance: (newPatientFormData.insuranceProvider || newPatientFormData.insurancePolicyNumber) ? {
        provider: newPatientFormData.insuranceProvider || undefined,
        policyNumber: newPatientFormData.insurancePolicyNumber || undefined,
      } : undefined, // Entire insurance object is undefined if neither is provided
      allergies: newPatientFormData.allergies ? newPatientFormData.allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
      currentMedications: newPatientFormData.currentMedicationsNotes
        ? newPatientFormData.currentMedicationsNotes.split('\n').map(line => {
          const parts = line.split(' '); // Simple split, might need more robust parsing
          return { name: parts[0] || "Unknown", dosage: parts[1] || "", frequency: parts.slice(2).join(' ') || "" };
        }).filter(m => m.name !== "Unknown" || m.dosage !== "" || m.frequency !== "") // Filter out truly empty entries
        : [],
      medicalHistoryNotes: newPatientFormData.medicalHistoryNotes || "",
      lastVisit: format(new Date(), "yyyy-MM-dd"), // Set lastVisit to today on creation
      status: "Active", // Default to active
      profilePictureUrl: undefined, // Not collected in form currently, can be added later
    };

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientDataForFirestore), // Send the DB-ready object to the backend
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add patient.");
      }

      const createdPatientFromApi: Patient = await response.json(); // API returns Patient (DB format)

      // Augment the received patient for local state and return
      const augmentedPatient = augmentPatientForFrontend(createdPatientFromApi);
      setPatientsState(prev => [augmentedPatient, ...prev]); // Add to the beginning of the list for immediate visibility

      logActivity({
        actorRole: userRole || "System",
        actorName: username || "System",
        actionDescription: `Registered new patient: ${augmentedPatient.name}`,
        targetEntityType: "Patient",
        targetEntityId: augmentedPatient.id,
        iconName: "UserPlus",
      });
      return augmentedPatient;
    } catch (error: any) {
      setErrorState(error.message || "Failed to add patient.");
      console.error("Failed to add patient:", error);
      throw error; // Re-throw for the component to handle
    } finally {
      setIsLoadingState(false);
    }
  }, [userRole, username]);

  // --- UPDATE PATIENT ---
const updatePatient = useCallback(async (
  patientId: string,
  updatedDataFromForm: Partial< // <--- THIS IS THE TYPE DEFINITION TO CHANGE
    Omit<Patient, 'id' | 'createdAt'> & {
      dateOfBirth?: Date;
      // --- CHANGE 1: Allergies is now an array ---
      allergies?: string[];
      // --- CHANGE 2: CurrentMedications is now an array of objects (and name changed from Notes) ---
      currentMedications?: { name: string; dosage: string; frequency: string }[];
      // Keep other form-specific flat fields if they are still part of this partial update structure
      addressLine1?: string; addressLine2?: string; city?: string; state?: string; postalCode?: string;
      emergencyContactName?: string; emergencyContactRelationship?: string; emergencyContactNumber?: string;
      insuranceProvider?: string; insurancePolicyNumber?: string;
    }
  >
): Promise<AugmentedPatient> => {
  setIsLoadingState(true);
  const existingPatient = patientsState.find(p => p.id === patientId);
  if (!existingPatient) {
    setIsLoadingState(false);
    const err = new Error("Patient not found in local state for update.");
    setErrorState(err.message);
    throw err;
  }

  const updatePayload: Partial<Patient> = {};

  // ... (direct fields like firstName, lastName, gender, contactNumber, email, etc. remain unchanged) ...

  // Handle dateOfBirth: Date object needs to be formatted to string
  if (updatedDataFromForm.dateOfBirth !== undefined) {
    updatePayload.dateOfBirth = format(updatedDataFromForm.dateOfBirth, "yyyy-MM-dd");
  }

  // --- FIX 3: Allergies is already an array, just assign it ---
  if (updatedDataFromForm.allergies !== undefined) {
    // Add a filter(Boolean) just for safety to remove any potential empty strings if the form sends them
    updatePayload.allergies = updatedDataFromForm.allergies.filter(Boolean);
  }

  // --- FIX 4: currentMedications is already an array of objects, just assign it ---
  if (updatedDataFromForm.currentMedications !== undefined) {
    // Assuming the form is already sending it in the correct format.
    // You might add a .filter() here too if there's a chance of null/undefined entries in the array.
    updatePayload.currentMedications = updatedDataFromForm.currentMedications;
  }
  // ... (rest of the updatePatient function, including address, emergencyContact, insurance transformations) ...

    // Handle nested objects (address, emergencyContact, insurance):
    // IMPORTANT: For Firestore `update`, if you send a nested object, it overwrites the whole object.
    // So, you need to either send the entire *new* nested object or use Firestore's FieldValue.delete()
    // if you want to remove a specific sub-field.
    // For partial updates within nested objects, you often fetch the existing object, merge changes,
    // and then send the *entire merged* sub-object.
    // Your current `updatedDataFromForm` splits these into flat properties, so we need to rebuild.

    const newAddress = { ...existingPatient.address }; // Start with existing address
    let addressChanged = false;

    if (updatedDataFromForm.addressLine1 !== undefined) {
        newAddress.line1 = updatedDataFromForm.addressLine1;
        addressChanged = true;
    }
    if (updatedDataFromForm.addressLine2 !== undefined) {
        newAddress.line2 = updatedDataFromForm.addressLine2 || undefined; // Handle potential empty string
        addressChanged = true;
    }
    if (updatedDataFromForm.city !== undefined) {
        newAddress.city = updatedDataFromForm.city;
        addressChanged = true;
    }
    if (updatedDataFromForm.state !== undefined) {
        newAddress.state = updatedDataFromForm.state;
        addressChanged = true;
    }
    if (updatedDataFromForm.postalCode !== undefined) {
        newAddress.postalCode = updatedDataFromForm.postalCode;
        addressChanged = true;
    }
    if (addressChanged) {
        updatePayload.address = newAddress;
    }

    const newEmergencyContact = { ...existingPatient.emergencyContact };
    let emergencyContactChanged = false;

    if (updatedDataFromForm.emergencyContactName !== undefined) {
        newEmergencyContact.name = updatedDataFromForm.emergencyContactName;
        emergencyContactChanged = true;
    }
    if (updatedDataFromForm.emergencyContactRelationship !== undefined) {
        newEmergencyContact.relationship = updatedDataFromForm.emergencyContactRelationship;
        emergencyContactChanged = true;
    }
    if (updatedDataFromForm.emergencyContactNumber !== undefined) {
        newEmergencyContact.number = updatedDataFromForm.emergencyContactNumber;
        emergencyContactChanged = true;
    }
    if (emergencyContactChanged) {
        updatePayload.emergencyContact = newEmergencyContact;
    }

    const newInsurance = { ...existingPatient.insurance }; // Use existing, could be undefined
    let insuranceChanged = false;

    if (updatedDataFromForm.insuranceProvider !== undefined) {
        newInsurance.provider = updatedDataFromForm.insuranceProvider || undefined;
        insuranceChanged = true;
    }
    if (updatedDataFromForm.insurancePolicyNumber !== undefined) {
        newInsurance.policyNumber = updatedDataFromForm.insurancePolicyNumber || undefined;
        insuranceChanged = true;
    }

    // If insurance changed, add the (possibly updated) newInsurance object to payload
    // If both provider and policyNumber become undefined, it effectively removes the insurance object.
    if (insuranceChanged) {
        if (!newInsurance.provider && !newInsurance.policyNumber) {
            // If both become empty, set insurance to undefined to effectively remove it from Firestore
            updatePayload.insurance = undefined;
        } else {
            updatePayload.insurance = newInsurance;
        }
    }


    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'PATCH', // PATCH for partial updates! Excellent choice.
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload), // Send the constructed partial update payload
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to update patient ${patientId}.`);
      }

      const updatedPatientFromApi: Patient = await response.json(); // API returns the updated Patient (DB format)

      // Augment the received patient for local state and update
      const augmentedPatient = augmentPatientForFrontend(updatedPatientFromApi);

      setPatientsState(prev => prev.map(p => p.id === patientId ? augmentedPatient : p)); // Update in place

      logActivity({
        actorRole: userRole || "System",
        actorName: username || "System",
        actionDescription: `Updated patient details: ${augmentedPatient.name}`,
        targetEntityType: "Patient",
        targetEntityId: augmentedPatient.id, // Corrected icon name
        iconName: "FileEdit",
      });

      return augmentedPatient;
    } catch (error: any) {
      setErrorState(error.message || `Failed to update patient ${patientId}.`);
      console.error(`Failed to update patient ${patientId}:`, error);
      throw error;
    } finally {
      setIsLoadingState(false);
    }
  }, [patientsState, userRole, username]); // Dependencies: patientsState to get existing, userRole/username for logging

  // --- DELETE PATIENT ---
  const deletePatient = useCallback(async (patientId: string): Promise<void> => {
    setIsLoadingState(true);
    setErrorState(null);
    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete patient ${patientId}.`);
      }

      setPatientsState(prev => prev.filter(p => p.id !== patientId)); // Remove from local state

      logActivity({
        actorRole: userRole || "System",
        actorName: username || "System",
        actionDescription: `Deleted patient with ID: ${patientId}`,
        targetEntityType: "Patient",
        targetEntityId: patientId,
        iconName: "UserMinus",
      });

    } catch (error: any) {
      setErrorState(error.message || `Failed to delete patient ${patientId}.`);
      console.error(`Failed to delete patient ${patientId}:`, error);
      throw error;
    } finally {
      setIsLoadingState(false);
    }
  }, [userRole, username]); // Dependencies: userRole/username for logging

  // --- CONTEXT VALUE ---
  const contextValue = {
    patients: patientsState,
    fetchPatients,
    addPatient,
    updatePatient,
    deletePatient,
    getPatientById,
    isLoading: isLoadingState,
    error: errorState,
  };

  return (
    <PatientContext.Provider value={contextValue}>
      {children}
    </PatientContext.Provider>
  );
}
console.log("Patient context module loaded");
export function usePatients() {
  const context = useContext(PatientContext);
  if (context === undefined) {
    throw new Error('usePatients must be used within a PatientProvider');
  }
  return context;
}
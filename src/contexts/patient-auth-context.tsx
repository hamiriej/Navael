// src/contexts/patient-auth-context.tsx

"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
// Using the existing Patient and AugmentedPatient types
import { PATIENT_STORAGE_KEY, type Patient, type AugmentedPatient } from '@/contexts/patient-context'; 
import { usePatients } from './patient-context'; // Keep this import, though not directly used in the login logic for now

interface PatientAuthContextType {
  isAuthenticated: boolean;
  patientId: string | null;
  patientName: string | null;
  login: (patientIdInput: string, dobInput: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  loginError: string | null;
  setLoginError: (error: string | null) => void;
}

const PatientAuthContext = createContext<PatientAuthContextType | undefined>(undefined);

const PATIENT_AUTH_STORAGE_KEY = 'navael_patient_auth';

export interface PatientAuthStorage {
  patientId: string;
  patientName: string;
}

export function PatientAuthProvider({ children }: { children: ReactNode }) {
  const [patientId, setPatientIdState] = useState<string | null>(null);
  const [patientName, setPatientNameState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginErrorState] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname(); // To help with route protection

  useEffect(() => {
    try {
      const storedAuth = localStorage.getItem(PATIENT_AUTH_STORAGE_KEY);
      if (storedAuth) {
        const { patientId: storedPatientId, patientName: storedPatientName } = JSON.parse(storedAuth) as PatientAuthStorage;
        setPatientIdState(storedPatientId);
        setPatientNameState(storedPatientName);
      }
    } catch (error) {
      console.error("Failed to load patient auth state from localStorage", error);
      localStorage.removeItem(PATIENT_AUTH_STORAGE_KEY);
    }
    setIsLoading(false);
  }, []);

  const setLoginError = (error: string | null) => {
    setLoginErrorState(error);
  };

  const login = useCallback(async (patientIdInput: string, dobInput: string): Promise<boolean> => {
    setLoginError(null);
    setIsLoading(true);

    // Simulate API call by directly checking localStorage for patient data
    // In a real app, this would be a fetch to a backend endpoint.
    try {
      const storedPatients = localStorage.getItem(PATIENT_STORAGE_KEY);
      if (!storedPatients) {
        // This simulates a scenario where the backend has no patient data.
        setLoginError("No patient records found in the system. Please contact support.");
        setIsLoading(false);
        return false;
      }
      const patients: Patient[] = JSON.parse(storedPatients);
      const matchedPatient = patients.find(
        p => p.id?.toLowerCase() === patientIdInput.toLowerCase().trim() && p.dateOfBirth === dobInput.trim()
      );

      if (matchedPatient) {
        if (matchedPatient.status !== "Active") {
          // Simulate an inactive account check
          setLoginError("Your account is not currently active. Please contact the clinic.");
          setIsLoading(false);
          return false;
        }
        
        // FIX START: Construct the 'name' from firstName and lastName
        const patientFullName = `${matchedPatient.firstName} ${matchedPatient.lastName}`;
        const authData: PatientAuthStorage = { patientId: matchedPatient.id, patientName: patientFullName };
        // FIX END
        
        localStorage.setItem(PATIENT_AUTH_STORAGE_KEY, JSON.stringify(authData));
        setPatientIdState(matchedPatient.id);
        setPatientNameState(patientFullName); // Use the constructed full name here
        setIsLoading(false);
        router.push('/patient-portal/dashboard');
        return true;
      } else {
        // Login failed
        setLoginError("Invalid Patient ID or Date of Birth. Please check your details and try again.");
        setIsLoading(false);
        return false;
      }
    } catch (error) {
        console.error("Login error:", error);
        setLoginError("An unexpected error occurred during login. Please try again.");
        setIsLoading(false);
        return false;
    }
  }, [router]);

  const logout = useCallback(() => {
    // Simulate API call for logout if needed, e.g., to invalidate a backend session.
    localStorage.removeItem(PATIENT_AUTH_STORAGE_KEY);
    setPatientIdState(null);
    setPatientNameState(null);
    setLoginError(null);
    router.push('/patient-portal/login');
  }, [router]);

  // Route protection: Redirect to login if not authenticated and trying to access protected portal pages
  useEffect(() => {
    if (!isLoading && !patientId && pathname.startsWith('/patient-portal') && pathname !== '/patient-portal/login') {
      router.replace('/patient-portal/login');
    }
  }, [isLoading, patientId, pathname, router]);


  return (
    <PatientAuthContext.Provider value={{
        isAuthenticated: !!patientId,
        patientId,
        patientName,
        login,
        logout,
        isLoading,
        loginError,
        setLoginError,
    }}>
      {children}
    </PatientAuthContext.Provider>
  );
}

export function usePatientAuth() {
  const context = useContext(PatientAuthContext);
  if (context === undefined) {
    throw new Error('usePatientAuth must be used within a PatientAuthProvider');
  }
  return context;
}

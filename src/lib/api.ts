
// src/lib/api.ts

// Define a base PatientProfile type.
// This should align with what src/app/(portals)/patient/id-card/page.tsx expects.
export interface PatientProfile {
  id: string;
  name: string;
  age: number;
  gender: "Male" | "Female" | "Other" | "Prefer not to say";
  dateOfBirth: string; // ISO string
  contactNumber: string;
  email?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  profilePictureUrl?: string;
  // Add any other fields specifically needed for an ID card that might differ from the main Patient type
}

// Placeholder types for InsurancePlan and ActiveSubscription
// These are also imported by the problematic file.
export interface InsurancePlan {
  id: string;
  name: string;
  planType: string;
  coverageDetails: string;
  memberId?: string;
}


export interface ActiveSubscription {
  planId: string;
  planName: string;
  memberId: string;
  startDate: string; // ISO Date string
  endDate?: string; // ISO Date string
  status: 'Active' | 'Inactive' | 'Cancelled';
}

// Placeholder API functions also imported by the problematic file.
// These would normally fetch data from a backend or service.
export async function fetchPatientProfileApi(patientId: string): Promise<PatientProfile | null> {
  console.warn(`fetchPatientProfileApi called for ${patientId} - using placeholder. Implement actual data fetching.`);
  // This is a placeholder. In a real app, you'd fetch from your backend.
  // For now, to avoid further errors if this function is called, return a mock or null.
  if (typeof window !== 'undefined') {
    const storedPatients = localStorage.getItem('navael_patients');
    if (storedPatients) {
      const patients: PatientProfile[] = JSON.parse(storedPatients); // Assuming PatientProfile has similar base fields
      const patient = patients.find(p => p.id === patientId);
      if (patient) return patient;
    }
  }
  return null;
}

export async function fetchInsurancePlansApi(): Promise<InsurancePlan[]> {
  console.warn("fetchInsurancePlansApi called - using placeholder. Implement actual data fetching.");
  // Placeholder data
  return [
    { id: 'plan1', name: 'Basic Health Plan', planType: 'Individual', coverageDetails: 'Covers basic consultations and lab tests.' },
    { id: 'plan2', name: 'Comprehensive Family Plan', planType: 'Family', coverageDetails: 'Full coverage including specialist visits and hospitalization.' },
  ];
}

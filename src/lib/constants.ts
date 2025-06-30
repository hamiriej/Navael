
export const ROLES = {
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  RECEPTIONIST: "Receptionist",
  PHARMACIST: "Pharmacist",
  LAB_TECH: "Lab Technician", // <--- ENSURE THIS IS PRESENT AND NOT DUPLICATED
} as const;

export type Role = typeof ROLES[keyof typeof ROLES]; // This type automatically updates


export const ALL_ROLES = Object.values(ROLES);

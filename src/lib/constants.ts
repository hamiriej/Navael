export const ROLES = {
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  RECEPTIONIST: "Receptionist",
  PHARMACIST: "Pharmacist",
  LAB_TECH: "Lab Technician",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const ALL_ROLES: Role[] = Object.values(ROLES);
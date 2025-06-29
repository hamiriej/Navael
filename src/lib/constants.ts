
export const ROLES = {
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  LAB_TECH: 'Lab Technician',
  ADMIN: 'Administrator',
  RECEPTIONIST: 'Receptionist',
  PHARMACIST: 'Pharmacist', // Added Pharmacist role
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const ALL_ROLES = Object.values(ROLES);

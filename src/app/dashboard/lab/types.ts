/**
 * Lab test status values.
 */
export type LabTestStatus =
  | "Pending Sample"
  | "Processing"
  | "Results Ready"
  | "Cancelled"
  | "Sample Collected"
  | "Awaiting Verification"
  | "Result Entered"
  | "Pending Result";

/**
 * Lab order status values.
 */
export type LabOrderStatus =
  | "Pending Sample"
  | "Processing"
  | "Results Ready"
  | "Cancelled"
  | "Sample Collected"
  | "Awaiting Verification"
  | "Result Entered"
  | "Pending Result";

/**
 * Payment status for lab orders.
 */
export type LabOrderPaymentStatus =
  | "Paid"
  | "Pending Payment"
  | "Partially Paid"
  | "Billed";

/**
 * Represents a single lab test.
 */
export interface LabTest {
  id?: string; // Optional for new tests
  name: string;
  price?: number;
  status: LabTestStatus;
  result?: string;
  referenceRange?: string;
  unit?: string;
  notes?: string;
}

/**
 * Represents a lab order containing multiple tests.
 */
export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  orderDate: string; // ISO string
  orderingDoctor: string;
  tests: LabTest[];
  status: LabOrderStatus;
  clinicalNotes?: string;
  sampleCollectionDate?: string; // ISO string
  sampleCollector?: string;
  verificationDate?: string; // ISO string
  verifiedBy?: string;
  paymentStatus?: LabOrderPaymentStatus;
  invoiceId?: string;
  linkedConsultationId?: string;
  linkedAppointmentId?: string;
}
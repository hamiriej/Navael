
"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { type LabOrder, type LabTest } from '@/app/dashboard/lab/page';
import { logActivity } from '@/lib/activityLog';
import { useAuth } from './auth-context';
import { format } from 'date-fns';


export { type LabOrder, type LabTest } from '@/app/dashboard/lab/page';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';
const MOCK_API_DELAY = 100;

// Static, minimal mock data for the simulated API layer within the context
// This list is used by fetchLabOrdersFromApi to simulate a general API response.
const staticMockLabOrdersForList: LabOrder[] = [
  {
    id: "LO_CTX_MOCK_001", patientId: "P001", patientName: "John Doe (Context Mock)", orderDate: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
    orderingDoctor: "Dr. Evelyn Reed",
    tests: [
        {id: "TEST_CBC_CTX_001", name: "Complete Blood Count", status: "Results Ready", result: "WBC 7.5, RBC 4.5, HGB 14.0", referenceRange: "WBC 4-11, RBC 4.2-5.4, HGB 13.5-17.5", price: 25},
        {id: "TEST_GLU_CTX_001", name: "Glucose, Fasting", status: "Results Ready", result: "95 mg/dL", referenceRange: "70-99 mg/dL", price: 15}
    ],
    status: "Results Ready", clinicalNotes: "Routine annual check-up.", paymentStatus: "Paid", invoiceId: "INV_CTX_MOCK_001",
    sampleCollectionDate: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
    verificationDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(), verifiedBy: "LabTech AI (Ctx)"
  },
  {
    id: "LO_CTX_MOCK_002", patientId: "P002", patientName: "Alice Smith (Context Mock)", orderDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
    orderingDoctor: "Dr. Ben Carter",
    tests: [{id: "TEST_LIPID_CTX_001", name: "Lipid Panel", status: "Processing", price: 40}],
    status: "Processing", clinicalNotes: "Monitoring cholesterol.", paymentStatus: "Pending Payment", invoiceId: "INV_CTX_MOCK_002",
    sampleCollectionDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString()
  },
];

// This separate minimal list can be used by fetchLabOrderByIdFromApi if direct ID lookup simulation is preferred
// or it can also try to find from staticMockLabOrdersForList. For simplicity, we'll use staticMockLabOrdersForList.
// const minimalStaticMockLabOrdersForById: LabOrder[] = [ /* ... can be a subset or specific cases ... */ ];


interface LabOrderContextType {
  labOrders: LabOrder[];
  isLoadingLabOrders: boolean;
  error: string | null;
  fetchLabOrders: () => Promise<void>;
  fetchLabOrderById: (orderId: string) => Promise<LabOrder | undefined>;
  createLabOrder: (newOrderData: Omit<LabOrder, 'id'>) => Promise<LabOrder>;
  updateLabOrder: (orderId: string, updatedData: Partial<Omit<LabOrder, 'id'>>) => Promise<LabOrder | undefined>;
  fetchLabOrdersForPatient: (patientId: string) => Promise<LabOrder[]>;
}

const LabOrderContext = createContext<LabOrderContextType | undefined>(undefined);

async function fetchLabOrdersFromApi(): Promise<LabOrder[]> {
  console.log(`SIMULATED API CALL: GET ${API_BASE_URL}/lab/orders - returning static mock`);
  await new Promise(resolve => setTimeout(resolve, MOCK_API_DELAY));
  return [...staticMockLabOrdersForList.map(o => ({...o, tests: [...o.tests.map(t => ({...t}))]}) )];
}

async function fetchLabOrderByIdFromApi(orderId: string): Promise<LabOrder | undefined> {
  console.log(`SIMULATED API CALL: GET ${API_BASE_URL}/lab/orders/${orderId} - using static mock`);
  await new Promise(resolve => setTimeout(resolve, MOCK_API_DELAY - 50));
  // Find from the main static list used for general fetching
  const order = staticMockLabOrdersForList.find(o => o.id === orderId);
  return order ? {...order, tests: [...order.tests.map(t => ({...t}))]} : undefined;
}

async function createLabOrderInApi(newOrderData: LabOrder): Promise<LabOrder> {
  console.log(`SIMULATED API CALL: POST ${API_BASE_URL}/lab/orders`, newOrderData);
  await new Promise(resolve => setTimeout(resolve, MOCK_API_DELAY + 50));
  return {...newOrderData, tests: [...newOrderData.tests.map(t => ({...t}))]};
}

async function updateLabOrderInApi(orderId: string, updatedData: Partial<Omit<LabOrder, 'id'>>): Promise<LabOrder> {
  console.log(`SIMULATED API CALL: PATCH ${API_BASE_URL}/lab/orders/${orderId}`, updatedData);
  await new Promise(resolve => setTimeout(resolve, MOCK_API_DELAY + 50));
  
  // Simulate finding and updating in a backend store.
  // For context state management, the actual update will happen in the provider.
  // This function just needs to return the "updated" shape.
  const existingOrderFromStatic = staticMockLabOrdersForList.find(o => o.id === orderId); // Find in static if needed for base
  const baseOrder = existingOrderFromStatic ? { ...existingOrderFromStatic } : { id: orderId } as LabOrder;
  
  const updatedOrder = { ...baseOrder, ...updatedData };

   // Ensure all required fields are present if it was a new object based on existingOrder not found
  if (!existingOrderFromStatic) {
      updatedOrder.patientId = updatedOrder.patientId || "UnknownPID_Updated";
      updatedOrder.patientName = updatedOrder.patientName || "Unknown Patient_Updated";
      updatedOrder.orderingDoctor = updatedOrder.orderingDoctor || "Unknown Doctor_Updated";
      updatedOrder.orderDate = updatedOrder.orderDate || new Date().toISOString();
      updatedOrder.tests = updatedData.tests ? updatedData.tests.map(t => ({...t})) : (baseOrder.tests ? baseOrder.tests.map(t => ({...t})) : []);
      updatedOrder.status = updatedOrder.status || "Pending Sample";
  } else if (updatedData.tests) {
      updatedOrder.tests = updatedData.tests.map(t => ({...t}));
  } else if (baseOrder.tests) { // Ensure tests are copied even if not in updatedData
      updatedOrder.tests = baseOrder.tests.map(t => ({...t}));
  }


  return updatedOrder as LabOrder;
}

async function fetchLabOrdersForPatientFromApi(patientId: string): Promise<LabOrder[]> {
    console.log(`SIMULATED API CALL: GET ${API_BASE_URL}/lab/orders?patientId=${patientId} - using static mock`);
    await new Promise(resolve => setTimeout(resolve, MOCK_API_DELAY - 50));
    return staticMockLabOrdersForList.filter(order => order.patientId === patientId).map(order => ({...order, tests: [...order.tests.map(t => ({...t}))]}));
}

export function LabOrderProvider({ children }: { children: ReactNode }) {
  const [labOrdersState, setLabOrdersState] = useState<LabOrder[]>([]);
  const [isLoadingLabOrdersState, setIsLoadingLabOrdersState] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const { userRole, username } = useAuth();

  const fetchLabOrders = useCallback(async () => {
    setIsLoadingLabOrdersState(true);
    setErrorState(null);
    try {
      const dataFromApi = await fetchLabOrdersFromApi();
      setLabOrdersState(dataFromApi);
    } catch (error: any) {
      console.error("Failed to fetch lab orders:", error);
      setErrorState(error.message || "Failed to fetch lab orders.");
      setLabOrdersState([]);
    } finally {
      setIsLoadingLabOrdersState(false);
    }
  }, []);

  useEffect(() => {
    fetchLabOrders();
  }, [fetchLabOrders]);

  const fetchLabOrderById = useCallback(async (orderId: string): Promise<LabOrder | undefined> => {
    // This primarily serves detail views and doesn't set global loading.
    setErrorState(null);
    try {
      const order = await fetchLabOrderByIdFromApi(orderId);
      return order;
    } catch (error: any) {
      console.error(`Failed to fetch lab order ${orderId}:`, error);
      setErrorState(error.message || `Failed to fetch lab order ${orderId}.`);
      return undefined;
    }
  }, []);

  const createLabOrder = useCallback(async (newOrderData: Omit<LabOrder, 'id'>): Promise<LabOrder> => {
    setIsLoadingLabOrdersState(true); // Potentially set loading for list update
    setErrorState(null);
    const newId = `LO${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
    const newOrderWithId: LabOrder = { ...newOrderData, id: newId, orderDate: newOrderData.orderDate || new Date().toISOString() };
    try {
      const createdOrderFromApi = await createLabOrderInApi(newOrderWithId); // Simulates API call
      // Update local state
      setLabOrdersState(prev => [createdOrderFromApi, ...prev].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));
      logActivity({
        actorRole: userRole || "System", actorName: username || "System",
        actionDescription: `Created Lab Order ${createdOrderFromApi.id} for ${createdOrderFromApi.patientName}`,
        targetEntityType: "Lab Order", targetEntityId: createdOrderFromApi.id, iconName: "FlaskConical",
      });
      return createdOrderFromApi;
    } catch (error: any) {
      setErrorState(error.message || "Failed to create lab order.");
      console.error("Failed to create lab order:", error);
      fetchLabOrders(); // Refetch list on error
      throw error; // Re-throw for component to handle
    } finally {
      setIsLoadingLabOrdersState(false);
    }
  }, [userRole, username, fetchLabOrders]);

  const updateLabOrder = useCallback(async (orderId: string, updatedData: Partial<Omit<LabOrder, 'id'>>): Promise<LabOrder | undefined> => {
    setIsLoadingLabOrdersState(true); // Potentially set loading for list update
    setErrorState(null);
    try {
      const updatedOrderFromApi = await updateLabOrderInApi(orderId, updatedData); // Simulates API call
      // Update local state
      setLabOrdersState(prev => prev.map(o => o.id === orderId ? { ...o, ...updatedOrderFromApi } : o)
                                     .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));
      logActivity({
        actorRole: userRole || "System", actorName: username || "System",
        actionDescription: `Updated Lab Order ${orderId} for ${updatedOrderFromApi.patientName}. New Status: ${updatedOrderFromApi.status}`,
        targetEntityType: "Lab Order", targetEntityId: orderId, iconName: "Edit",
      });
      return updatedOrderFromApi;
    } catch (error: any) {
      setErrorState(error.message || "Failed to update lab order.");
      console.error("Failed to update lab order:", error);
      fetchLabOrders(); // Refetch list on error
      throw error; // Re-throw
    } finally {
      setIsLoadingLabOrdersState(false);
    }
  }, [userRole, username, fetchLabOrders]);

  const fetchLabOrdersForPatient = useCallback(async (patientId: string): Promise<LabOrder[]> => {
    // This serves patient detail views primarily.
    setErrorState(null);
    try {
      const patientOrders = await fetchLabOrdersForPatientFromApi(patientId);
      return patientOrders;
    } catch (error: any) {
      console.error(`Failed to fetch lab orders for patient ${patientId}:`, error);
      setErrorState(error.message || `Failed to fetch lab orders for patient ${patientId}.`);
      return [];
    }
  }, []);

  return (
    <LabOrderContext.Provider value={{
      labOrders: labOrdersState, isLoadingLabOrders: isLoadingLabOrdersState, error: errorState,
      fetchLabOrders, fetchLabOrderById, createLabOrder, updateLabOrder, fetchLabOrdersForPatient,
    }}>
      {children}
    </LabOrderContext.Provider>
  );
}

export function useLabOrders() {
  const context = useContext(LabOrderContext);
  if (context === undefined) {
    throw new Error('useLabOrders must be used within a LabOrderProvider');
  }
  return context;
}
    

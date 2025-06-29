// src/contexts/auth-context.tsx
"use client";

import type { Role } from '@/lib/constants';
import { ROLES, ALL_ROLES } from '@/lib/constants'; // <-- Added ALL_ROLES
import { useRouter, usePathname } from 'next/navigation'; // <-- Added usePathname
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Import Firebase Authentication functions and the 'auth' object
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut, // Renamed to avoid clash with context's logout
  onAuthStateChanged,
  User as FirebaseAuthUser, // Alias to avoid clash with other User types
} from 'firebase/auth';
import { auth as firebaseAuth, db as firestoreDb } from '@/lib/firebase'; // Import auth and db from your firebase init file
import { doc, getDoc } from 'firebase/firestore'; // For fetching user roles from Firestore

// This import seems to be part of your mock system. We'll keep it for now
// but note that real user management will shift to Firestore/Firebase Auth.
import type { MockUser } from '@/app/dashboard/admin/user-management/page';
export const USER_MANAGEMENT_STORAGE_KEY = 'navael_user_management_users';

interface AuthContextType {
  isAuthenticated: boolean;
  userRole: Role | null;
  username: string | null; // This will likely come from user's profile in Firestore
  staffId: string | null; // This will likely come from user's profile in Firestore
  login: (role: Role, email: string, passwordInput: string) => Promise<boolean>; // Changed emailOrUsername to email for Firebase
  logout: () => void;
  isLoading: boolean;
  loginError: string | null;
  setLoginError: (error: string | null) => void;
  // Impersonation functions might need adjustment if users are solely in Firebase Auth
  impersonateLogin: (role: Role, username: string, staffIdToImpersonate: string) => void;
  returnToAdmin: () => void;
  isImpersonating: boolean;
  originalAdminDetails: AuthStorage | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'navael_auth'; // Still useful for storing custom claims/roles locally
const ORIGINAL_ADMIN_AUTH_STORAGE_KEY = 'navael_original_admin_auth';

export interface AuthStorage {
  role: Role;
  username: string; // Firebase Auth 'displayName' or from Firestore profile
  staffId: string | null; // From Firestore profile
  uid: string; // Firebase User ID
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginErrorState] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalAdminDetails, setOriginalAdminDetails] = useState<AuthStorage | null>(null);
  const router = useRouter();
  const pathname = usePathname(); // <-- ADDED: Get current pathname for App Router

  const setLoginError = (error: string | null) => {
    setLoginErrorState(error);
  };

  // --- NEW: Firebase Auth State Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        // User is logged in via Firebase Auth
        // Now, fetch custom claims or user profile from Firestore to get role and other details
        try {
          const userDocRef = doc(firestoreDb, "users", user.uid); // Assuming you have a 'users' collection in Firestore
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const role = userData?.role as Role || null; // Safely access 'role'
            const userDisplayName = userData?.name || userData?.username || user.email; // Safely access properties
            const userStaffId = userData?.staffId || null;

            if (role) {
                // Check if the role fetched matches one of your defined roles
                if (ALL_ROLES.includes(role)) { // <-- FIX: Changed ROLES.includes to ALL_ROLES.includes
                    const authData: AuthStorage = {
                      role: role,
                      username: userDisplayName,
                      staffId: userStaffId,
                      uid: user.uid,
                    };
                    persistAuth(authData); // Persist this complete auth data
                    // If user is already on login page, redirect them to dashboard
                    if (pathname === '/login' || pathname === '/') { // <-- FIX: Changed router.pathname to pathname
                        router.push('/dashboard');
                    }
                } else {
                    // Role not found or invalid, log out to prevent unauthorized access
                    console.error("User has an invalid role in Firestore. Logging out.");
                    await firebaseSignOut(firebaseAuth);
                }
            } else {
                // No role found for the user in Firestore, log them out
                console.warn("No role found for user in Firestore. Logging out.");
                await firebaseSignOut(firebaseAuth); // Log out until profile exists
            }

          } else {
            // User exists in Firebase Auth but no profile in Firestore.
            // This might happen if user was created directly in Firebase Console or before profile was saved.
            console.warn("User profile not found in Firestore. Logging out user.");
            await firebaseSignOut(firebaseAuth); // Log out until profile exists
          }
        } catch (error) {
          console.error("Error fetching user role from Firestore:", error);
          await firebaseSignOut(firebaseAuth); // Log out on error
        } finally {
          setIsLoading(false);
        }
      } else {
        // No user is logged in via Firebase Auth
        clearAuth(); // Clear any persisted data
        setIsLoading(false);
        if (pathname !== '/login' && pathname !== '/login/') { // <-- FIX: Changed router.pathname to pathname, added /login/ to be safe
          router.push('/login'); // Redirect to login page if not authenticated
        }
      }
    });

    // Load impersonation state from localStorage on initial load
    try {
        const storedOriginalAdminAuth = localStorage.getItem(ORIGINAL_ADMIN_AUTH_STORAGE_KEY);
        if (storedOriginalAdminAuth) {
            setOriginalAdminDetails(JSON.parse(storedOriginalAdminAuth));
            setIsImpersonating(true);
        }
    } catch (error) {
        console.error("Failed to load impersonation state from localStorage", error);
        localStorage.removeItem(ORIGINAL_ADMIN_AUTH_STORAGE_KEY);
    }

    return () => unsubscribe(); // Cleanup Firebase listener on unmount
  }, [router, pathname]); // <-- Added pathname to dependency array


  const persistAuth = (authData: AuthStorage) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    setUserRole(authData.role);
    setUsername(authData.username);
    setStaffId(authData.staffId);
    setLoginError(null);
  };

  const clearAuth = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(ORIGINAL_ADMIN_AUTH_STORAGE_KEY); // Clear impersonation data too
    setUserRole(null);
    setUsername(null);
    setStaffId(null);
    setIsImpersonating(false);
    setOriginalAdminDetails(null);
    setLoginError(null);
  };


  // --- MODIFIED: Login function to use Firebase Authentication ---
  const login = useCallback(async (role: Role, email: string, passwordInput: string): Promise<boolean> => {
    setLoginError(null);
    setIsLoading(true);

    try {
      // 1. Authenticate with Firebase Email/Password
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, passwordInput);
      const user = userCredential.user;

      // 2. Fetch user's role and details from Firestore
      const userDocRef = doc(firestoreDb, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await firebaseSignOut(firebaseAuth); // Log out if no user profile
        throw new Error("User profile not found. Please contact administrator.");
      }

      const userData = userDocSnap.data();
      const fetchedRole = userData?.role as Role; // Safely access 'role'
      const fetchedUsername = userData?.name || userData?.username || user.email; // Safely access properties
      const fetchedStaffId = userData?.staffId || null;

      // 3. Verify fetched role matches requested role (optional but good for specific login flows)
      // If the user selects a role on the login screen, you can check if their actual Firestore role matches.
      // If they don't match, you might want to prevent login or redirect them.
      if (!fetchedRole || fetchedRole !== role) {
          await firebaseSignOut(firebaseAuth); // Log out if role mismatch
          throw new Error(`Your actual role (${fetchedRole || 'none'}) does not match the selected role (${role}).`);
      }

      // 4. Persist authentication details and update state (onAuthStateChanged will also trigger this but for initial display)
      const authData: AuthStorage = {
        role: fetchedRole,
        username: fetchedUsername,
        staffId: fetchedStaffId,
        uid: user.uid,
      };
      persistAuth(authData);

      // No explicit router.push here, onAuthStateChanged will handle it
      setIsLoading(false);
      return true;

    } catch (error: any) {
      console.error("Firebase Login failed:", error.message);
      // Map Firebase errors to more user-friendly messages
      let displayMessage = "Login failed. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        displayMessage = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        displayMessage = "Too many login attempts. Please try again later.";
      } else if (error.code === 'auth/user-disabled') {
        displayMessage = "Your account has been disabled. Please contact support.";
      }
      setLoginError(displayMessage);
      setIsLoading(false);
      return false;
    }
  }, []);


  // --- MODIFIED: Logout function to use Firebase Authentication ---
  const logout = useCallback(async () => {
    setLoginError(null);
    setIsLoading(true);
    try {
      await firebaseSignOut(firebaseAuth); // Sign out from Firebase
      clearAuth(); // Clear local state
      // onAuthStateChanged will handle redirect to /login
    } catch (error: any) {
      console.error("Firebase Logout failed:", error.message);
      setLoginError("Logout failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- Impersonation functions (keeping as is for now, but note they operate on local state) ---
  const impersonateLogin = useCallback((roleToImpersonate: Role, usernameToImpersonate: string, staffIdToImpersonate: string) => {
    if (userRole === ROLES.ADMIN && !isImpersonating) {
      // In a real Firebase system, impersonation might involve setting custom claims or using backend
      // functions to generate temporary tokens for the impersonated user's UID.
      // For now, this continues to simulate based on local state.
      const currentAdminDetails: AuthStorage = { role: userRole, username: username || "Admin", staffId: staffId || "ADMIN_USER_001", uid: firebaseAuth.currentUser?.uid || '' }; // Added UID
      localStorage.setItem(ORIGINAL_ADMIN_AUTH_STORAGE_KEY, JSON.stringify(currentAdminDetails));
      setOriginalAdminDetails(currentAdminDetails);

      const impersonatedAuthData: AuthStorage = { role: roleToImpersonate, username: usernameToImpersonate, staffId: staffIdToImpersonate, uid: "simulated-uid" }; // Placeholder UID for impersonation
      persistAuth(impersonatedAuthData);
      setIsImpersonating(true);
      router.push('/dashboard');
    }
  }, [userRole, username, staffId, isImpersonating, router]);

  const returnToAdmin = useCallback(() => {
    if (isImpersonating && originalAdminDetails) {
      persistAuth(originalAdminDetails);
      localStorage.removeItem(ORIGINAL_ADMIN_AUTH_STORAGE_KEY);
      setIsImpersonating(false);
      setOriginalAdminDetails(null);
      router.push('/dashboard/admin/user-management');
    }
  }, [isImpersonating, originalAdminDetails, router]); // <-- This was the missing closing brace's context

  return (
    <AuthContext.Provider value={{
        isAuthenticated: !!userRole,
        userRole,
        login,
        logout,
        isLoading,
        username,
        staffId,
        loginError,
        setLoginError,
        impersonateLogin,
        returnToAdmin,
        isImpersonating,
        originalAdminDetails
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

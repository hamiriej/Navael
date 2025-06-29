
"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const LOGO_DATA_URL_STORAGE_KEY = 'navael_logoDataUrl'; // Changed key name
const LOGO_WIDTH_STORAGE_KEY = 'navael_logoWidth';
const DEFAULT_LOGO_WIDTH = 125; 
const DEFAULT_ICON_WIDTH = 32; 

interface LogoSettings {
  logoDataUrl: string | null; // Changed from logoUrl to logoDataUrl
  logoWidth: number; 
}

interface LogoSettingsContextType extends LogoSettings {
  setLogoDataUrl: (dataUrl: string | null) => void; // Renamed setter
  setLogoWidth: (width: number) => void;
  isLoading: boolean;
}

const LogoSettingsContext = createContext<LogoSettingsContextType | undefined>(undefined);

export function LogoSettingsProvider({ children }: { children: ReactNode }) {
  const [logoDataUrl, setLogoDataUrlState] = useState<string | null>(null); // Changed state variable
  const [logoWidth, setLogoWidthState] = useState<number>(DEFAULT_LOGO_WIDTH);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedDataUrl = localStorage.getItem(LOGO_DATA_URL_STORAGE_KEY); // Use new key
      if (storedDataUrl) {
        setLogoDataUrlState(storedDataUrl === 'null' ? null : storedDataUrl);
      }
      const storedWidth = localStorage.getItem(LOGO_WIDTH_STORAGE_KEY);
      if (storedWidth) {
        setLogoWidthState(parseInt(storedWidth, 10) || DEFAULT_LOGO_WIDTH);
      }
    } catch (error) {
      console.error("Failed to load logo settings from localStorage", error);
    }
    setIsLoading(false);
  }, []);

  const setLogoDataUrl = useCallback((dataUrl: string | null) => { // Renamed function
    setLogoDataUrlState(dataUrl);
    try {
      if (dataUrl === null) {
        localStorage.removeItem(LOGO_DATA_URL_STORAGE_KEY); // Use new key
      } else {
        localStorage.setItem(LOGO_DATA_URL_STORAGE_KEY, dataUrl); // Use new key
      }
    } catch (error) {
      console.error("Failed to save logo data URL to localStorage", error);
      // Potentially notify user if localStorage is full
    }
  }, []);

  const setLogoWidth = useCallback((width: number) => {
    const newWidth = Math.max(30, Math.min(width, 500)); 
    setLogoWidthState(newWidth);
    try {
      localStorage.setItem(LOGO_WIDTH_STORAGE_KEY, newWidth.toString());
    } catch (error) {
      console.error("Failed to save logo width to localStorage", error);
    }
  }, []);

  return (
    <LogoSettingsContext.Provider value={{ logoDataUrl, logoWidth, setLogoDataUrl, setLogoWidth, isLoading }}>
      {children}
    </LogoSettingsContext.Provider>
  );
}

export function useLogoSettings() {
  const context = useContext(LogoSettingsContext);
  if (context === undefined) {
    throw new Error('useLogoSettings must be used within a LogoSettingsProvider');
  }
  return context;
}

export { DEFAULT_LOGO_WIDTH, DEFAULT_ICON_WIDTH };

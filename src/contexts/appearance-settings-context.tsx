
"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Local storage keys
const LOGO_DATA_URL_STORAGE_KEY = 'navael_logoDataUrl';
const LOGO_WIDTH_STORAGE_KEY = 'navael_logoWidth';
const THEME_COLORS_STORAGE_KEY = 'navael_themeColors';
const CURRENCY_STORAGE_KEY = 'navael_currency';
const DEFAULT_APPOINTMENT_DURATION_KEY = 'navael_defaultAppointmentDuration';
const CLINIC_OPERATING_HOURS_START_KEY = 'navael_clinicOperatingHoursStart';
const CLINIC_OPERATING_HOURS_END_KEY = 'navael_clinicOperatingHoursEnd';
const PATIENT_PORTAL_ENABLED_KEY = 'navael_patientPortalEnabled';
const REMINDER_LEAD_TIME_KEY = 'navael_reminderLeadTime';


// Default values
export const DEFAULT_LOGO_WIDTH = 125;
export const DEFAULT_ICON_WIDTH = 32;
export const DEFAULT_THEME_COLORS = {
  background: "0 0% 94.1%", // #F0F0F0 Light Gray
  foreground: "210 10% 23%", // Darker gray for text
  primary: "210 50% 60%", // #6699CC Muted Blue
  accent: "180 33% 59%", // #73B9B9 Soft Teal
};
export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_APPOINTMENT_DURATION = 30; // minutes
export const DEFAULT_CLINIC_START_TIME = "09:00";
export const DEFAULT_CLINIC_END_TIME = "17:00";
export const DEFAULT_PATIENT_PORTAL_ENABLED = true;
export const DEFAULT_REMINDER_LEAD_TIME = 24; // hours


export type CurrencyCode = 'USD' | 'UGX';

interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  accent: string;
}

interface AppearanceSettings {
  logoDataUrl: string | null;
  logoWidth: number;
  themeColors: ThemeColors;
  currency: CurrencyCode;
  defaultAppointmentDuration: number;
  clinicOperatingHoursStart: string;
  clinicOperatingHoursEnd: string;
  patientPortalEnabled: boolean;
  reminderLeadTime: number;
  isLoading: boolean;
}

interface AppearanceSettingsContextType extends AppearanceSettings {
  setLogoDataUrl: (dataUrl: string | null) => Promise<void>;
  setLogoWidth: (width: number) => Promise<void>;
  setThemeColors: (colors: ThemeColors) => Promise<void>;
  resetThemeToDefaults: () => Promise<void>;
  setCurrency: (currency: CurrencyCode) => Promise<void>;
  setDefaultAppointmentDuration: (duration: number) => Promise<void>;
  setClinicOperatingHoursStart: (time: string) => Promise<void>;
  setClinicOperatingHoursEnd: (time: string) => Promise<void>;
  setPatientPortalEnabled: (enabled: boolean) => Promise<void>;
  setReminderLeadTime: (hours: number) => Promise<void>;
}

const AppearanceSettingsContext = createContext<AppearanceSettingsContextType | undefined>(undefined);

// Simulate API delay for setters if we were to move them to API calls
// const simulateApiDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function AppearanceSettingsProvider({ children }: { children: ReactNode }) {
  const [logoDataUrl, setLogoDataUrlState] = useState<string | null>(null);
  const [logoWidth, setLogoWidthState] = useState<number>(DEFAULT_LOGO_WIDTH);
  const [themeColors, setThemeColorsState] = useState<ThemeColors>(DEFAULT_THEME_COLORS);
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [defaultAppointmentDuration, setDefaultAppointmentDurationState] = useState<number>(DEFAULT_APPOINTMENT_DURATION);
  const [clinicOperatingHoursStart, setClinicOperatingHoursStartState] = useState<string>(DEFAULT_CLINIC_START_TIME);
  const [clinicOperatingHoursEnd, setClinicOperatingHoursEndState] = useState<string>(DEFAULT_CLINIC_END_TIME);
  const [patientPortalEnabled, setPatientPortalEnabledState] = useState<boolean>(DEFAULT_PATIENT_PORTAL_ENABLED);
  const [reminderLeadTime, setReminderLeadTimeState] = useState<number>(DEFAULT_REMINDER_LEAD_TIME);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedDataUrl = localStorage.getItem(LOGO_DATA_URL_STORAGE_KEY);
      setLogoDataUrlState(storedDataUrl === 'null' ? null : storedDataUrl || null);

      const storedWidth = localStorage.getItem(LOGO_WIDTH_STORAGE_KEY);
      setLogoWidthState(storedWidth ? (parseInt(storedWidth, 10) || DEFAULT_LOGO_WIDTH) : DEFAULT_LOGO_WIDTH);

      const storedThemeColors = localStorage.getItem(THEME_COLORS_STORAGE_KEY);
      setThemeColorsState(storedThemeColors ? JSON.parse(storedThemeColors) : DEFAULT_THEME_COLORS);

      const storedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY) as CurrencyCode | null;
      setCurrencyState(storedCurrency || DEFAULT_CURRENCY);

      const storedDuration = localStorage.getItem(DEFAULT_APPOINTMENT_DURATION_KEY);
      setDefaultAppointmentDurationState(storedDuration ? (parseInt(storedDuration, 10) || DEFAULT_APPOINTMENT_DURATION) : DEFAULT_APPOINTMENT_DURATION);

      const storedStartTime = localStorage.getItem(CLINIC_OPERATING_HOURS_START_KEY);
      setClinicOperatingHoursStartState(storedStartTime || DEFAULT_CLINIC_START_TIME);

      const storedEndTime = localStorage.getItem(CLINIC_OPERATING_HOURS_END_KEY);
      setClinicOperatingHoursEndState(storedEndTime || DEFAULT_CLINIC_END_TIME);

      const storedPortalEnabled = localStorage.getItem(PATIENT_PORTAL_ENABLED_KEY);
      setPatientPortalEnabledState(storedPortalEnabled ? JSON.parse(storedPortalEnabled) : DEFAULT_PATIENT_PORTAL_ENABLED);

      const storedLeadTime = localStorage.getItem(REMINDER_LEAD_TIME_KEY);
      setReminderLeadTimeState(storedLeadTime ? (parseInt(storedLeadTime, 10) || DEFAULT_REMINDER_LEAD_TIME) : DEFAULT_REMINDER_LEAD_TIME);

    } catch (error) {
      console.error("Failed to load appearance settings from localStorage", error);
      // Fallback to defaults if loading fails
      setLogoDataUrlState(null);
      setLogoWidthState(DEFAULT_LOGO_WIDTH);
      setThemeColorsState(DEFAULT_THEME_COLORS);
      setCurrencyState(DEFAULT_CURRENCY);
      setDefaultAppointmentDurationState(DEFAULT_APPOINTMENT_DURATION);
      setClinicOperatingHoursStartState(DEFAULT_CLINIC_START_TIME);
      setClinicOperatingHoursEndState(DEFAULT_CLINIC_END_TIME);
      setPatientPortalEnabledState(DEFAULT_PATIENT_PORTAL_ENABLED);
      setReminderLeadTimeState(DEFAULT_REMINDER_LEAD_TIME);
    }
    setIsLoading(false);
  }, []);

  // useEffect to listen for storage changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LOGO_DATA_URL_STORAGE_KEY) {
        setLogoDataUrlState(event.newValue === 'null' ? null : event.newValue || null);
      } else if (event.key === LOGO_WIDTH_STORAGE_KEY) {
        setLogoWidthState(event.newValue ? (parseInt(event.newValue, 10) || DEFAULT_LOGO_WIDTH) : DEFAULT_LOGO_WIDTH);
      } else if (event.key === THEME_COLORS_STORAGE_KEY) {
        try { setThemeColorsState(event.newValue ? JSON.parse(event.newValue) : DEFAULT_THEME_COLORS); }
        catch (e) { console.error("Error parsing theme colors from storage event", e); setThemeColorsState(DEFAULT_THEME_COLORS); }
      } else if (event.key === CURRENCY_STORAGE_KEY) {
        setCurrencyState((event.newValue as CurrencyCode) || DEFAULT_CURRENCY);
      } else if (event.key === DEFAULT_APPOINTMENT_DURATION_KEY) {
        setDefaultAppointmentDurationState(event.newValue ? (parseInt(event.newValue, 10) || DEFAULT_APPOINTMENT_DURATION) : DEFAULT_APPOINTMENT_DURATION);
      } else if (event.key === CLINIC_OPERATING_HOURS_START_KEY) {
        setClinicOperatingHoursStartState(event.newValue || DEFAULT_CLINIC_START_TIME);
      } else if (event.key === CLINIC_OPERATING_HOURS_END_KEY) {
        setClinicOperatingHoursEndState(event.newValue || DEFAULT_CLINIC_END_TIME);
      } else if (event.key === PATIENT_PORTAL_ENABLED_KEY) {
        try { setPatientPortalEnabledState(event.newValue ? JSON.parse(event.newValue) : DEFAULT_PATIENT_PORTAL_ENABLED); }
        catch (e) { console.error("Error parsing portal enabled from storage", e); setPatientPortalEnabledState(DEFAULT_PATIENT_PORTAL_ENABLED); }
      } else if (event.key === REMINDER_LEAD_TIME_KEY) {
        setReminderLeadTimeState(event.newValue ? (parseInt(event.newValue, 10) || DEFAULT_REMINDER_LEAD_TIME) : DEFAULT_REMINDER_LEAD_TIME);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => { window.removeEventListener('storage', handleStorageChange); };
  }, []);


  const setLogoDataUrl = useCallback(async (dataUrl: string | null) => {
    // console.log("API_CALL_PLACEHOLDER: Saving logoDataUrl..."); // Kept for info, but it's local
    // await simulateApiDelay(300); // No delay for localStorage
    setLogoDataUrlState(dataUrl);
    try { localStorage.setItem(LOGO_DATA_URL_STORAGE_KEY, dataUrl === null ? 'null' : dataUrl); }
    catch (error) { console.error("Failed to save logo data URL", error); throw error; }
  }, []);

  const setLogoWidth = useCallback(async (width: number) => {
    const newWidth = Math.max(30, Math.min(width, 500));
    setLogoWidthState(newWidth);
    try { localStorage.setItem(LOGO_WIDTH_STORAGE_KEY, newWidth.toString()); }
    catch (error) { console.error("Failed to save logo width", error); throw error; }
  }, []);

  const setThemeColors = useCallback(async (colors: ThemeColors) => {
    setThemeColorsState(colors);
    try { localStorage.setItem(THEME_COLORS_STORAGE_KEY, JSON.stringify(colors)); }
    catch (error) { console.error("Failed to save theme colors", error); throw error; }
  }, []);

  const resetThemeToDefaults = useCallback(async () => {
    setThemeColorsState(DEFAULT_THEME_COLORS);
    try { localStorage.setItem(THEME_COLORS_STORAGE_KEY, JSON.stringify(DEFAULT_THEME_COLORS)); }
    catch (error) { console.error("Failed to save default theme colors", error); throw error; }
  }, []);

  const setCurrency = useCallback(async (newCurrency: CurrencyCode) => {
    setCurrencyState(newCurrency);
    try { localStorage.setItem(CURRENCY_STORAGE_KEY, newCurrency); }
    catch (error) { console.error("Failed to save currency", error); throw error; }
  }, []);

  const setDefaultAppointmentDuration = useCallback(async (duration: number) => {
    setDefaultAppointmentDurationState(duration);
    try { localStorage.setItem(DEFAULT_APPOINTMENT_DURATION_KEY, duration.toString()); }
    catch (error) { console.error("Failed to save appt duration", error); throw error; }
  }, []);

  const setClinicOperatingHoursStart = useCallback(async (time: string) => {
    setClinicOperatingHoursStartState(time);
    try { localStorage.setItem(CLINIC_OPERATING_HOURS_START_KEY, time); }
    catch (error) { console.error("Failed to save clinic start time", error); throw error; }
  }, []);

  const setClinicOperatingHoursEnd = useCallback(async (time: string) => {
    setClinicOperatingHoursEndState(time);
    try { localStorage.setItem(CLINIC_OPERATING_HOURS_END_KEY, time); }
    catch (error) { console.error("Failed to save clinic end time", error); throw error; }
  }, []);

  const setPatientPortalEnabled = useCallback(async (enabled: boolean) => {
    setPatientPortalEnabledState(enabled);
    try { localStorage.setItem(PATIENT_PORTAL_ENABLED_KEY, JSON.stringify(enabled)); }
    catch (error) { console.error("Failed to save portal enabled status", error); throw error; }
  }, []);

  const setReminderLeadTime = useCallback(async (hours: number) => {
    setReminderLeadTimeState(hours);
    try { localStorage.setItem(REMINDER_LEAD_TIME_KEY, hours.toString()); }
    catch (error) { console.error("Failed to save reminder lead time", error); throw error; }
  }, []);

  return (
    <AppearanceSettingsContext.Provider value={{
      logoDataUrl,
      logoWidth,
      themeColors,
      setThemeColors,
      setLogoDataUrl,
      setLogoWidth,
      isLoading,
      resetThemeToDefaults,
      currency,
      setCurrency,
      defaultAppointmentDuration,
      setDefaultAppointmentDuration,
      clinicOperatingHoursStart,
      setClinicOperatingHoursStart,
      clinicOperatingHoursEnd,
      setClinicOperatingHoursEnd,
      patientPortalEnabled,
      setPatientPortalEnabled,
      reminderLeadTime,
      setReminderLeadTime,
    }}>
      {children}
    </AppearanceSettingsContext.Provider>
  );
}

export function useAppearanceSettings() {
  const context = useContext(AppearanceSettingsContext);
  if (context === undefined) {
    throw new Error('useAppearanceSettings must be used within an AppearanceSettingsProvider');
  }
  return context;
}
    
    
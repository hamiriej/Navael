
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, ArrowLeft, Image as ImageIcon, Palette, Trash2, Scale, RotateCcw, UploadCloud, Save, Loader2, DollarSign, Clock, Users, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAppearanceSettings, DEFAULT_LOGO_WIDTH, DEFAULT_THEME_COLORS, DEFAULT_CURRENCY, type CurrencyCode, DEFAULT_APPOINTMENT_DURATION, DEFAULT_CLINIC_START_TIME, DEFAULT_CLINIC_END_TIME, DEFAULT_PATIENT_PORTAL_ENABLED, DEFAULT_REMINDER_LEAD_TIME } from "@/contexts/appearance-settings-context";
import { Logo } from "@/components/shared/logo";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import React, { useState, useEffect as ReactUseEffect } from "react"; // Aliased useEffect to avoid conflict with component's own state
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const themeSettingsSchema = z.object({
  background: z.string().regex(/^\d{1,3}\s\d{1,3}%\s\d{1,3}%$/, "Invalid HSL format (e.g., 0 0% 100%)"),
  foreground: z.string().regex(/^\d{1,3}\s\d{1,3}%\s\d{1,3}%$/, "Invalid HSL format"),
  primary: z.string().regex(/^\d{1,3}\s\d{1,3}%\s\d{1,3}%$/, "Invalid HSL format"),
  accent: z.string().regex(/^\d{1,3}\s\d{1,3}%\s\d{1,3}%$/, "Invalid HSL format"),
});
type ThemeSettingsFormValues = z.infer<typeof themeSettingsSchema>;

const currencySettingsSchema = z.object({
  currency: z.enum(['USD', 'UGX']),
});
type CurrencySettingsFormValues = z.infer<typeof currencySettingsSchema>;

const operationalSettingsSchema = z.object({
    defaultAppointmentDuration: z.coerce.number().min(5, "Must be at least 5 minutes").max(240, "Cannot exceed 240 minutes"),
    clinicOperatingHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
    clinicOperatingHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
    patientPortalEnabled: z.boolean(),
    reminderLeadTime: z.coerce.number().min(1, "Must be at least 1 hour").max(168, "Cannot exceed 168 hours (1 week)"),
});
type OperationalSettingsFormValues = z.infer<typeof operationalSettingsSchema>;


export default function SystemSettingsPage() {
  const router = useRouter();
  const {
    logoDataUrl, setLogoDataUrl, logoWidth, setLogoWidth,
    themeColors, setThemeColors, resetThemeToDefaults,
    currency, setCurrency,
    defaultAppointmentDuration, setDefaultAppointmentDuration,
    clinicOperatingHoursStart, setClinicOperatingHoursStart,
    clinicOperatingHoursEnd, setClinicOperatingHoursEnd,
    patientPortalEnabled, setPatientPortalEnabled,
    reminderLeadTime, setReminderLeadTime,
    isLoading
  } = useAppearanceSettings();
  const { toast } = useToast();
  const [fileError, setFileError] = useState<string | null>(null);
  
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);
  const [isSavingOperational, setIsSavingOperational] = useState(false);


  const themeForm = useForm<ThemeSettingsFormValues>({
    resolver: zodResolver(themeSettingsSchema),
    defaultValues: isLoading ? DEFAULT_THEME_COLORS : themeColors,
  });

  const currencyForm = useForm<CurrencySettingsFormValues>({
    resolver: zodResolver(currencySettingsSchema),
    defaultValues: { currency: isLoading ? DEFAULT_CURRENCY : currency },
  });

  const operationalSettingsForm = useForm<OperationalSettingsFormValues>({
    resolver: zodResolver(operationalSettingsSchema),
    defaultValues: isLoading ? {
        defaultAppointmentDuration: DEFAULT_APPOINTMENT_DURATION,
        clinicOperatingHoursStart: DEFAULT_CLINIC_START_TIME,
        clinicOperatingHoursEnd: DEFAULT_CLINIC_END_TIME,
        patientPortalEnabled: DEFAULT_PATIENT_PORTAL_ENABLED,
        reminderLeadTime: DEFAULT_REMINDER_LEAD_TIME,
    } : {
        defaultAppointmentDuration,
        clinicOperatingHoursStart,
        clinicOperatingHoursEnd,
        patientPortalEnabled,
        reminderLeadTime,
    }
  });


  ReactUseEffect(() => {
    if (!isLoading) {
        themeForm.reset(themeColors);
        currencyForm.reset({ currency });
        operationalSettingsForm.reset({
            defaultAppointmentDuration,
            clinicOperatingHoursStart,
            clinicOperatingHoursEnd,
            patientPortalEnabled,
            reminderLeadTime,
        });
    }
  }, [
    themeColors, currency, defaultAppointmentDuration, clinicOperatingHoursStart, clinicOperatingHoursEnd, patientPortalEnabled, reminderLeadTime,
    themeForm, currencyForm, operationalSettingsForm, isLoading
  ]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setIsSavingLogo(true);
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // Max 2MB
        setFileError("File is too large. Maximum size is 2MB.");
        toast({ title: "Upload Error", description: "File is too large (max 2MB).", variant: "destructive"});
        event.target.value = "";
        setIsSavingLogo(false);
        return;
      }
      if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/gif'].includes(file.type)) {
        setFileError("Invalid file type. Please upload a PNG, JPG, SVG, or GIF.");
        toast({ title: "Upload Error", description: "Invalid file type.", variant: "destructive"});
        event.target.value = "";
        setIsSavingLogo(false);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          await setLogoDataUrl(reader.result as string);
          toast({ title: "Logo Uploaded & Saved", description: "New logo has been applied and saved." });
        } catch (e) {
          toast({ title: "Save Error", description: "Could not save new logo.", variant: "destructive"});
        } finally {
          setIsSavingLogo(false);
        }
      };
      reader.onerror = () => {
        setFileError("Failed to read file.");
        toast({ title: "Upload Error", description: "Could not read the selected file.", variant: "destructive"});
        setIsSavingLogo(false);
      };
      reader.readAsDataURL(file);
    } else {
      setIsSavingLogo(false);
    }
    event.target.value = ""; // Clear file input
  };

  const handleWidthChange = (value: number[]) => {
    // Local update is instant via context, "Save" button triggers persistent save
     setLogoWidth(value[0]); // Directly call the state setter for immediate UI feedback
  };

  const handleSaveLogoSettings = async () => {
    setIsSavingLogo(true);
    try {
      // Logo data URL is already saved on file change. Here we save width.
      await setLogoWidth(logoWidth);
      toast({ title: "Logo Settings Applied", description: "Logo width has been saved." });
    } catch (e) {
      toast({ title: "Save Error", description: "Could not save logo width.", variant: "destructive"});
    } finally {
      setIsSavingLogo(false);
    }
  };

  const handleResetLogoToDefault = async () => {
    setIsSavingLogo(true);
    try {
      await setLogoDataUrl(null);
      await setLogoWidth(DEFAULT_LOGO_WIDTH);
      toast({ title: "Logo Reset", description: "Logo settings have been reset to default and saved." });
    } catch (e) {
      toast({ title: "Reset Error", description: "Could not reset logo settings.", variant: "destructive"});
    } finally {
      setIsSavingLogo(false);
    }
  };

  const onThemeSubmit = async (data: ThemeSettingsFormValues) => {
    setIsSavingTheme(true);
    try {
        await setThemeColors(data);
        toast({ title: "Theme Settings Applied", description: "Theme colors have been updated and saved." });
    } catch (e) {
        toast({ title: "Save Error", description: "Could not save theme settings.", variant: "destructive"});
    } finally {
        setIsSavingTheme(false);
    }
  };

  const handleResetTheme = async () => {
    setIsSavingTheme(true);
    try {
        await resetThemeToDefaults();
        toast({ title: "Theme Reset", description: "Theme colors have been reset to defaults and saved." });
    } catch (e) {
        toast({ title: "Reset Error", description: "Could not reset theme settings.", variant: "destructive"});
    } finally {
        setIsSavingTheme(false);
    }
  };

  const onCurrencySubmit = async (data: CurrencySettingsFormValues) => {
    setIsSavingCurrency(true);
    try {
        await setCurrency(data.currency as CurrencyCode);
        toast({ title: "Currency Setting Applied", description: `Currency has been set to ${data.currency} and saved.` });
    } catch (e) {
        toast({ title: "Save Error", description: "Could not save currency setting.", variant: "destructive"});
    } finally {
        setIsSavingCurrency(false);
    }
  };

  const onOperationalSettingsSubmit = async (data: OperationalSettingsFormValues) => {
    setIsSavingOperational(true);
    try {
        await setDefaultAppointmentDuration(data.defaultAppointmentDuration);
        await setClinicOperatingHoursStart(data.clinicOperatingHoursStart);
        await setClinicOperatingHoursEnd(data.clinicOperatingHoursEnd);
        await setPatientPortalEnabled(data.patientPortalEnabled);
        await setReminderLeadTime(data.reminderLeadTime);
        toast({ title: "Operational Settings Applied", description: "System operational settings have been updated and saved." });
    } catch (e) {
        toast({ title: "Save Error", description: "Could not save operational settings.", variant: "destructive"});
    } finally {
        setIsSavingOperational(false);
    }
  };

  if (isLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Loading system settings...</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <Settings className="mr-3 h-8 w-8 text-primary" /> System Settings
          </h1>
          <p className="text-muted-foreground">Configure global application settings and parameters.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin Panel
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><ImageIcon className="mr-2 h-5 w-5 text-primary" />Logo Configuration</CardTitle>
          <CardDescription>
            Customize the application logo. Uploaded logo is saved immediately. Width changes require hitting "Apply & Save Logo".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <>
              <div className="space-y-2">
                <Label htmlFor="logoFile">Upload Logo Image (PNG, JPG, SVG, GIF - Max 2MB)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="logoFile"
                    type="file"
                    accept="image/png, image/jpeg, image/svg+xml, image/gif"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary/10 file:text-primary
                      hover:file:bg-primary/20"
                    disabled={isSavingLogo}
                  />
                  {logoDataUrl && (
                    <Button variant="ghost" size="icon" onClick={async () => { setIsSavingLogo(true); await setLogoDataUrl(null); setIsSavingLogo(false);}} title="Clear custom logo and use default" disabled={isSavingLogo}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                {fileError && <p className="text-xs text-destructive">{fileError}</p>}
                <p className="text-xs text-muted-foreground">Clear the uploaded logo to use the default Navael logo.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoWidth">Logo Width (Full Logo): {logoWidth}px</Label>
                <Slider
                  id="logoWidth"
                  min={50}
                  max={300}
                  step={5}
                  value={[logoWidth]}
                  onValueChange={handleWidthChange} // Local update is instant
                  disabled={isSavingLogo}
                />
                <p className="text-xs text-muted-foreground">Adjust the width of the full logo. The icon-only version has a fixed size.</p>
              </div>

              <Separator />

              <div>
                <h3 className="text-md font-semibold mb-2">Live Preview:</h3>
                <div className="p-4 border rounded-md bg-muted/30 flex items-center justify-center min-h-[100px]">
                  <Logo />
                </div>
                <div className="p-4 mt-2 border rounded-md bg-muted/30 flex items-center justify-center min-h-[60px]">
                  <p className="text-xs text-muted-foreground mr-2">Icon Only:</p>
                  <Logo iconOnly />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleResetLogoToDefault} disabled={isSavingLogo}>
                  {isSavingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />} Reset Logo
                </Button>
                 <Button onClick={handleSaveLogoSettings} disabled={isSavingLogo}>
                  {isSavingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                  Apply & Save Logo Width
                </Button>
              </div>
            </>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><Palette className="mr-2 h-5 w-5 text-primary"/>Theme Customization</CardTitle>
          <CardDescription>
            Adjust the application's color scheme using HSL values. Changes apply live once saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...themeForm}>
              <form onSubmit={themeForm.handleSubmit(onThemeSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={themeForm.control} name="background" render={({ field }) => (
                      <FormItem> <FormLabel>Background Color (HSL: <code className="text-xs">H S% L%</code>)</FormLabel> <FormControl><Input {...field} placeholder="e.g., 0 0% 95%" /></FormControl> <FormMessage /> </FormItem>
                  )} />
                  <FormField control={themeForm.control} name="foreground" render={({ field }) => (
                      <FormItem> <FormLabel>Foreground Text Color (HSL)</FormLabel> <FormControl><Input {...field} placeholder="e.g., 210 10% 23%" /></FormControl> <FormMessage /> </FormItem>
                  )} />
                  <FormField control={themeForm.control} name="primary" render={({ field }) => (
                      <FormItem> <FormLabel>Primary Color (HSL)</FormLabel> <FormControl><Input {...field} placeholder="e.g., 210 50% 60%" /></FormControl> <FormMessage /> </FormItem>
                  )} />
                  <FormField control={themeForm.control} name="accent" render={({ field }) => (
                      <FormItem> <FormLabel>Accent Color (HSL)</FormLabel> <FormControl><Input {...field} placeholder="e.g., 180 33% 59%" /></FormControl> <FormMessage /> </FormItem>
                  )} />
                </div>
                 <div className="text-xs text-muted-foreground">
                    <p>Use HSL (Hue Saturation Lightness) values. E.g., for a light gray background: <code>0 0% 95%</code>.</p>
                 </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={handleResetTheme} disabled={isSavingTheme}>
                        {isSavingTheme ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />} Reset Theme
                    </Button>
                    <Button type="submit" disabled={isSavingTheme}>
                        {isSavingTheme ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Apply & Save Theme
                    </Button>
                </div>
              </form>
            </Form>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><DollarSign className="mr-2 h-5 w-5 text-primary"/>Currency Settings</CardTitle>
          <CardDescription>Select the currency for monetary values throughout the application.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...currencyForm}>
              <form onSubmit={currencyForm.handleSubmit(onCurrencySubmit)} className="space-y-6">
                <FormField control={currencyForm.control} name="currency" render={({ field }) => (
                    <FormItem> <FormLabel>Application Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="w-full md:w-[280px]"><SelectValue placeholder="Select currency" /></SelectTrigger></FormControl>
                      <SelectContent> <SelectItem value="USD">USD ($) - United States Dollar</SelectItem> <SelectItem value="UGX">UGX - Ugandan Shilling</SelectItem> </SelectContent>
                      </Select>
                      <FormDescription>This setting affects how monetary values are displayed.</FormDescription> <FormMessage />
                    </FormItem>
                )} />
                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isSavingCurrency}>
                         {isSavingCurrency ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Apply & Save Currency
                    </Button>
                </div>
              </form>
            </Form>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><Settings className="mr-2 h-5 w-5 text-primary"/>Operational Settings</CardTitle>
          <CardDescription>Configure operational parameters for the clinic.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...operationalSettingsForm}>
              <form onSubmit={operationalSettingsForm.handleSubmit(onOperationalSettingsSubmit)} className="space-y-6">
                <FormField control={operationalSettingsForm.control} name="defaultAppointmentDuration" render={({ field }) => (
                        <FormItem> <FormLabel className="flex items-center"><Clock className="mr-2 h-4 w-4"/>Default Appointment Duration (minutes)</FormLabel> <FormControl><Input type="number" {...field} placeholder="e.g., 30" /></FormControl> <FormDescription>Set the standard length for new appointments.</FormDescription> <FormMessage /> </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={operationalSettingsForm.control} name="clinicOperatingHoursStart" render={({ field }) => (
                            <FormItem> <FormLabel className="flex items-center"><Clock className="mr-2 h-4 w-4"/>Clinic Start Time</FormLabel> <FormControl><Input type="time" {...field} /></FormControl> <FormDescription>Official clinic opening time.</FormDescription> <FormMessage /> </FormItem>
                    )} />
                    <FormField control={operationalSettingsForm.control} name="clinicOperatingHoursEnd" render={({ field }) => (
                            <FormItem> <FormLabel className="flex items-center"><Clock className="mr-2 h-4 w-4"/>Clinic End Time</FormLabel> <FormControl><Input type="time" {...field} /></FormControl> <FormDescription>Official clinic closing time.</FormDescription> <FormMessage /> </FormItem>
                    )} />
                </div>
                 <FormField control={operationalSettingsForm.control} name="reminderLeadTime" render={({ field }) => (
                        <FormItem> <FormLabel className="flex items-center"><Clock className="mr-2 h-4 w-4"/>Automated Reminder Lead Time (hours)</FormLabel> <FormControl><Input type="number" {...field} placeholder="e.g., 24" /></FormControl> <FormDescription>Hours before appointment for automated reminders.</FormDescription> <FormMessage /> </FormItem>
                )} />
                <FormField control={operationalSettingsForm.control} name="patientPortalEnabled" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5"> <FormLabel className="text-base flex items-center"><Tv className="mr-2 h-5 w-5"/>Patient Portal Access</FormLabel> <FormDescription>Enable or disable the patient portal system-wide.</FormDescription> </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                )} />
                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isSavingOperational}>
                         {isSavingOperational ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Apply & Save Operational Settings
                    </Button>
                </div>
              </form>
            </Form>
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserCog, Lock, Bell, Loader2, ArrowLeft, Save } from "lucide-react"; // Added Save
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react"; // Added useEffect
import { useRouter } from "next/navigation";
import { logActivity } from "@/lib/activityLog"; // Import logActivity

// Define storage keys for notification preferences
const NOTIFY_APPOINTMENT_EMAIL_KEY = 'navael_notify_appointment_email';
const NOTIFY_LAB_RESULTS_APP_KEY = 'navael_notify_lab_results_app';
const NOTIFY_APPOINTMENT_SMS_KEY = 'navael_notify_appointment_sms';


const profileSettingsSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "New password must be at least 6 characters if provided.").optional().or(z.literal('')),
  confirmNewPassword: z.string().optional().or(z.literal('')),
  notifyAppointmentEmail: z.boolean().optional(),
  notifyLabResultsApp: z.boolean().optional(),
  notifyAppointmentSMS: z.boolean().optional(),
}).refine(data => {
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  message: "Current password is required to set a new password",
  path: ["currentPassword"],
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "New passwords do not match",
  path: ["confirmNewPassword"],
});

type ProfileSettingsFormValues = z.infer<typeof profileSettingsSchema>;

export default function ProfileSettingsPage() {
  const { username: currentUsername, userRole, staffId } = useAuth(); 
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProfileSettingsFormValues>({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: {
      username: currentUsername || "",
      email: currentUsername ? `${currentUsername.toLowerCase().replace(/\s+/g, '.')}@navael.health` : "user@example.com",
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
      notifyAppointmentEmail: true,
      notifyLabResultsApp: true,
      notifyAppointmentSMS: false,
    },
  });

  // Load notification preferences from localStorage on mount
  useEffect(() => {
    try {
      const emailPref = localStorage.getItem(NOTIFY_APPOINTMENT_EMAIL_KEY);
      const appPref = localStorage.getItem(NOTIFY_LAB_RESULTS_APP_KEY);
      const smsPref = localStorage.getItem(NOTIFY_APPOINTMENT_SMS_KEY);

      form.setValue('notifyAppointmentEmail', emailPref !== null ? JSON.parse(emailPref) : true);
      form.setValue('notifyLabResultsApp', appPref !== null ? JSON.parse(appPref) : true);
      form.setValue('notifyAppointmentSMS', smsPref !== null ? JSON.parse(smsPref) : false);
    } catch (e) {
        console.error("Error loading notification preferences from localStorage", e);
    }
  }, [form]);


  const onSubmit = async (values: ProfileSettingsFormValues) => {
    setIsSubmitting(true);
    
    let updateDescription = "Profile settings updated.";
    if (values.newPassword && values.currentPassword) {
      // API_CALL_PLACEHOLDER: Call API to change password
      // For prototype: Assume currentPassword is correct if newPassword is provided
      console.log("API_CALL_PLACEHOLDER: Attempting to change password for", values.username);
      await new Promise(resolve => setTimeout(resolve, 700)); // Simulate API delay
      updateDescription += " Password changed successfully.";
      form.resetField("currentPassword");
      form.resetField("newPassword");
      form.resetField("confirmNewPassword");
    } else {
      // API_CALL_PLACEHOLDER: Call API to update other profile details (e.g., username if allowed)
      console.log("API_CALL_PLACEHOLDER: Updating profile for", values.username);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Save notification preferences to localStorage
    try {
        localStorage.setItem(NOTIFY_APPOINTMENT_EMAIL_KEY, JSON.stringify(!!values.notifyAppointmentEmail));
        localStorage.setItem(NOTIFY_LAB_RESULTS_APP_KEY, JSON.stringify(!!values.notifyLabResultsApp));
        localStorage.setItem(NOTIFY_APPOINTMENT_SMS_KEY, JSON.stringify(!!values.notifyAppointmentSMS));
        updateDescription += " Notification preferences saved."
    } catch (e) {
        console.error("Error saving notification preferences to localStorage", e);
        toast({ title: "Preference Save Error", description: "Could not save notification preferences to local storage.", variant: "destructive"});
    }
    
    logActivity({
        actorRole: userRole || "User",
        actorName: currentUsername || "User",
        actionDescription: updateDescription,
        targetEntityType: "User Profile",
        targetEntityId: staffId || values.username, // Use staffId if available
        iconName: "UserCog"
    });

    toast({
      title: "Profile Updated",
      description: updateDescription,
    });
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
            <Button variant="outline" size="icon" className="mr-4" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
            </Button>
            <div>
                <h1 className="text-3xl font-headline font-bold flex items-center">
                    <UserCog className="mr-3 h-8 w-8 text-primary" /> Profile Settings
                </h1>
                <p className="text-muted-foreground">Manage your account details and preferences.</p>
            </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="font-headline text-xl">Personal Information</CardTitle>
              <CardDescription>Update your username and email address.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} disabled  /></FormControl>
                    <FormDescription>Your email address is used for login and cannot be changed here.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="font-headline text-xl flex items-center"><Lock className="mr-2 h-5 w-5"/>Change Password</CardTitle>
              <CardDescription>Update your login password. Leave new password fields blank to keep current password.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl><Input type="password" {...field} placeholder="Enter your current password" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl><Input type="password" {...field} placeholder="Enter a new password (min. 6 characters)" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmNewPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl><Input type="password" {...field} placeholder="Confirm your new password" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="font-headline text-xl flex items-center"><Bell className="mr-2 h-5 w-5"/>Notification Preferences</CardTitle>
              <CardDescription>Manage how you receive notifications from the system. Changes are saved to local browser storage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <FormField
                    control={form.control}
                    name="notifyAppointmentEmail"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">Email Notifications</FormLabel>
                                <FormDescription>Receive email updates for new appointments and significant changes.</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="notifyLabResultsApp"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">In-App Alerts</FormLabel>
                                <FormDescription>Get in-app notifications for critical lab results and urgent matters.</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="notifyAppointmentSMS"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">SMS Reminders</FormLabel>
                                <FormDescription>Receive SMS reminders for upcoming appointments (if enabled by admin).</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )}
                />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save All Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

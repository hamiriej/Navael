
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, KeyRound, Save, ShieldCheck, AlertTriangle, ArrowLeft, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/contexts/auth-context";

// Removing these as API keys should not be stored in localStorage.
// const API_KEY_MTN_STORAGE = 'navael_mtn_api_key';
// const API_KEY_AIRTEL_STORAGE = 'navael_airtel_api_key';
// const API_KEY_MTN_SECRET_STORAGE = 'navael_mtn_api_secret';
// const API_KEY_AIRTEL_SECRET_STORAGE = 'navael_airtel_api_secret';


const apiKeySchema = z.object({
  mtnApiKey: z.string().optional(),
  mtnApiSecret: z.string().optional(),
  airtelApiKey: z.string().optional(),
  airtelApiSecret: z.string().optional(),
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

export default function ApiKeyManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userRole, username: actorName } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // const [isLoadingData, setIsLoadingData] = useState(true); // No longer loading from localStorage

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      mtnApiKey: "",
      mtnApiSecret: "",
      airtelApiKey: "",
      airtelApiSecret: "",
    },
  });

  // useEffect(() => {
  //   // No longer loading API keys from localStorage for security reasons.
  //   // Form will always start empty.
  //   // setIsLoadingData(false);
  // }, [form, toast]);

  const onSubmit = async (values: ApiKeyFormValues) => {
    setIsSubmitting(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In a real app, these values would be sent to a secure backend.
    // For this prototype, we will just log and show a toast.
    // We are NOT saving these to localStorage.
    console.log("API_CALL_PLACEHOLDER: Submitting API Key configuration to backend (not implemented):", {
        mtnApiKeyProvided: !!values.mtnApiKey,
        mtnApiSecretProvided: !!values.mtnApiSecret,
        airtelApiKeyProvided: !!values.airtelApiKey,
        airtelApiSecretProvided: !!values.airtelApiSecret,
    });

    logActivity({
      actorRole: userRole || "Admin",
      actorName: actorName || "Admin",
      actionDescription: "Attempted to update payment gateway API keys (UI demo).",
      targetEntityType: "System Settings",
      iconName: "KeyRound",
    });

    toast({
      title: "API Key Settings Submitted (UI Demo)",
      description: "In a real application, these keys would be securely sent to and stored on the backend. They are not stored locally in this prototype.",
    });
    
    // Clear form fields after "submission" for security demo
    form.reset({
        mtnApiKey: "",
        mtnApiSecret: "",
        airtelApiKey: "",
        airtelApiSecret: "",
    });
    setIsSubmitting(false);
  };

  // if (isLoadingData) { // Removed as data is not loaded
  //   return (
  //       <div className="flex items-center justify-center min-h-[400px]">
  //           <Loader2 className="h-12 w-12 animate-spin text-primary" />
  //       </div>
  //   );
  // }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <KeyRound className="mr-3 h-8 w-8 text-primary" /> API Key Management
          </h1>
          <p className="text-muted-foreground">Configure API keys for third-party payment services (e.g., MTN, Airtel).</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin Panel
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary"/>Payment Gateway Credentials</CardTitle>
          <CardDescription>
            Enter the API keys and secrets provided by your payment gateway partners. These are for UI demonstration only and are NOT stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="space-y-4 p-4 border rounded-md shadow-sm bg-muted/20">
                <h3 className="text-lg font-semibold flex items-center text-orange-600">
                  <img src="https://placehold.co/24x24/FF9800/FFFFFF.png?text=M" alt="MTN Logo" className="mr-2 rounded-sm" data-ai-hint="mtn logo"/>
                  MTN Mobile Money
                </h3>
                <FormField
                  control={form.control}
                  name="mtnApiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MTN API Key</FormLabel>
                      <FormControl><Input type="password" placeholder="Enter MTN API Key" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="mtnApiSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MTN API Secret</FormLabel>
                      <FormControl><Input type="password" placeholder="Enter MTN API Secret" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 p-4 border rounded-md shadow-sm bg-muted/20">
                <h3 className="text-lg font-semibold flex items-center text-red-600">
                 <img src="https://placehold.co/24x24/F44336/FFFFFF.png?text=A" alt="Airtel Logo" className="mr-2 rounded-sm" data-ai-hint="airtel logo"/>
                  Airtel Money
                </h3>
                <FormField
                  control={form.control}
                  name="airtelApiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Airtel API Key</FormLabel>
                      <FormControl><Input type="password" placeholder="Enter Airtel API Key" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="airtelApiSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Airtel API Secret</FormLabel>
                      <FormControl><Input type="password" placeholder="Enter Airtel API Secret" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center p-4 mt-6 bg-destructive/10 border border-destructive/30 rounded-md text-destructive">
                <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
                <p className="text-sm">
                  <strong>Security Warning:</strong> API keys and secrets should NEVER be stored or managed directly in the frontend or `localStorage`. This form is for UI demonstration purposes only. Always manage sensitive credentials securely on a backend server. Entered values are not persisted.
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                  Submit Keys (UI Demo)
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

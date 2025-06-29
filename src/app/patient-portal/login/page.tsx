
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { usePatientAuth } from "@/contexts/patient-auth-context";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogInIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Logo } from "@/components/shared/logo";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";

const patientLoginFormSchema = z.object({
  patientId: z.string().min(1, { message: "Patient ID is required." }),
  dateOfBirth: z.date({ required_error: "Date of Birth is required." }),
});

type PatientLoginFormValues = z.infer<typeof patientLoginFormSchema>;

export default function PatientLoginPage() {
  const { login, isAuthenticated, isLoading: authLoading, loginError, setLoginError } = usePatientAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PatientLoginFormValues>({
    resolver: zodResolver(patientLoginFormSchema),
    defaultValues: {
      patientId: "",
      dateOfBirth: undefined,
    },
  });

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/patient-portal/dashboard');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (loginError) {
      toast({
        title: "Login Failed",
        description: loginError,
        variant: "destructive",
      });
      setLoginError(null); // Clear error after displaying
    }
  }, [loginError, toast, setLoginError]);

  const onSubmit = async (values: PatientLoginFormValues) => {
    setIsSubmitting(true);
    setLoginError(null);
    const success = await login(values.patientId, format(values.dateOfBirth, "yyyy-MM-dd"));
    setIsSubmitting(false);
    if (!success && !loginError) { // If login failed but no specific error was set by login func
        toast({ title: "Login Failed", description: "Please check your credentials.", variant: "destructive" });
    }
  };

  if (authLoading || (!authLoading && isAuthenticated)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl animate-slide-in-from-bottom">
        <div className="pt-6 pb-2 flex justify-center">
          <Logo />
        </div>
        <CardHeader className="pt-2">
          <CardTitle className="font-headline text-2xl text-center">Patient Portal</CardTitle>
          <CardDescription className="text-center">
            Access your health information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your Patient ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Birth</FormLabel>
                    <DatePicker
                        selected={field.value}
                        onSelect={field.onChange}
                        placeholder="Select your Date of Birth"
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting || authLoading}>
                {(isSubmitting || authLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2 pt-4">
          <p className="text-xs text-muted-foreground text-center">
            If you have trouble logging in, please contact the clinic.
          </p>
          <p className="text-sm text-muted-foreground">
            Navael Healthcare Solutions © {new Date().getFullYear()}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

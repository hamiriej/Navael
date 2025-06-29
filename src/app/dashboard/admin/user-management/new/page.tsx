
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUser } from "../page"; // Uses refactored API-calling function
import { ALL_ROLES, Role } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/contexts/auth-context";

const newUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.custom<Role>((val) => ALL_ROLES.includes(val as Role), {
    message: "Please select a valid role.",
  }),
  status: z.enum(["Active", "Inactive", "Pending"], { required_error: "Status is required" }),
  officeNumber: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type NewUserFormValues = z.infer<typeof newUserSchema>;

export default function NewUserPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userRole: actorRole, username: actorName } = useAuth();

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
        name: "",
        email: "",
        role: undefined,
        status: "Pending",
        officeNumber: "",
        password: "",
        confirmPassword: "",
    }
  });

  const onSubmit = async (values: NewUserFormValues) => {
    setIsSubmitting(true);
    
    const newUserApiPayload = {
        name: values.name,
        email: values.email,
        role: values.role,
        password: values.password, // Password sent to API
        status: values.status,
        officeNumber: values.officeNumber || undefined, 
    };
    try {
      const createdUser = await createUser(newUserApiPayload); 
      logActivity({
        actorRole: actorRole || ROLES.ADMIN, // Assuming admin action
        actorName: actorName || "Admin",
        actionDescription: `Created new user: ${createdUser.name} (Role: ${createdUser.role})`,
        targetEntityType: "User Account",
        targetEntityId: createdUser.id,
        iconName: "UserPlus",
      });
      toast({
        title: "User Created",
        description: `${createdUser.name} has been successfully added via API.`,
      });
      router.push("/dashboard/admin/user-management");
    } catch (error: any) {
      toast({ title: "Error Creating User", description: error.message || "Could not create user via API.", variant: "destructive"});
      console.error("Failed to create user:", error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <UserPlus className="mr-3 h-8 w-8 text-primary" /> Add New User
          </h1>
          <p className="text-muted-foreground">Create a new user account for the system.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to User Management
        </Button>
      </div>

      <Card className="shadow-lg max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="font-headline">New User Form</CardTitle>
          <CardDescription>
            Fill in the details to create a new user.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Dr. John Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl><Input type="email" placeholder="e.g., john.doe@navael.health" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select user role" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ALL_ROLES.map((r) => (
                          <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="officeNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Office Number (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Office 101, Lab 3" {...field} /></FormControl>
                    <FormDescription>Relevant for Doctors, Nurses, Lab Techs.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select initial status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl><Input type="password" placeholder="Enter password (min. 6 characters)" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl><Input type="password" placeholder="Confirm password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4"/>}
                  Create User
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
    
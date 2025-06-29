
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCog, ArrowLeft, Loader2, Save, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchUserById, updateUserService, type MockUser } from "../../page"; // Uses refactored API-calling functions
import { ALL_ROLES, Role } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/contexts/auth-context";


const userEditSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.custom<Role>((val) => ALL_ROLES.includes(val as Role), {
    message: "Please select a valid role.",
  }),
  status: z.enum(["Active", "Inactive", "Pending"], { required_error: "Status is required" }),
  officeNumber: z.string().optional(),
  newPassword: z.string().optional().refine(val => !val || val.length >= 6, {
    message: "New password must be at least 6 characters if provided."
  }),
  confirmNewPassword: z.string().optional(),
}).refine(data => {
  if (data.newPassword && !data.confirmNewPassword) {
    return false; 
  }
  return true;
}, {
  message: "Please confirm the new password.",
  path: ["confirmNewPassword"],
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "New passwords do not match.",
  path: ["confirmNewPassword"],
});


type UserEditFormValues = z.infer<typeof userEditSchema>;

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const { toast } = useToast();
  const { userRole: actorRole, username: actorName } = useAuth();

  const [user, setUser] = useState<MockUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
        newPassword: "",
        confirmNewPassword: "",
        officeNumber: "",
    }
  });

  useEffect(() => {
    async function loadUser() {
      if (!userId) {
        toast({ title: "Error", description: "User ID is missing.", variant: "destructive" });
        router.replace("/dashboard/admin/user-management");
        return;
      }
      setIsLoading(true);
      try {
        const fetchedUser = await fetchUserById(userId); // API call
        if (fetchedUser) {
          setUser(fetchedUser);
          form.reset({
            name: fetchedUser.name,
            email: fetchedUser.email,
            role: fetchedUser.role,
            status: fetchedUser.status,
            officeNumber: fetchedUser.officeNumber || "",
            newPassword: "", 
            confirmNewPassword: "",
          });
        } else {
          toast({ title: "Error", description: "User not found.", variant: "destructive" });
          router.replace("/dashboard/admin/user-management");
        }
      } catch (error: any) {
        toast({ title: "Error Loading User", description: error.message || "Could not load user data.", variant: "destructive" });
        console.error("Failed to load user:", error);
        router.replace("/dashboard/admin/user-management");
      }
      setIsLoading(false);
    }
    loadUser();
  }, [userId, form, router, toast]);

  const onSubmit = async (values: UserEditFormValues) => {
    if (!user) return;
    setIsSubmitting(true);

    const updatedUserDataPayload: Partial<Omit<MockUser, 'id' | 'password' | 'lastLogin'>> & {newPassword?: string} = {
      name: values.name,
      email: values.email,
      role: values.role,
      status: values.status,
      officeNumber: values.officeNumber || undefined,
    };

    if (values.newPassword) {
      updatedUserDataPayload.newPassword = values.newPassword;
    }

    try {
      const updatedUser = await updateUserService(user.id, updatedUserDataPayload); // API call
      let toastDescription = `${updatedUser.name}'s details have been successfully updated.`;
      if (values.newPassword) {
          toastDescription += ` Password changed.`;
      }
      logActivity({
        actorRole: actorRole || ROLES.ADMIN,
        actorName: actorName || "Admin",
        actionDescription: `Updated user: ${updatedUser.name}. ${values.newPassword ? 'Password changed.' : ''}`,
        targetEntityType: "User Account",
        targetEntityId: updatedUser.id,
        iconName: "UserCog",
      });
      toast({
        title: "User Updated",
        description: toastDescription,
      });
      router.push("/dashboard/admin/user-management");
    } catch (error: any) {
      toast({ title: "Error Updating User", description: error.message || "Could not update user.", variant: "destructive"});
      console.error("Failed to update user:", error);
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-10">
        <p className="text-destructive text-lg">User could not be loaded.</p>
        <Button onClick={() => router.push("/dashboard/admin/user-management")} variant="outline" className="mt-4">
          Back to User Management
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <UserCog className="mr-3 h-8 w-8 text-primary" /> Edit User
          </h1>
          <p className="text-muted-foreground">Modify details for {user.name} (ID: {user.id}).</p>
        </div>
        <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to User Management
        </Button>
      </div>

      <Card className="shadow-lg max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="font-headline">Edit User Form</CardTitle>
          <CardDescription>
            Update the user's information. Password fields can be left blank if no change is needed.
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
                    <FormControl><Input placeholder="e.g., Dr. Alice Smith" {...field} /></FormControl>
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
                    <FormControl><Input type="email" placeholder="e.g., alice.smith@navael.health" {...field} /></FormControl>
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
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select user status" /></SelectTrigger></FormControl>
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
              
              <Separator className="my-8" />
              <div className="space-y-2">
                <h3 className="text-md font-semibold flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground"/>Change Password (Optional)</h3>
                <p className="text-xs text-muted-foreground">Leave these fields blank if you do not want to change the user's password.</p>
              </div>

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl><Input type="password" placeholder="Enter new password (min. 6 characters)" {...field} /></FormControl>
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
                    <FormControl><Input type="password" placeholder="Confirm new password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
    
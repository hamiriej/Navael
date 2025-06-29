
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchUserById, updateUserService, type MockUser } from "../../page"; // Uses refactored API-calling functions
import { ALL_ROLES, Role } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/contexts/auth-context";

const permissionsSchema = z.object({
  role: z.custom<Role>((val) => ALL_ROLES.includes(val as Role), {
    message: "Please select a valid role.",
  }),
});

type PermissionsFormValues = z.infer<typeof permissionsSchema>;

export default function ManagePermissionsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const { toast } = useToast();
  const { userRole: actorRole, username: actorName } = useAuth();

  const [user, setUser] = useState<MockUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PermissionsFormValues>({
    resolver: zodResolver(permissionsSchema),
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
            role: fetchedUser.role,
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

  const onSubmit = async (values: PermissionsFormValues) => {
    if (!user) return;
    setIsSubmitting(true);

    const updatedUserDataPayload: Partial<Omit<MockUser, 'id' | 'password' | 'lastLogin'>> = {
      role: values.role,
    };

    try {
      const updatedUser = await updateUserService(user.id, updatedUserDataPayload); // API call
      logActivity({
        actorRole: actorRole || ROLES.ADMIN,
        actorName: actorName || "Admin",
        actionDescription: `Changed role for user ${updatedUser.name} to ${values.role}`,
        targetEntityType: "User Account",
        targetEntityId: updatedUser.id,
        iconName: "KeyRound",
      });
      toast({
        title: "User Role Updated",
        description: `${user.name}'s role has been changed to ${values.role}.`,
      });
      router.push("/dashboard/admin/user-management");
    } catch (error: any) {
      toast({ title: "Error Updating Role", description: error.message || "Could not update user role.", variant: "destructive"});
      console.error("Failed to update user role:", error);
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
            <KeyRound className="mr-3 h-8 w-8 text-primary" /> Change User Role
          </h1>
          <p className="text-muted-foreground">Modify the role for {user.name} (ID: {user.id}).</p>
        </div>
        <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to User Management
        </Button>
      </div>

      <Card className="shadow-lg max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="font-headline">Select New Role</CardTitle>
          <CardDescription>
            Changing the role will alter the user's access and capabilities within the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select new role" /></SelectTrigger></FormControl>
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
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                  Save Role Change
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
    
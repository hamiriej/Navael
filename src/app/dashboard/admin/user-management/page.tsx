"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, UserCog, MoreHorizontal, Edit, Trash2, UserPlus, ShieldCheck, KeyRound, LogIn, Link as LinkIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect, useCallback } from "react";
import type { Role } from "@/lib/constants";
import { ROLES, ALL_ROLES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/auth-context"; // USER_MANAGEMENT_STORAGE_KEY is no longer directly used here for primary data
import { logActivity } from "@/lib/activityLog";
import { format, parseISO, isValid } from "date-fns";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  password?: string; 
  status: "Active" | "Inactive" | "Pending";
  lastLogin: string; 
  officeNumber?: string;
  staffId?: string;

}

const API_BASE_URL = '/api/admin/users';

// --- Service-like functions for user management (API-driven) ---

async function handleUserManagementApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText || `API Error: ${response.status}`}));
    // Log the detailed error structure from the API if available
    console.error("API Error Response:", errorData);
    throw new Error(errorData.message || `API Error: ${response.status}`);
  }
  // MODIFIED LINE: Return 'undefined' for 204 No Content, which is more typical for void promises
  if (response.status === 204) return undefined as T; 
  return response.json() as Promise<T>;
}

export async function fetchUsers(queryParams?: Record<string, string>): Promise<MockUser[]> {
  const url = new URL(API_BASE_URL, window.location.origin);
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => url.searchParams.append(key, value));
  }
  const response = await fetch(url.toString());
  return handleUserManagementApiResponse<MockUser[]>(response);
}

export async function fetchUserById(id: string): Promise<MockUser | undefined> {
  const response = await fetch(`${API_BASE_URL}/${id}`);
  if (response.status === 404) return undefined; // API should return 404 if not found
  return handleUserManagementApiResponse<MockUser>(response);
}

export async function createUser(userData: Omit<MockUser, 'id' | 'lastLogin' | 'password'> & {password: string}): Promise<MockUser> {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
    });
    return handleUserManagementApiResponse<MockUser>(response);
}

export async function updateUserService(userId: string, updatedUserData: Partial<Omit<MockUser, 'id' | 'password' | 'lastLogin'>> & {newPassword?: string}): Promise<MockUser> {
  const response = await fetch(`${API_BASE_URL}/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedUserData),
  });
  return handleUserManagementApiResponse<MockUser>(response);
}

export async function deleteUserService(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/${userId}`, {
    method: 'DELETE',
  });
  // handleUserManagementApiResponse<null> will now return undefined, satisfying Promise<void>
  await handleUserManagementApiResponse<null>(response); 
}

let localUserCache: MockUser[] = [];
export const getAllStaffUsers = (): MockUser[] => {
  return localUserCache; 
};
// --- End Service-like functions ---


const statusColors: Record<MockUser["status"], string> = {
  Active: "bg-green-500",
  Inactive: "bg-red-500",
  Pending: "bg-yellow-500",
};

export default function UserManagementPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { userRole: currentAdminRole, username: currentAdminUsername, impersonateLogin, staffId, isImpersonating, originalAdminDetails } = useAuth();
  const [displayUsers, setDisplayUsers] = useState<MockUser[]>([]);
  const [userToDelete, setUserToDelete] = useState<MockUser | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const users = await fetchUsers();
      setDisplayUsers(users);
      localUserCache = users; 
    }
    catch (error: any) {
      toast({ title: "Error Loading Users", description: error.message || "Could not load users.", variant: "destructive"});
      setDisplayUsers([]);
      localUserCache = [];
    }
    finally { // Ensures loading state is reset even if an error occurs
      setIsLoadingUsers(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);


  const filteredUsers = useMemo(() => {
    return displayUsers.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, displayUsers]);

  const toggleUserStatus = async (user: MockUser) => {
    const newStatus = user.status === "Active" ? "Inactive" : "Active";
    try {
      const updatedUser = await updateUserService(user.id, { status: newStatus });
      setDisplayUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
      localUserCache = localUserCache.map(u => u.id === user.id ? updatedUser : u);
      toast({
          title: `User ${newStatus === "Active" ? "Activated" : "Deactivated"}`,
          description: `${user.name}'s status changed to ${newStatus}.`
      });
       logActivity({
        actorRole: currentAdminRole || ROLES.ADMIN,
        actorName: currentAdminUsername || "Admin",
        actionDescription: `${newStatus === "Active" ? "Activated" : "Deactivated"} user: ${user.name} (Role: ${user.role})`,
        targetEntityType: "User Account",
        targetEntityId: user.id,
        iconName: "UserCog",
      });
    } catch (error: any) {
        toast({ title: "Error Updating Status", description: error.message || "Could not update user status.", variant: "destructive"});
    }
  };

  const handleDeleteUser = async () => {
    if (userToDelete) {
      setIsDeletingUser(true);
      try {
        await deleteUserService(userToDelete.id);
        setDisplayUsers(prev => prev.filter(u => u.id !== userToDelete!.id));
        localUserCache = localUserCache.filter(u => u.id !== userToDelete!.id);
        toast({
          title: "User Deleted",
          description: `${userToDelete.name} has been permanently removed.`,
          variant: "destructive"
        });
        logActivity({
          actorRole: currentAdminRole || ROLES.ADMIN,
          actorName: currentAdminUsername || "Admin",
          actionDescription: `Deleted user: ${userToDelete.name} (Role: ${userToDelete.role})`,
          targetEntityType: "User Account",
          targetEntityId: userToDelete.id,
          iconName: "Trash2",
        });
      } catch (error: any) {
        toast({ title: "Error Deleting User", description: error.message || "Could not delete user.", variant: "destructive"});
      }
      setUserToDelete(null);
      setIsDeletingUser(false);
    }
  };

  const handleImpersonate = (userToImpersonate: MockUser) => {
    if (currentAdminRole === ROLES.ADMIN && currentAdminUsername) {
        impersonateLogin(userToImpersonate.role, userToImpersonate.name, userToImpersonate.id);
    } else {
        toast({ title: "Permission Denied", description: "Only administrators can perform this action.", variant: "destructive"});
    }
  };

  if (isLoadingUsers && displayUsers.length === 0) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <UserCog className="mr-3 h-8 w-8 text-primary" /> User Management
          </h1>
          <p className="text-muted-foreground">Manage system user accounts, roles, and permissions.</p>
        </div>
        <Button asChild>
            <Link href="/dashboard/admin/user-management/new">
                <UserPlus className="mr-2 h-4 w-4"/>Add New User
            </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, or role..."
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingUsers && displayUsers.length === 0 ? (
             <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Office</TableHead>
                  <TableHead className="hidden md:table-cell">Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const trueAdminStaffId = isImpersonating && originalAdminDetails ? originalAdminDetails.staffId : staffId;
                  return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground md:hidden">{user.email}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                    <TableCell>
                        <Badge variant={user.role === ROLES.ADMIN ? "default" : "secondary"} className="capitalize flex items-center gap-1">
                            {user.role === ROLES.ADMIN && <ShieldCheck className="h-3 w-3"/>}
                            {user.role}
                        </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-2 capitalize">
                         <span className={`h-2 w-2 rounded-full ${statusColors[user.status]}`} />
                         {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{user.officeNumber || "N/A"}</TableCell>
<TableCell className="hidden md:table-cell">
  {user.lastLogin && user.lastLogin !== "Never" ? (
    (() => {
      const parsedDate = parseISO(user.lastLogin);
      // This is the key check: ensure the parsed date is valid
      return isValid(parsedDate) ? format(parsedDate, "PPp") : "Invalid Date";
    })()
  ) : "Never"}
</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog open={!!userToDelete && userToDelete.id === user.id} onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isDeletingUser && userToDelete?.id === user.id}>
                              {(isDeletingUser && userToDelete?.id === user.id) ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/admin/user-management/${user.id}/edit`}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit User
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                               <Link href={`/dashboard/admin/user-management/${user.id}/permissions`}>
                                  <KeyRound className="mr-2 h-4 w-4" /> Change Role
                               </Link>
                            </DropdownMenuItem>
                             {currentAdminRole === ROLES.ADMIN && user.id !== trueAdminStaffId && (
                                <DropdownMenuItem onClick={() => handleImpersonate(user)}>
                                    <LogIn className="mr-2 h-4 w-4" /> Login as User
                                </DropdownMenuItem>
                            )}
                             <DropdownMenuItem asChild>
                              <Link href={`/dashboard/reports/staff/${user.id}`}>
                                <LinkIcon className="mr-2 h-4 w-4" /> View Staff Report
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.status === "Active" && (
                              <DropdownMenuItem className="text-orange-600 focus:text-orange-700 focus:bg-orange-100" onClick={() => toggleUserStatus(user)}>
                                  <UserCog className="mr-2 h-4 w-4" /> Deactivate User
                              </DropdownMenuItem>
                            )}
                            {user.status === "Inactive" && (
                              <DropdownMenuItem className="text-green-600 focus:text-green-700 focus:bg-green-100" onClick={() => toggleUserStatus(user)}>
                                  <UserCog className="mr-2 h-4 w-4" /> Activate User
                              </DropdownMenuItem>
                            )}
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                                onClick={() => setUserToDelete(user)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete User
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the user account for {userToDelete?.name}.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setUserToDelete(null)} disabled={isDeletingUser}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteUser} className={buttonVariants({variant: "destructive"})} disabled={isDeletingUser}>
                                {isDeletingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Delete User
                              </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Search className="mx-auto h-12 w-12 mb-4" />
              <p className="text-lg">No users found matching your criteria.</p>
              <p className="text-sm">Use the "Add New User" button to create user accounts.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

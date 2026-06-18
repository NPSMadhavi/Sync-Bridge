import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormSheetHeader } from "@/components/ui/form-sheet-header";
import { FormSheetFooter, formSheetCancelClass, formSheetSubmitClass } from "@/components/ui/form-sheet-footer";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Mail, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Dashboard from "@/components/layout/Dashboard";
import { TableRowActions } from "@/components/ui/table-row-actions";
import UserPermissionsEditor from "@/components/forms/UserPermissionsEditor";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import {
  createEmptyPermissions,
  normalizePermissions,
  isSuperAdminUser,
  type UserPermissionsMap,
} from "@shared/permissions";
import { formatDisplayDate } from "@shared/document-reminder-utils";

interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'hr_manager' | 'employee' | 'vendor';
  isActive: boolean;
  isSuperAdmin?: boolean;
  permissions?: UserPermissionsMap;
  createdAt?: string | null;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  permissions: UserPermissionsMap;
}

export default function UserManagementPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteErrorDialogOpen, setDeleteErrorDialogOpen] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    permissions: createEmptyPermissions(),
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { canView, isAdmin, isSuperAdmin } = usePermissions();

  const canManageUsers = canView("userManagement") && (isAdmin || isSuperAdmin);
  const showModuleAccess = !["super_admin", "admin"].includes(formData.role);

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      return response.json();
    }
  });

  // Add user mutation
  const addUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const response = await apiRequest('POST', '/api/users', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "User added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add user",
        variant: "destructive",
      });
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormData> }) => {
      const response = await apiRequest('PUT', `/api/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      resetForm();
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: any) => {
      setDeleteErrorMessage(error.message || "Failed to delete user");
      setDeleteErrorDialogOpen(true);
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'employee',
      permissions: createEmptyPermissions(),
    });
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      permissions: normalizePermissions(user.permissions),
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteUserMutation.mutate(id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      ...(showModuleAccess ? { permissions: formData.permissions } : {}),
    };
    if (selectedUser) {
      const { password, ...updateData } = payload;
      updateUserMutation.mutate({
        id: selectedUser.id,
        data: password ? payload : updateData,
      });
    } else {
      addUserMutation.mutate(payload);
    }
  };

  const roles = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'hr_manager', label: 'HR Manager' },
    { value: 'employee', label: 'Employee' },
    { value: 'vendor', label: 'Vendor' }
  ].filter((role) => role.value !== 'super_admin' || isSuperAdmin);

  const filteredUsers = users.filter((user: User) =>
    (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.role?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (roles.find(r => r.value === user.role)?.label || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManageUserRow = (user: User) => {
    if (!canManageUsers) return false;
    if (isSuperAdminUser(user)) return isSuperAdmin;
    return true;
  };

  const canDeleteUserRow = (user: User) => {
    if (!canManageUserRow(user)) return false;
    if (isSuperAdminUser(user) && isSuperAdmin) return true;
    return String(user.id) !== String(currentUser?.id);
  };

  const renderUserFormFields = (passwordRequired: boolean) => (
    <>
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="password">Password {passwordRequired ? "*" : "(leave blank to keep current)"}</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required={passwordRequired}
        />
      </div>
      <div>
        <Label htmlFor="role">Role *</Label>
        <Select
          value={formData.role}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              role: value,
              permissions: ["super_admin", "admin"].includes(value)
                ? createEmptyPermissions()
                : formData.permissions,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showModuleAccess && (
        <UserPermissionsEditor
          value={formData.permissions}
          onChange={(permissions) => setFormData({ ...formData, permissions })}
        />
      )}
    </>
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'admin':
        return 'default';
      case 'hr_manager':
        return 'secondary';
      case 'employee':
        return 'outline';
      case 'vendor':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeVariant = (isActive: boolean) => {
    return isActive ? 'default' : 'secondary';
  };

  return (
    <Dashboard>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">User Management</h1>
        </div>
        {canManageUsers && (
          <Button onClick={() => {
            resetForm();
            setIsAddDialogOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      {/* Add User Sheet */}
      <Sheet open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <SheetContent 
          side="right" 
          hideClose
          className="p-0 flex flex-col overflow-hidden"
          style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}
        >
          <FormSheetHeader
            title="Add New User"
            description="Add a new user to your organization"
            onClose={() => setIsAddDialogOpen(false)}
          />
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {renderUserFormFields(true)}
            </div>
            <FormSheetFooter>
              <Button type="button" variant="outline" className={formSheetCancelClass} onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className={formSheetSubmitClass} disabled={addUserMutation.isPending}>
                {addUserMutation.isPending ? 'Adding...' : 'Add User'}
              </Button>
            </FormSheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>User Management</CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created Date</TableHead>
                  {canManageUsers && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: User) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {user.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {roles.find(r => r.value === user.role)?.label || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(user.isActive)}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.createdAt ? formatDisplayDate(user.createdAt) : '—'}
                    </TableCell>
                    {canManageUsers && (
                      <TableCell>
                        {canManageUserRow(user) ? (
                          <TableRowActions
                            actions={[
                              {
                                icon: Edit,
                                label: "Edit",
                                variant: "edit",
                                onClick: () => handleEdit(user),
                              },
                              ...(canDeleteUserRow(user)
                                ? [
                                    {
                                      icon: Trash2,
                                      label: "Delete",
                                      variant: "delete" as const,
                                      onClick: () => handleDelete(user.id),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        ) : null}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Sheet */}
      <Sheet open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <SheetContent 
          side="right" 
          hideClose
          className="p-0 flex flex-col overflow-hidden"
          style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}
        >
          <FormSheetHeader
            title="Edit User"
            description="Update user information"
            onClose={() => setIsEditDialogOpen(false)}
          />
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {renderUserFormFields(false)}
            </div>
            <FormSheetFooter>
              <Button type="button" variant="outline" className={formSheetCancelClass} onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className={formSheetSubmitClass} disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? 'Updating...' : 'Update User'}
              </Button>
            </FormSheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteErrorDialogOpen} onOpenChange={setDeleteErrorDialogOpen}>
        <DialogContent className="max-w-md">
  
          <p className="text-sm text-muted-foreground">{deleteErrorMessage}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteErrorDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dashboard>
  );
} 
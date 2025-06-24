import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { insertUserSchema, type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const userFormSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  allowedModules: z.array(z.string()).optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormProps {
  user?: User | null;
  onSuccess?: () => void;
}

const moduleOptions = [
  { id: "dashboard", label: "Dashboard" },
  { id: "assets", label: "Assets" },
  { id: "licenses", label: "Licenses" },
  { id: "employees", label: "Employees" },
  { id: "documents", label: "Documents" },
  { id: "vendors", label: "Vendors" },
  { id: "customers", label: "Customers" },
  { id: "invoices", label: "Invoices" },
  { id: "reports", label: "Reports" },
  { id: "audit_logs", label: "Audit Logs" },
  { id: "settings", label: "Settings" },
  { id: "user_management", label: "User Management" },
];

export default function UserForm({ user, onSuccess }: UserFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  // Default modules based on role
  const roleModuleDefaults = {
    super_admin: ["dashboard", "assets", "licenses", "employees", "documents", "vendors", "customers", "invoices", "reports", "audit_logs", "settings", "user_management"],
    admin: ["dashboard", "assets", "licenses", "employees", "documents", "vendors", "customers", "invoices", "reports", "audit_logs", "settings", "user_management"],
    hr_manager: ["dashboard", "employees", "documents", "reports"],
    it_manager: ["dashboard", "assets", "licenses", "documents", "vendors", "reports"],
    accountant: ["dashboard", "customers", "invoices", "vendors", "reports"],
    employee: ["dashboard"]
  };

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      password: "",
      role: user?.role || "employee",
      isActive: user?.isActive ?? true,
      allowedModules: user?.allowedModules || [],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const url = user ? `/api/users/${user.id}` : "/api/users";
      const method = user ? "PUT" : "POST";
      
      // Don't send empty password for updates
      const payload = { ...data };
      if (user && !data.password) {
        delete payload.password;
      }
      
      const response = await apiRequest(method, url, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: `User ${user ? "updated" : "created"} successfully.`,
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${user ? "update" : "create"} user.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UserFormData) => {
    mutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address *</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="user@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Password {!user && "*"}
                  {user && <span className="text-sm text-muted-foreground">(leave empty to keep current)</span>}
                </FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder={user ? "Leave empty to keep current" : "Enter password"} 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="accountant">Accountant</SelectItem>
                    <SelectItem value="hr_manager">HR Manager</SelectItem>
                    <SelectItem value="it_manager">IT Manager</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active User</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Enable this user to access the system
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="allowedModules"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Module Access</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Select which modules this user can access
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {moduleOptions.map((module) => (
                  <FormField
                    key={module.id}
                    control={form.control}
                    name="allowedModules"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={module.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(module.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value || [], module.id])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== module.id
                                      )
                                    )
                              }}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">
                            {module.label}
                          </FormLabel>
                        </FormItem>
                      )
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {user ? "Update User" : "Create User"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
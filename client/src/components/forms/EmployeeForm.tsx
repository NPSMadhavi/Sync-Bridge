import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmployeeSchema } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2 } from "lucide-react";

type EmployeeFormData = z.infer<typeof formSchema>;

// Extend the schema to add validation
const formSchema = insertEmployeeSchema.extend({
  employeeId: z.string().min(2, "Employee ID must be at least 2 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  department: z.string().min(2, "Department must be at least 2 characters"),
  designation: z.string().min(2, "Designation must be at least 2 characters"),
  joinDate: z.date({ required_error: "Join date is required" }),
  passportNumber: z.string().optional(),
  passportExpiry: z.date().optional(),
  visaNumber: z.string().optional(),
  visaExpiry: z.date().optional(),
});

interface EmployeeFormProps {
  employeeId?: number;
  onSuccess?: () => void;
}

export default function EmployeeForm({ employeeId, onSuccess }: EmployeeFormProps) {
  const { toast } = useToast();
  const [isEditMode] = useState(!!employeeId);
  
  // Fetch employee data if in edit mode
  const { data: employeeData, isLoading: isLoadingEmployee } = useQuery({
    queryKey: ["/api/employees", employeeId],
    enabled: !!employeeId,
  });
  
  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      name: "",
      department: "",
      designation: "",
      joinDate: new Date(),
      passportNumber: "",
      passportExpiry: undefined,
      visaNumber: "",
      visaExpiry: undefined,
    },
  });
  
  // Update form when employee data is loaded
  useState(() => {
    if (employeeData) {
      form.reset({
        ...employeeData,
        joinDate: employeeData.joinDate ? new Date(employeeData.joinDate) : new Date(),
        passportExpiry: employeeData.passportExpiry ? new Date(employeeData.passportExpiry) : undefined,
        visaExpiry: employeeData.visaExpiry ? new Date(employeeData.visaExpiry) : undefined,
      });
    }
  });
  
  const createEmployeeMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      const res = await apiRequest("POST", "/api/employees", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Employee created",
        description: "The employee has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      form.reset();
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create employee",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      const res = await apiRequest("PUT", `/api/employees/${employeeId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Employee updated",
        description: "The employee has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId] });
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update employee",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: EmployeeFormData) => {
    if (isEditMode) {
      updateEmployeeMutation.mutate(data);
    } else {
      createEmployeeMutation.mutate(data);
    }
  };
  
  if (isEditMode && isLoadingEmployee) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee ID</FormLabel>
                <FormControl>
                  <Input placeholder="EMP-1001" {...field} />
                </FormControl>
                <FormDescription>
                  Unique employee identifier
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormDescription>
                  Employee's full name
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <FormControl>
                  <Input placeholder="Engineering" {...field} />
                </FormControl>
                <FormDescription>
                  Department the employee belongs to
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="designation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Designation</FormLabel>
                <FormControl>
                  <Input placeholder="Software Engineer" {...field} />
                </FormControl>
                <FormDescription>
                  Employee's job title
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="joinDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Join Date</FormLabel>
                <DatePicker
                  date={field.value}
                  setDate={(date) => field.onChange(date)}
                />
                <FormDescription>
                  Date when the employee joined
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="col-span-1 md:col-span-2">
            <div className="bg-primary-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-primary-700 mb-2">
                Document Information (Optional)
              </h3>
              <p className="text-xs text-primary-600 mb-4">
                Enter passport and visa details if applicable
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="passportNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passport Number</FormLabel>
                      <FormControl>
                        <Input placeholder="A1234567" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="passportExpiry"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Passport Expiry Date</FormLabel>
                      <DatePicker
                        date={field.value}
                        setDate={(date) => field.onChange(date)}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="visaNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visa Number</FormLabel>
                      <FormControl>
                        <Input placeholder="V9876543" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="visaExpiry"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Visa Expiry Date</FormLabel>
                      <DatePicker
                        date={field.value}
                        setDate={(date) => field.onChange(date)}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onSuccess && onSuccess()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}
          >
            {createEmployeeMutation.isPending || updateEmployeeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>{isEditMode ? "Update Employee" : "Create Employee"}</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

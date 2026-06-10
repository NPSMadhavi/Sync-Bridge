import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmployeeSchema, insertDependentSchema, Employee } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { format, isAfter, isBefore } from "date-fns";
import { Loader2, Users, FileText, Upload, Plus, Trash2, User, Shield, Building, AlertTriangle, X } from "lucide-react";
import { SimpleDatePicker } from "@/components/ui/simple-date-picker";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Dependent schema for the form
const dependentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  relationship: z.enum(["spouse", "child", "parent", "sibling", "other"]),
  passportNumber: z.string().optional(),
  passportExpiry: z.string().datetime().optional().nullable(),
  visaNumber: z.string().optional(),
  visaExpiry: z.string().datetime().optional().nullable(),
  visaType: z.enum(["s_pass", "work_permit", "employment_pass", "pr", "dependent_pass", "ltvp", "student_pass", "other"]).optional().nullable(),
  passportScan: z.string().optional(),
  visaScan: z.string().optional(),
});

// Extended employee form schema with dependents
const employeeFormSchema = insertEmployeeSchema.extend({
  employeeId: z.string().min(2, "Employee ID must be at least 2 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  department: z.string().min(2, "Department must be at least 2 characters"),
  designation: z.string().min(2, "Designation must be at least 2 characters"),
  joinDate: z.string().min(1, "Join date is required"),
  status: z.enum(["active", "resigned", "on_hold", "terminated"]),
  nationality: z.enum(["singaporean_pr", "foreigner"]),
  nricNumber: z.string().optional(),
  finNumber: z.string().optional(),
  passportNumber: z.string().optional(),
  passportExpiry: z.string().optional().nullable(),
  visaNumber: z.string().optional(),
  visaExpiry: z.string().optional().nullable(),
  visaType: z.enum(["s_pass", "work_permit", "employment_pass", "pr", "dependent_pass", "ltvp", "student_pass", "other"]).optional().nullable(),
  visaRemarks: z.string().optional(),
  passportScan: z.string().optional(),
  visaScan: z.string().optional(),
  nricScan: z.string().optional(),
  dependents: z.array(dependentSchema).optional(),
}).refine((data) => {
  // Validate that visa expiry is after passport expiry
  if (data.passportExpiry && data.visaExpiry && data.passportExpiry.trim() && data.visaExpiry.trim()) {
    try {
      return isAfter(new Date(data.visaExpiry), new Date(data.passportExpiry));
    } catch {
      return true; // If date parsing fails, skip validation
    }
  }
  return true;
}, {
  message: "Visa expiry must be after passport expiry",
  path: ["visaExpiry"],
}).refine((data) => {
  // Validate nationality-specific required fields
  if (data.nationality === 'singaporean_pr') {
    return data.nricNumber && data.nricNumber.length > 0;
  }
  return true;
}, {
  message: "NRIC Number is required for Singaporean/PR",
  path: ["nricNumber"],
}).refine((data) => {
  if (data.nationality === 'foreigner') {
    return data.finNumber && data.finNumber.length > 0;
  }
  return true;
}, {
  message: "FIN Number is required for Foreigners",
  path: ["finNumber"],
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

interface EmployeeFormProps {
  employee?: Employee;
  isOpen?: boolean;
  onClose?: () => void;
  embedded?: boolean; // New prop to indicate if form is embedded in another component
}

export default function EmployeeForm({ employee, isOpen, onClose, embedded = false }: EmployeeFormProps) {
  const { toast } = useToast();
  const { user, tenantId } = useAuth();
  const [isEditMode] = useState(!!employee);
  const isExpired = employee?.passportExpiry && isBefore(employee.passportExpiry, new Date());
  
  // Helper function to safely convert date to ISO string
  const safeDateToISO = (dateValue: any): string | null => {
    if (!dateValue) return null;
    try {
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
      return null;
    }
  };

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      employeeId: employee?.employeeId || "",
      name: employee?.name || "",
      department: employee?.department || "",
      designation: employee?.designation || "",
      joinDate: safeDateToISO(employee?.joinDate) || new Date().toISOString(),
      status: employee?.status || "active",
      nationality: employee?.nationality || undefined,
      nricNumber: employee?.nricNumber || "",
      finNumber: employee?.finNumber || "",
      passportNumber: employee?.passportNumber || "",
      passportExpiry: safeDateToISO(employee?.passportExpiry),
      visaNumber: employee?.visaNumber || "",
      visaExpiry: safeDateToISO(employee?.visaExpiry),
      visaType: employee?.visaType || null,
      visaRemarks: employee?.visaRemarks || "",
      passportScan: employee?.passportScan || "",
      visaScan: employee?.visaScan || "",
      nricScan: employee?.nricScan || "",
      dependents: [],
    },
  });

  const { fields: dependentFields, append: addDependent, remove: removeDependent } = useFieldArray({
    control: form.control,
    name: "dependents",
  });

  // Create employee mutation
  const createMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      // For super admin users, tenantId can be null (global access)
      if (!(user?.role === 'super_admin' || user?.isSuperAdmin) && !tenantId) {
        throw new Error("Tenant ID is required");
      }
      
      const response = await apiRequest("POST", "/api/employees", {
        ...data,
        tenantId: tenantId || null
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      form.reset();
      onClose?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create employee",
        variant: "destructive",
      });
    },
  });

  // Update employee mutation
  const updateMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      // For super admin users, tenantId can be null (global access)
      if (!(user?.role === 'super_admin' || user?.isSuperAdmin) && !tenantId) {
        throw new Error("Tenant ID is required");
      }
      
      const response = await apiRequest("PUT", `/api/employees/${employee!.id}`, {
        ...data,
        tenantId: tenantId || null
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      onClose?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee",
        variant: "destructive",
      });
    },
  });

  // File upload handler
  const handleFileUpload = (file: File, fieldName: string) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      form.setValue(fieldName as any, base64String);
    };
    reader.readAsDataURL(file);
  };

  // Handle form submission
  const onSubmit = async (values: EmployeeFormData) => {
    // Ensure user is available, and tenant is available for non-super-admin users
    if (!user || (!tenantId && !(user.role === 'super_admin' || user.isSuperAdmin))) {
      toast({
        title: "Error",
        description: "User authentication or tenant information is missing",
        variant: "destructive",
      });
      return;
    }

    // Convert dates to ISO strings if they're not already
    const updatedValues = {
      ...values,
      joinDate: values.joinDate ? new Date(values.joinDate).toISOString() : new Date().toISOString(),
      passportExpiry: values.passportExpiry ? new Date(values.passportExpiry).toISOString() : null,
      visaExpiry: values.visaExpiry ? new Date(values.visaExpiry).toISOString() : null,
      dependents: values.dependents?.map(dependent => ({
        ...dependent,
        passportExpiry: dependent.passportExpiry ? new Date(dependent.passportExpiry).toISOString() : null,
        visaExpiry: dependent.visaExpiry ? new Date(dependent.visaExpiry).toISOString() : null,
      })),
    };

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(updatedValues);
      } else {
        await createMutation.mutateAsync(updatedValues);
      }
      // Force an immediate refetch
      await queryClient.refetchQueries({ queryKey: ["/api/employees"], type: 'active' });
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose?.();
    }
  };

  const formContent = (
    <>
      <TooltipProvider>
        <Form {...form}>
          <div className={embedded ? "w-full" : "h-full flex flex-col"}>
            {/* Sticky Header - Only show if not embedded */}
            {!embedded && (
              <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0 flex items-center justify-between">
                <SheetHeader className="flex-row flex-1 justify-between items-center">
                  <SheetTitle className="flex items-center gap-2 text-xl">
                    <Users className="h-5 w-5 text-primary" />
                    {isEditMode ? "Edit Employee" : "Add New Employee"}
                    {isExpired && (
                      <span className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded-full">
                        Documents Expired
                      </span>
                    )}
                  </SheetTitle>
                </SheetHeader>
                <Button variant="ghost" size="sm" onClick={() => onClose?.()}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Form Content - Scrollable Area */}
            <div className={embedded ? "w-full" : "flex-1 overflow-y-auto px-6 pb-24"}>
              {/* Responsive grid layout container */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl mx-auto py-6">
                
                  {/* Left Column */}
                  <div className="space-y-6">
                    
                    {/* Personal Information Section */}
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <User className="h-4 w-4" />
                          Personal Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">

                        {/* Employee ID */}
                        <FormField
                          control={form.control}
                          name="employeeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Employee ID*</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., EMP001"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Unique identifier for the employee
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Full Name */}
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name*</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="John Doe"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Employee's full legal name
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Department */}
                        <FormField
                          control={form.control}
                          name="department"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Department*</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Engineering, HR, Finance"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Employee's department or division
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Designation */}
                        <FormField
                          control={form.control}
                          name="designation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Designation*</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Software Engineer, Manager"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Employee's job title or position
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Join Date */}
                        <FormField
                          control={form.control}
                          name="joinDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Join Date*</FormLabel>
                              <FormControl>
                                <SimpleDatePicker
                                  date={field.value ? new Date(field.value) : new Date()}
                                  setDate={(date) => field.onChange(date ? date.toISOString() : new Date().toISOString())}
                                />
                              </FormControl>
                              <FormDescription>When did the employee join the company</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Employee Status */}
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select employee status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="active">
                                    <div className="flex items-center gap-2">
                                      <span className="h-3 w-3 rounded-full bg-green-500"></span>
                                      Active
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="resigned">
                                    <div className="flex items-center gap-2">
                                      <span className="h-3 w-3 rounded-full bg-blue-500"></span>
                                      Resigned
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="on_hold">
                                    <div className="flex items-center gap-2">
                                      <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
                                      On Hold
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="terminated">
                                    <div className="flex items-center gap-2">
                                      <span className="h-3 w-3 rounded-full bg-red-500"></span>
                                      Terminated
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription className="text-xs">
                                Current employment status
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Nationality */}
                        <FormField
                          control={form.control}
                          name="nationality"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nationality</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select nationality" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="singaporean_pr">Singaporean / PR</SelectItem>
                                  <SelectItem value="foreigner">Foreigner</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription className="text-xs">
                                Employee's nationality status
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                    
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">

                    {/* Immigration Details Section */}
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Shield className="h-4 w-4" />
                          Immigration Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">

                        {/* Conditional ID Fields based on Nationality */}
                        {form.watch("nationality") === "singaporean_pr" && (
                          <FormField
                            control={form.control}
                            name="nricNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>NRIC/ID Number</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., S1234567A"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Singapore NRIC or ID number
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {form.watch("nationality") === "foreigner" && (
                          <FormField
                            control={form.control}
                            name="finNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>FIN (Foreigner ID)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., G1234567X"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Foreigner Identification Number
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {/* Passport Number */}
                        <FormField
                          control={form.control}
                          name="passportNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Passport Number</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., A1234567"
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Employee's passport number
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Passport Expiry */}
                        <FormField
                          control={form.control}
                          name="passportExpiry"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Passport Expiry</FormLabel>
                              <FormControl>
                                <SimpleDatePicker
                                  date={field.value ? new Date(field.value) : null}
                                  setDate={(date) => field.onChange(date ? date.toISOString() : null)}
                                />
                              </FormControl>
                              <FormDescription>When does the passport expire</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Conditional Visa Fields - Only show for Foreigners */}
                        {form.watch("nationality") === "foreigner" && (
                          <>
                            {/* Visa Type */}
                            <FormField
                              control={form.control}
                              name="visaType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Visa Type</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select visa type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="s_pass">S Pass</SelectItem>
                                      <SelectItem value="work_permit">Work Permit</SelectItem>
                                      <SelectItem value="employment_pass">Employment Pass</SelectItem>
                                      <SelectItem value="pr">Permanent Resident</SelectItem>
                                      <SelectItem value="dependent_pass">Dependent Pass</SelectItem>
                                      <SelectItem value="ltvp">Long Term Visit Pass</SelectItem>
                                      <SelectItem value="student_pass">Student Pass</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormDescription className="text-xs">
                                    Type of work visa or permit
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Visa Number */}
                            <FormField
                              control={form.control}
                              name="visaNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Work Permit Number</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="e.g., WP1234567"
                                      {...field}
                                      value={field.value || ""}
                                    />
                                  </FormControl>
                                  <FormDescription className="text-xs">
                                    Work permit reference number
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Visa Expiry */}
                            <FormField
                              control={form.control}
                              name="visaExpiry"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Visa Expiry</FormLabel>
                                  <FormControl>
                                    <SimpleDatePicker
                                      date={field.value ? new Date(field.value) : null}
                                      setDate={(date) => field.onChange(date ? date.toISOString() : null)}
                                    />
                                  </FormControl>
                                  <FormDescription>When does the visa expire</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Visa Remarks */}
                            <FormField
                              control={form.control}
                              name="visaRemarks"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Visa Remarks</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Any additional notes about visa status..."
                                      className="min-h-[60px]"
                                      {...field}
                                      value={field.value || ""}
                                    />
                                  </FormControl>
                                  <FormDescription className="text-xs">
                                    Optional notes about visa conditions or restrictions
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </>
                        )}


                      </CardContent>
                    </Card>
                    
                  </div>
                </div>

                {/* Document Uploads Section - Full Width */}
                <div className="mt-8 col-span-full max-w-7xl mx-auto">
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="h-4 w-4" />
                        Document Uploads
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">

                      {/* Passport Scan */}
                      <FormField
                        control={form.control}
                        name="passportScan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Passport Scan</FormLabel>
                            <FormControl>
                              <div className="flex flex-col gap-2">
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file, "passportScan");
                                  }}
                                />
                                {field.value && (
                                  <p className="text-xs text-green-600">File uploaded successfully</p>
                                )}
                              </div>
                            </FormControl>
                            <FormDescription className="text-xs">
                              Upload passport scan (PDF/JPG/PNG)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Visa Scan - Only show for Foreigners */}
                      {form.watch("nationality") === "foreigner" && (
                        <FormField
                          control={form.control}
                          name="visaScan"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Visa/Work Permit Scan</FormLabel>
                              <FormControl>
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(file, "visaScan");
                                    }}
                                  />
                                  {field.value && (
                                    <p className="text-xs text-green-600">File uploaded successfully</p>
                                  )}
                                </div>
                              </FormControl>
                              <FormDescription className="text-xs">
                                Upload visa or work permit scan
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* NRIC Scan - Only show for Singaporean/PR */}
                      {form.watch("nationality") === "singaporean_pr" && (
                        <FormField
                          control={form.control}
                          name="nricScan"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>NRIC/ID Scan</FormLabel>
                              <FormControl>
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(file, "nricScan");
                                    }}
                                  />
                                  {field.value && (
                                    <p className="text-xs text-green-600">File uploaded successfully</p>
                                  )}
                                </div>
                              </FormControl>
                              <FormDescription className="text-xs">
                                Upload NRIC or ID copy
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Dependents Section - Full Width */}
                <div className="mt-8 col-span-full max-w-7xl mx-auto">
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Users className="h-4 w-4" />
                        Dependents
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addDependent({
                            name: "",
                            relationship: "spouse",
                            passportNumber: "",
                            passportExpiry: null,
                            visaNumber: "",
                            visaExpiry: null,
                            visaType: null,
                            passportScan: "",
                            visaScan: "",
                          })}
                          className="ml-auto"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Dependent
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dependentFields.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No dependents added yet. Click "Add Dependent" to start.</p>
                      ) : (
                        <div className="space-y-6">
                          {dependentFields.map((dependent, index) => (
                            <div key={dependent.id} className="border rounded-lg p-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">Dependent {index + 1}</h4>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeDependent(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Dependent Name */}
                                <FormField
                                  control={form.control}
                                  name={`dependents.${index}.name`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Full Name*</FormLabel>
                                      <FormControl>
                                        <Input placeholder="John Doe" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {/* Relationship */}
                                <FormField
                                  control={form.control}
                                  name={`dependents.${index}.relationship`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Relationship*</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select relationship" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="spouse">Spouse</SelectItem>
                                          <SelectItem value="child">Child</SelectItem>
                                          <SelectItem value="parent">Parent</SelectItem>
                                          <SelectItem value="sibling">Sibling</SelectItem>
                                          <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {/* Passport Number */}
                                <FormField
                                  control={form.control}
                                  name={`dependents.${index}.passportNumber`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Passport Number</FormLabel>
                                      <FormControl>
                                        <Input placeholder="Optional" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {/* Passport Expiry */}
                                <FormField
                                  control={form.control}
                                  name={`dependents.${index}.passportExpiry`}
                                  render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                      <FormLabel>Passport Expiry</FormLabel>
                                      <FormControl>
                                        <SimpleDatePicker
                                          date={field.value ? new Date(field.value) : null}
                                          setDate={(date) => field.onChange(date ? date.toISOString() : null)}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {/* Visa Number */}
                                <FormField
                                  control={form.control}
                                  name={`dependents.${index}.visaNumber`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Visa Number</FormLabel>
                                      <FormControl>
                                        <Input placeholder="Optional" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {/* Visa Expiry */}
                                <FormField
                                  control={form.control}
                                  name={`dependents.${index}.visaExpiry`}
                                  render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                      <FormLabel>Visa Expiry</FormLabel>
                                      <FormControl>
                                        <SimpleDatePicker
                                          date={field.value ? new Date(field.value) : null}
                                          setDate={(date) => field.onChange(date ? date.toISOString() : null)}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Sticky Footer with Actions - Outside scrollable area */}
              <div className="flex-shrink-0 bg-background border-t px-8 py-4">
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="flex flex-col sm:flex-row justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto min-w-[120px]"
                      onClick={() => {
                        form.reset();
                        onClose?.();
                      }}
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="w-full sm:w-auto min-w-[140px]"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {isEditMode ? "Update Employee" : "Create Employee"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </Form>
        </TooltipProvider>
      </>
    );

  // Return the form wrapped in Sheet if not embedded, otherwise return just the form content
  if (embedded) {
    return formContent;
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right"
        className="!w-screen !max-w-none fixed top-0 right-0 h-screen z-50 p-0 flex flex-col bg-white"
        onKeyDown={handleKeyDown}
      >
        {formContent}
      </SheetContent>
    </Sheet>
  );
}
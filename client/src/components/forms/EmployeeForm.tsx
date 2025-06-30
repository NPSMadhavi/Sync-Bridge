import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmployeeSchema, insertDependentSchema, Employee } from "@shared/schema";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { format, isAfter, isBefore } from "date-fns";
import { Loader2, Users, FileText, Upload, Plus, Trash2, User, Shield, Building, AlertTriangle } from "lucide-react";
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
  passportExpiry: z.date().optional().nullable(),
  visaNumber: z.string().optional(),
  visaExpiry: z.date().optional().nullable(),
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
  joinDate: z.date({ required_error: "Join date is required" }),
  status: z.enum(["active", "resigned", "on_hold", "terminated"]),
  passportNumber: z.string().optional(),
  passportExpiry: z.date().optional().nullable(),
  visaNumber: z.string().optional(),
  visaExpiry: z.date().optional().nullable(),
  visaType: z.enum(["s_pass", "work_permit", "employment_pass", "pr", "dependent_pass", "ltvp", "student_pass", "other"]).optional().nullable(),
  visaRemarks: z.string().optional(),
  passportScan: z.string().optional(),
  visaScan: z.string().optional(),
  nricScan: z.string().optional(),
  dependents: z.array(dependentSchema).optional(),
}).refine((data) => {
  // Validate that visa expiry is after passport expiry
  if (data.passportExpiry && data.visaExpiry) {
    return isAfter(data.visaExpiry, data.passportExpiry);
  }
  return true;
}, {
  message: "Visa expiry must be after passport expiry",
  path: ["visaExpiry"],
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

interface EmployeeFormProps {
  employee?: Employee;
  isOpen: boolean;
  onClose: () => void;
}

export default function EmployeeForm({ employee, isOpen, onClose }: EmployeeFormProps) {
  const { toast } = useToast();
  const [isEditMode] = useState(!!employee);
  const isExpired = employee?.passportExpiry && isBefore(employee.passportExpiry, new Date());
  
  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      employeeId: employee?.employeeId || "",
      name: employee?.name || "",
      department: employee?.department || "",
      designation: employee?.designation || "",
      joinDate: employee?.joinDate || new Date(),
      status: employee?.status || "active",
      passportNumber: employee?.passportNumber || "",
      passportExpiry: employee?.passportExpiry || null,
      visaNumber: employee?.visaNumber || "",
      visaExpiry: employee?.visaExpiry || null,
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
      const response = await apiRequest("POST", "/api/employees", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      form.reset();
      onClose();
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
      const response = await apiRequest("PUT", `/api/employees/${employee!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      onClose();
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
  const onSubmit = (values: EmployeeFormData) => {
    // Auto-set status based on document expiry
    const updatedValues = { ...values };
    if (values.passportExpiry && isBefore(values.passportExpiry, new Date())) {
      // Could add logic here for expired document handling
    }

    if (employee) {
      updateMutation.mutate(updatedValues);
    } else {
      createMutation.mutate(updatedValues);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right"
        className="w-full max-w-[1200px] p-0 overflow-hidden sm:max-w-[900px] md:max-w-[1000px] lg:max-w-[1200px]"
        onKeyDown={handleKeyDown}
      >
        <TooltipProvider>
          <Form {...form}>
            <div className="h-full flex flex-col">
              {/* Header */}
              <SheetHeader className="flex-shrink-0 px-8 py-4 border-b bg-background">
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

              {/* Form Content - Scrollable Area */}
              <div className="flex-1 overflow-y-auto px-8 py-6 pb-24">
                {/* Responsive grid layout container */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl mx-auto">
                
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
                                  date={field.value}
                                  setDate={field.onChange}
                                  placeholder="Select join date"
                                  max={new Date().toISOString().split('T')[0]}
                                  min="1900-01-01"
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                When did the employee join the company
                              </FormDescription>
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
                          render={({ field }) => {
                            const isPassportExpired = field.value && isBefore(field.value, new Date());
                            
                            return (
                              <FormItem className="flex flex-col">
                                <FormLabel className="flex items-center gap-2">
                                  Passport Expiry
                                  {isPassportExpired && (
                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                                      Expired
                                    </span>
                                  )}
                                </FormLabel>
                                <FormControl>
                                  <SimpleDatePicker
                                    date={field.value}
                                    setDate={field.onChange}
                                    placeholder="Select passport expiry"
                                    min="1900-01-01"
                                  />
                                </FormControl>
                                <FormDescription className={cn(
                                  "text-xs",
                                  isPassportExpired && "text-red-600"
                                )}>
                                  {isPassportExpired 
                                    ? "Passport has expired - renewal required"
                                    : "When does the passport expire"
                                  }
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />

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
                              <FormLabel>Visa/Work Permit Number</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., WP1234567"
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Visa or work permit reference number
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Visa Expiry */}
                        <FormField
                          control={form.control}
                          name="visaExpiry"
                          render={({ field }) => {
                            const isVisaExpired = field.value && isBefore(field.value, new Date());
                            const passportExpiry = form.watch("passportExpiry");
                            
                            return (
                              <FormItem className="flex flex-col">
                                <FormLabel className="flex items-center gap-2">
                                  Visa Expiry
                                  {isVisaExpired && (
                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                                      Expired
                                    </span>
                                  )}
                                </FormLabel>
                                <FormControl>
                                  <SimpleDatePicker
                                    date={field.value}
                                    setDate={field.onChange}
                                    placeholder="Select visa expiry date"
                                  />
                                </FormControl>
                                <FormDescription className={cn(
                                  "text-xs",
                                  isVisaExpired && "text-red-600"
                                )}>
                                  {isVisaExpired 
                                    ? "Visa has expired - renewal required"
                                    : "When does the visa expire"
                                  }
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
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
                                <Input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
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

                      {/* Visa Scan */}
                      <FormField
                        control={form.control}
                        name="visaScan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Visa/Work Permit Scan</FormLabel>
                            <FormControl>
                              <div className="flex flex-col gap-2">
                                <Input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
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

                      {/* NRIC Scan */}
                      <FormField
                        control={form.control}
                        name="nricScan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NRIC/ID Scan (Optional)</FormLabel>
                            <FormControl>
                              <div className="flex flex-col gap-2">
                                <Input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
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
                              Upload NRIC or ID copy (optional)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                                          date={field.value}
                                          setDate={field.onChange}
                                          placeholder="Select passport expiry date"
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
                                          date={field.value}
                                          setDate={field.onChange}
                                          placeholder="Select visa expiry date"
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
                        onClose();
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
      </SheetContent>
    </Sheet>
  );
}
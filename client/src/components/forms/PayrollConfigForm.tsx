import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, DollarSign, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const payrollConfigSchema = z.object({
  employeeId: z.number().min(1, "Please select an employee"),
  baseSalary: z.string().min(1, "Base salary is required"),
  payrollPeriod: z.enum(["monthly", "bi_weekly", "weekly"]),
  hourlyRate: z.string().optional(),
  overtimeRate: z.string().optional(),
  taxRate: z.string().default("0.00"),
  cpfRate: z.string().default("20.00"),
  isActive: z.boolean().default(true),
  effectiveFrom: z.string().min(1, "Effective from date is required"),
  effectiveTo: z.string().optional(),
});

type PayrollConfigFormData = z.infer<typeof payrollConfigSchema>;

interface PayrollConfig {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeEmail: string;
  department: string;
  designation: string;
  baseSalary: string;
  payrollPeriod: 'monthly' | 'bi_weekly' | 'weekly';
  hourlyRate?: string;
  overtimeRate?: string;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  taxRate: string;
  cpfRate: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  department: string;
  designation: string;
}

interface PayrollConfigFormProps {
  isOpen: boolean;
  onClose: () => void;
  config?: PayrollConfig | null;
}

export function PayrollConfigForm({ isOpen, onClose, config }: PayrollConfigFormProps) {
  const { toast } = useToast();
  const isEditMode = !!config;
  
  const [allowances, setAllowances] = useState<Record<string, number>>(
    config?.allowances || {}
  );
  const [deductions, setDeductions] = useState<Record<string, number>>(
    config?.deductions || {}
  );
  const [newAllowanceName, setNewAllowanceName] = useState("");
  const [newDeductionName, setNewDeductionName] = useState("");

  // Fetch employees for dropdown
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const form = useForm<PayrollConfigFormData>({
    resolver: zodResolver(payrollConfigSchema),
    defaultValues: {
      employeeId: config?.employeeId || 0,
      baseSalary: config?.baseSalary || "",
      payrollPeriod: config?.payrollPeriod || "monthly",
      hourlyRate: config?.hourlyRate || "",
      overtimeRate: config?.overtimeRate || "",
      taxRate: config?.taxRate || "0.00",
      cpfRate: config?.cpfRate || "20.00",
      isActive: config?.isActive ?? true,
      effectiveFrom: config?.effectiveFrom || new Date().toISOString().split('T')[0],
      effectiveTo: config?.effectiveTo || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/payroll/configs", {
        ...data,
        allowances,
        deductions,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary"] });
      toast({
        title: "Success",
        description: "Payroll configuration created successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create payroll configuration",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/payroll/configs/${config!.id}`, {
        ...data,
        allowances,
        deductions,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary"] });
      toast({
        title: "Success",
        description: "Payroll configuration updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update payroll configuration",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PayrollConfigFormData) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const addAllowance = () => {
    if (newAllowanceName.trim()) {
      setAllowances(prev => ({
        ...prev,
        [newAllowanceName]: 0
      }));
      setNewAllowanceName("");
    }
  };

  const updateAllowance = (name: string, value: number) => {
    setAllowances(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const removeAllowance = (name: string) => {
    setAllowances(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
  };

  const addDeduction = () => {
    if (newDeductionName.trim()) {
      setDeductions(prev => ({
        ...prev,
        [newDeductionName]: 0
      }));
      setNewDeductionName("");
    }
  };

  const updateDeduction = (name: string, value: number) => {
    setDeductions(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const removeDeduction = (name: string) => {
    setDeductions(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
    }).format(amount || 0);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right"
        className="w-full max-w-[800px] p-0 overflow-hidden"
      >
        <Form {...form}>
          <div className="h-full flex flex-col">
            {/* Header */}
            <SheetHeader className="flex-shrink-0 px-6 py-4 border-b bg-background">
              <SheetTitle className="flex items-center gap-2 text-xl">
                <Calculator className="h-5 w-5 text-primary" />
                {isEditMode ? "Edit Payroll Configuration" : "Create Payroll Configuration"}
              </SheetTitle>
            </SheetHeader>

            {/* Form Content - Scrollable Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <DollarSign className="h-4 w-4" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    
                    {/* Employee Selection */}
                    <FormField
                      control={form.control}
                      name="employeeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employee*</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(parseInt(value))} 
                            value={field.value?.toString()}
                            disabled={isEditMode}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select employee" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {employees?.map((employee) => (
                                <SelectItem key={employee.id} value={employee.id.toString()}>
                                  <div>
                                    <div className="font-medium">{employee.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {employee.designation} • {employee.department}
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      {/* Base Salary */}
                      <FormField
                        control={form.control}
                        name="baseSalary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base Salary (SGD)*</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="5000.00"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>Monthly base salary</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Payroll Period */}
                      <FormField
                        control={form.control}
                        name="payrollPeriod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payroll Period*</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="bi_weekly">Bi-weekly</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Hourly Rate */}
                      <FormField
                        control={form.control}
                        name="hourlyRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hourly Rate (SGD)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="25.00"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>For hourly calculations</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Overtime Rate */}
                      <FormField
                        control={form.control}
                        name="overtimeRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Overtime Rate (SGD)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="37.50"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>1.5x hourly rate typically</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Tax Rate */}
                      <FormField
                        control={form.control}
                        name="taxRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax Rate (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="7.00"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>Singapore income tax rate</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* CPF Rate */}
                      <FormField
                        control={form.control}
                        name="cpfRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF Rate (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="20.00"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>Singapore CPF contribution</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Effective From */}
                      <FormField
                        control={form.control}
                        name="effectiveFrom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Effective From*</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Effective To */}
                      <FormField
                        control={form.control}
                        name="effectiveTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Effective To</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormDescription>Leave empty for no end date</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Active Status */}
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active Configuration</FormLabel>
                            <FormDescription>
                              Whether this payroll configuration is currently active
                            </FormDescription>
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
                  </CardContent>
                </Card>

                {/* Allowances */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Allowances</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(allowances).map(([name, amount]) => (
                      <div key={name} className="flex items-center gap-2">
                        <Badge variant="outline" className="min-w-fit">
                          {name}
                        </Badge>
                        <Input
                          type="number"
                          step="0.01"
                          value={amount}
                          onChange={(e) => updateAllowance(name, parseFloat(e.target.value) || 0)}
                          className="flex-1"
                          placeholder="0.00"
                        />
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(amount)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAllowance(name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    <div className="flex gap-2">
                      <Input
                        placeholder="Allowance name (e.g., Transport, Meal)"
                        value={newAllowanceName}
                        onChange={(e) => setNewAllowanceName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addAllowance()}
                      />
                      <Button type="button" onClick={addAllowance}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Deductions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Additional Deductions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(deductions).map(([name, amount]) => (
                      <div key={name} className="flex items-center gap-2">
                        <Badge variant="outline" className="min-w-fit">
                          {name}
                        </Badge>
                        <Input
                          type="number"
                          step="0.01"
                          value={amount}
                          onChange={(e) => updateDeduction(name, parseFloat(e.target.value) || 0)}
                          className="flex-1"
                          placeholder="0.00"
                        />
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(amount)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDeduction(name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    <div className="flex gap-2">
                      <Input
                        placeholder="Deduction name (e.g., Loan, Insurance)"
                        value={newDeductionName}
                        onChange={(e) => setNewDeductionName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addDeduction()}
                      />
                      <Button type="button" onClick={addDeduction}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 border-t bg-background px-6 py-4">
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {isEditMode ? "Update Configuration" : "Create Configuration"}
                </Button>
              </div>
            </div>
          </div>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
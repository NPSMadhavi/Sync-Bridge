import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input, NumberInput } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StringDatePicker } from "@/components/ui/string-date-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertPayrollRecordSchema } from "@shared/schema";
import { Calculator, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  calculateAgeFromDob,
  mapEmployeeResidency,
} from "@shared/singapore-payroll";

const processPayrollSchema = z.object({
  employeeId: z.coerce.number().min(1, "Please select an employee"),
  payPeriodStart: z.string().min(1, "Start date is required"),
  payPeriodEnd: z.string().min(1, "End date is required"),
  overtimeHours: z.coerce.number().min(0, "Overtime hours must be positive").default(0),
  notes: z.string().optional(),
});

type ProcessPayrollFormData = z.infer<typeof processPayrollSchema>;

interface ProcessPayrollFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ProcessPayrollForm({ onSuccess, onCancel }: ProcessPayrollFormProps) {
  const { toast } = useToast();
  const [isCalculating, setIsCalculating] = useState(false);
  const [payrollCalculation, setPayrollCalculation] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  // Get user and tenant context
  const { user, isLoading: userLoading, error: userError } = useAuth();
  const tenantId = user?.tenantId;

  // Show loading or error state for user context
  if (userLoading) {
    return <div>Loading user...</div>;
  }
  if (userError || !user) {
    return <div className="text-red-600">Unable to load user context. Please log in again.</div>;
  }

  // Only enable queries if user is available (allow super admins without tenantId)
  const {
    data: payrollConfigs = [],
    isLoading: configsLoading,
    isError: configsError,
  } = useQuery<any[]>({
    queryKey: ["/api/payroll/configs", tenantId],
    queryFn: () => apiRequest("GET", `/api/payroll/configs`).then(res => res.json()),
    enabled: !!user && (!!tenantId || user.isSuperAdmin || user.role === 'super_admin'),
  });

  const {
    data: employees = [],
    isLoading: employeesLoading,
    isError: employeesError,
  } = useQuery<any[]>({
    queryKey: ["/api/employees", tenantId],
    queryFn: () => apiRequest("GET", `/api/employees`).then(res => res.json()),
    enabled: !!user && (!!tenantId || user.isSuperAdmin || user.role === 'super_admin'),
  });

  // Debug logging
  console.log('ProcessPayrollForm - Payroll Configs:', payrollConfigs);
  console.log('ProcessPayrollForm - Employees:', employees);
  console.log('ProcessPayrollForm - Configs Loading:', configsLoading);
  console.log('ProcessPayrollForm - Employees Loading:', employeesLoading);
  console.log('ProcessPayrollForm - Tenant ID:', tenantId);

  const form = useForm<ProcessPayrollFormData>({
    resolver: zodResolver(processPayrollSchema),
    defaultValues: {
      overtimeHours: 0,
      payPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      payPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    },
  });

  const processPayrollMutation = useMutation({
    mutationFn: async (data: ProcessPayrollFormData) => {
      // Validate required data
      if (!payrollCalculation) {
        throw new Error("Please calculate payroll first");
      }
      if (!selectedEmployee || !selectedEmployee.payrollConfig) {
        throw new Error("No employee or payroll configuration selected.");
      }

      // Ensure all numeric fields are properly converted to numbers
      const breakdown = payrollCalculation.breakdown || {};
      const allowances = breakdown.allowances ? Object.fromEntries(Object.entries(breakdown.allowances).map(([k, v]) => [k, Number(v)])) : {};
      const deductions = breakdown.deductions ? Object.fromEntries(Object.entries(breakdown.deductions).map(([k, v]) => [k, Number(v)])) : {};

      const payload = {
        employeeId: Number(data.employeeId),
        payrollConfigId: Number(selectedEmployee.payrollConfig.id),
        payPeriodStart: data.payPeriodStart,
        payPeriodEnd: data.payPeriodEnd,
        baseSalary: Number(breakdown.baseSalary || 0),
        overtimeHours: Number(data.overtimeHours || 0),
        overtimePay: Number(breakdown.overtimePay || 0),
        allowances,
        deductions,
        grossPay: Number(payrollCalculation.grossPay || 0),
        taxDeduction: 0,
        cpfDeduction: Number(payrollCalculation.employeeCpf || 0),
        netPay: Number(payrollCalculation.netPay || 0),
        status: 'pending',
        notes: data.notes || '',
      };

      console.log('Process Payroll Payload:', payload);
      console.log('Payload types:', Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, typeof v])));

      const res = await apiRequest("POST", "/api/payroll/records", payload);
      
      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          throw new Error("Server error: " + text.slice(0, 200));
        }
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to process payroll");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/records", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary", tenantId] });
      toast({
        title: "Payroll Processed Successfully - Ready for Export",
        description: "Payroll record has been saved and is ready for export.",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      console.error('Process payroll error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process payroll",
        variant: "destructive",
      });
    },
  });

  // Calculate payroll when employee or overtime changes
  const calculatePayroll = async () => {
    const formData = form.getValues();
    
    if (!formData.employeeId) {
      toast({
        title: "Error",
        description: "Please select an employee first",
        variant: "destructive",
      });
      return;
    }

    setIsCalculating(true);
    
    try {
      // Find employee and their payroll config
      const employee = employees.find((emp: any) => emp.id === formData.employeeId);
      const payrollConfig = payrollConfigs.find((config: any) => config.employeeId === formData.employeeId && config.isActive);
      
      if (!employee || !payrollConfig) {
        toast({
          title: "Error",
          description: "Employee or payroll configuration not found",
          variant: "destructive",
        });
        setPayrollCalculation(null);
        setIsCalculating(false);
        return;
      }

      setSelectedEmployee({ ...employee, payrollConfig });

      const age = calculateAgeFromDob(employee.dateOfBirth);
      const { residencyType, prYear } = mapEmployeeResidency(employee);

      const calculationInput = {
        grossSalary: Number(payrollConfig.baseSalary),
        age,
        citizenshipStatus: residencyType,
        prYear: residencyType === "pr" ? prYear : null,
        monthlyAllowances: payrollConfig.allowances || {},
        monthlyDeductions: payrollConfig.deductions || {},
        overtimeHours: Number(formData.overtimeHours) || 0,
        overtimeRate: Number(payrollConfig.overtimeRate) || 0,
      };

      console.log('Calculating payroll with input:', calculationInput);

      const res = await apiRequest("POST", "/api/payroll/calculate", calculationInput);
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Backend calculation error');
      }
      
      const calculation = await res.json();
      console.log('Payroll calculation result:', calculation);
      setPayrollCalculation(calculation);
    } catch (error: any) {
      console.error('Calculation error:', error);
      toast({
        title: "Calculation Error",
        description: error.message || "Unable to calculate payroll",
        variant: "destructive",
      });
      setPayrollCalculation(null);
    } finally {
      setIsCalculating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
    }).format(amount);
  };

  const watchedEmployeeId = form.watch("employeeId");
  const watchedOvertimeHours = form.watch("overtimeHours");

  useEffect(() => {
    if (!watchedEmployeeId) {
      setPayrollCalculation(null);
      setSelectedEmployee(null);
      return;
    }

    if (!employees.length || !payrollConfigs.length) return;

    void calculatePayroll();
  }, [watchedEmployeeId, watchedOvertimeHours, employees, payrollConfigs]);

  const onSubmit = (data: ProcessPayrollFormData) => {
    console.log('Submitting process payroll form:', data);
    processPayrollMutation.mutate(data);
  };

  // Show loading states
  if (employeesLoading || configsLoading) {
    return <div>Loading payroll data...</div>;
  }

  if (employeesError || configsError) {
    return <div className="text-red-600">Error loading payroll data. Please try again.</div>;
  }

  if (employees.length === 0) {
    return <div className="text-yellow-600">No employees found. Please add employees first.</div>;
  }

  if (payrollConfigs.length === 0) {
    return <div className="text-yellow-600">No payroll configurations found. Please create payroll configurations first.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Process Monthly Payroll</h2>
          <p className="text-muted-foreground">
            Calculate and process employee payroll with Singapore CPF compliance
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Employee Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Employee & Pay Period</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee *</FormLabel>
                        <Select
                          value={field.value?.toString()}
                          onValueChange={(value) => {
                            field.onChange(parseInt(value));
                            setPayrollCalculation(null); // Reset calculation when employee changes
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee to process payroll" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employeesLoading ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading employees...</div>
                            ) : employeesError ? (
                              <div className="px-2 py-1.5 text-sm text-red-600">Error loading employees.</div>
                            ) : employees.length === 0 ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">No employees available.</div>
                            ) : (
                              payrollConfigs
                              .filter((config: any) => config.isActive)
                              .map((config: any) => {
                                const employee = employees.find((emp: any) => emp.id === config.employeeId);
                                  // Use a truly unique key for each SelectItem
                                  const uniqueKey = employee ? `${config.id}-${employee.id}-${employee.email || employee.name}` : `${config.id}-${config.employeeId}`;
                                return employee ? (
                                    <SelectItem key={uniqueKey} value={config.employeeId.toString()}>
                                    {employee.name} - {employee.designation} ({formatCurrency(parseFloat(config.baseSalary))}/month)
                                  </SelectItem>
                                ) : null;
                                })
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="payPeriodStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pay Period Start *</FormLabel>
                          <FormControl>
                            <StringDatePicker value={field.value || ""} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payPeriodEnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pay Period End *</FormLabel>
                          <FormControl>
                            <StringDatePicker value={field.value || ""} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Overtime Hours */}
              <Card>
                <CardHeader>
                  <CardTitle>Additional Hours & Adjustments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="overtimeHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Overtime Hours (Max 72 hours/month per MOM)</FormLabel>
                        <FormControl>
                          <NumberInput 
                            step="0.5" 
                            max="72"
                            placeholder="0" 
                            {...field}
                            onChange={(e) => {
                              field.onChange(parseFloat(e.target.value) || 0);
                              setPayrollCalculation(null); // Reset calculation when overtime changes
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add any notes or remarks for this payroll period..."
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end gap-4">
              <div className="flex gap-2">
      
        </div>
                <Button 
                  type="submit" 
                  disabled={processPayrollMutation.isPending || !payrollCalculation}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {processPayrollMutation.isPending 
                    ? "Processing..." 
                    : "Process Payroll"
                  }
                </Button>
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* Payroll calculation panels — existing summary + Singapore CPF/tax */}
        <div className="lg:col-span-1 space-y-4">
          {/* <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {payrollCalculation ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                )}
                Payroll Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payrollCalculation ? (
                <div className="space-y-4">
                  {selectedEmployee && (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                      <div><strong>Name:</strong> {selectedEmployee.name}</div>
                      <div><strong>Employee ID:</strong> {selectedEmployee.employeeId}</div>
                      <div><strong>Department:</strong> {selectedEmployee.department}</div>
                      <div><strong>Designation:</strong> {selectedEmployee.designation}</div>
                    </div>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Monthly Salary:</span>
                      <span className="font-medium">{formatCurrency(payrollCalculation.breakdown?.baseSalary || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overtime Pay:</span>
                      <span className="font-medium">{formatCurrency(payrollCalculation.breakdown?.overtimePay || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Allowances:</span>
                      <span className="font-medium">{formatCurrency(payrollCalculation.allowancesTotal || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deductions:</span>
                      <span className="font-medium text-red-600">-{formatCurrency(payrollCalculation.deductionsTotal || 0)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Annual Income:</span>
                      <span>{formatCurrency(payrollCalculation.annualTaxableIncome || payrollCalculation.annualSalary || 0)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Annual Tax:</span>
                      <span>-{formatCurrency(payrollCalculation.annualTax || 0)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Monthly Tax:</span>
                      <span>-{formatCurrency(payrollCalculation.monthlyTaxDeduction || 0)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold text-lg">
                      <span>Net Salary:</span>
                      <span className="text-green-600">{formatCurrency(payrollCalculation.netPay || 0)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-6">
                  <Calculator className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select an employee and calculate payroll to see the summary.</p>
                </div>
              )}
            </CardContent>
          </Card> */}

          <Card>
            <CardHeader>
              <CardTitle>Singapore Payroll Calculation</CardTitle>
            </CardHeader>
            <CardContent>
              {payrollCalculation ? (
                <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Monthly Salary</span>
                        <span className="font-medium">{formatCurrency(payrollCalculation.breakdown?.baseSalary || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Allowance</span>
                        <span>{formatCurrency(payrollCalculation.allowancesTotal || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Deductions</span>
                        <span className="text-red-600">-{formatCurrency(payrollCalculation.deductionsTotal || 0)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Gross Salary</span>
                        <span>{formatCurrency(payrollCalculation.grossPay || 0)}</span>
                      </div>
                      {/* Tax reference (not displayed / not deducted):
                      <div className="flex justify-between">
                        <span>Tax ({payrollCalculation.taxRatePercent?.toFixed(2) ?? 0}%)</span>
                        <span className="text-red-600">-{formatCurrency(payrollCalculation.monthlyTaxDeduction || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax Amount</span>
                        <span className="text-red-600">-{formatCurrency(payrollCalculation.monthlyTax || 0)}</span>
                      </div>
                      */}
                      <div className="flex justify-between">
                        <span>CPF Rate (Employee)</span>
                        <span>{payrollCalculation.employeeCpfRate ?? 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CPF Amount (Employee)</span>
                        <span className="text-red-600">-{formatCurrency(payrollCalculation.employeeCpf || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CPF Rate (Employer)</span>
                        <span>{payrollCalculation.employerCpfRate ?? 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CPF Amount (Employer)</span>
                        <span>{formatCurrency(payrollCalculation.employerCpf || 0)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-bold text-lg">
                        <span>Net Salary</span>
                        <span className="text-green-600">{formatCurrency(payrollCalculation.netPay || 0)}</span>
                      </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-6 text-sm">
                  Calculate payroll to see Singapore CPF breakdown.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input, NumberInput } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StringDatePicker } from "@/components/ui/string-date-picker";
import { EmployeeSearchSelect } from "@/components/ui/employee-search-select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { processIndividualPayrollForConfig, getLastCompletedPayPeriod, findPayrollRecordForPeriod, hasPayrollDataChanged, derivePayrollMonthYear, resolveEffectiveMonthlySalary, isPayPeriodEligibleForProcessing, PAYROLL_CURRENT_MONTH_ERROR } from "@/lib/payroll-batch-utils";
import { insertPayrollRecordSchema } from "@shared/schema";
import { Calculator, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  calculateAgeFromDob,
  mapEmployeeResidency,
} from "@shared/singapore-payroll";
import { FormSheetFooter, formSheetCancelClass, formSheetBlueSubmitClass } from "@/components/ui/form-sheet-footer";

const processPayrollSchema = z.object({
  employeeId: z.coerce.number().min(1, "Please select an employee"),
  payPeriodStart: z.string().min(1, "Start date is required"),
  payPeriodEnd: z.string().min(1, "End date is required"),
  overtimeHours: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? 0 : val),
    z.coerce.number().min(0, "Overtime hours must be positive")
  ),
  notes: z.string().optional(),
});

type ProcessPayrollFormData = z.infer<typeof processPayrollSchema>;

interface ProcessPayrollFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  isOpen?: boolean;
}

type ProcessedDialogMode = "overwrite" | "no-changes" | null;

export default function ProcessPayrollForm({ onSuccess, onCancel, isOpen = true }: ProcessPayrollFormProps) {
  const { toast } = useToast();
  const [isCalculating, setIsCalculating] = useState(false);
  const [payrollCalculation, setPayrollCalculation] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [processedDialogOpen, setProcessedDialogOpen] = useState(false);
  const [processedDialogMode, setProcessedDialogMode] = useState<ProcessedDialogMode>(null);
  const [pendingFormData, setPendingFormData] = useState<ProcessPayrollFormData | null>(null);

  // Get user and tenant context
  const { user, isLoading: userLoading, error: userError } = useAuth();
  const tenantId = user?.tenantId;

  const {
    data: payrollConfigs = [],
    isLoading: configsLoading,
    isError: configsError,
  } = useQuery<any[]>({
    queryKey: ["/api/payroll/configs", tenantId],
    queryFn: () => apiRequest("GET", `/api/payroll/configs`).then(res => res.json()),
    enabled: isOpen && !!user && (!!tenantId || user.isSuperAdmin || user.role === 'super_admin'),
    refetchOnMount: "always",
  });

  const {
    data: employees = [],
    isLoading: employeesLoading,
    isError: employeesError,
  } = useQuery<any[]>({
    queryKey: ["/api/employees", tenantId],
    queryFn: () => apiRequest("GET", `/api/employees`).then(res => res.json()),
    enabled: isOpen && !!user && (!!tenantId || user.isSuperAdmin || user.role === 'super_admin'),
    refetchOnMount: "always",
  });

  const { data: payrollRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll/records", tenantId],
    queryFn: () => apiRequest("GET", `/api/payroll/records`).then(res => res.json()),
    enabled: isOpen && !!user && (!!tenantId || user.isSuperAdmin || user.role === 'super_admin'),
    refetchOnMount: "always",
  });

  const form = useForm<ProcessPayrollFormData>({
    resolver: zodResolver(processPayrollSchema),
    defaultValues: {
      ...getLastCompletedPayPeriod(),
    },
  });

  const watchedEmployeeId = form.watch("employeeId");
  const watchedOvertimeHours = form.watch("overtimeHours");
  const watchedPayPeriodStart = form.watch("payPeriodStart");
  const watchedPayPeriodEnd = form.watch("payPeriodEnd");
  const dialogPayPeriodStart = pendingFormData?.payPeriodStart ?? form.watch("payPeriodStart");
  const dialogMonthLabel = derivePayrollMonthYear(dialogPayPeriodStart).monthLabel;

  const openProcessedDialog = (data: ProcessPayrollFormData, dataChanged: boolean) => {
    setPendingFormData(data);
    setProcessedDialogMode(dataChanged ? "overwrite" : "no-changes");
    setProcessedDialogOpen(true);
  };

  const closeProcessedDialog = () => {
    setProcessedDialogOpen(false);
    setProcessedDialogMode(null);
    setPendingFormData(null);
  };

  const resolvePayrollChangeStatus = (data: ProcessPayrollFormData) => {
    const payrollConfig = payrollConfigs.find(
      (config: any) => config.employeeId === data.employeeId && config.isActive
    );
    const employee = employees.find((emp: any) => emp.id === data.employeeId);
    const effectiveConfig = payrollConfig
      ? {
          ...payrollConfig,
          baseSalary: resolveEffectiveMonthlySalary(employee, payrollConfig),
        }
      : payrollConfig;
    const existingRecord = findPayrollRecordForPeriod(
      data.employeeId,
      payrollRecords,
      data.payPeriodStart,
      data.payPeriodEnd
    );

    if (!existingRecord) {
      return { alreadyProcessed: false, dataChanged: false };
    }

    return {
      alreadyProcessed: true,
      dataChanged: hasPayrollDataChanged(
        effectiveConfig,
        existingRecord,
        Number(data.overtimeHours) || 0,
        payrollCalculation
      ),
    };
  };

  const processPayrollMutation = useMutation({
    mutationFn: async (data: ProcessPayrollFormData & { forceOverwrite?: boolean }) => {
      if (!payrollCalculation) {
        throw new Error("Please calculate payroll first");
      }
      if (!selectedEmployee || !selectedEmployee.payrollConfig) {
        throw new Error("No employee or payroll configuration selected.");
      }

      const result = await processIndividualPayrollForConfig(
        selectedEmployee.payrollConfig,
        data.payPeriodStart,
        data.payPeriodEnd,
        Number(data.overtimeHours) || 0,
        data.notes || "",
        { forceOverwrite: data.forceOverwrite === true }
      );

      if ("alreadyProcessed" in result && result.alreadyProcessed) {
        return {
          alreadyProcessed: true as const,
          dataChanged: result.dataChanged === true,
        };
      }

      if (!result.ok) {
        throw new Error(result.message || "Failed to process payroll");
      }

      return result;
    },
    onSuccess: (result, variables) => {
      if (result && "alreadyProcessed" in result && result.alreadyProcessed) {
        if (variables.forceOverwrite) {
          toast({
            title: "Overwrite failed",
            description: "Could not regenerate the payslip. Please try again.",
            variant: "destructive",
          });
          return;
        }

        const formData = pendingFormData ?? variables;
        openProcessedDialog(formData, result.dataChanged === true);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/payroll/records", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary", tenantId] });
      closeProcessedDialog();
      const wasUpdated = "action" in result && result.action === "updated";
      toast({
        title: wasUpdated ? "Payroll Updated Successfully" : "Payroll Processed Successfully",
        description: wasUpdated
          ? "The payslip has been regenerated and downloaded successfully."
          : "Payroll saved and payslip downloaded automatically.",
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

      const effectiveSalary = resolveEffectiveMonthlySalary(employee, payrollConfig);
      const effectiveConfig = { ...payrollConfig, baseSalary: effectiveSalary };

      setSelectedEmployee({ ...employee, payrollConfig: effectiveConfig });

      const age = calculateAgeFromDob(employee.dateOfBirth);
      const { residencyType, prYear } = mapEmployeeResidency(employee);
      const periodStart = formData.payPeriodStart
        ? new Date(formData.payPeriodStart)
        : new Date();
      const contributionMonth = periodStart.getMonth() + 1;
      const contributionYear = periodStart.getFullYear();

      const calculationInput = {
        grossSalary: effectiveSalary,
        age,
        citizenshipStatus: residencyType,
        prYear: residencyType === "pr" ? prYear : null,
        prRateType: "GG" as const,
        dateOfBirth: employee.dateOfBirth,
        contributionMonth,
        contributionYear,
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

  useEffect(() => {
    if (!watchedEmployeeId) {
      setPayrollCalculation(null);
      setSelectedEmployee(null);
      return;
    }

    if (!employees.length || !payrollConfigs.length) return;

    void calculatePayroll();
  }, [watchedEmployeeId, watchedOvertimeHours, watchedPayPeriodStart, watchedPayPeriodEnd, employees, payrollConfigs]);

  const handleProcessClick = () => {
    const { payPeriodStart, payPeriodEnd } = form.getValues();

    if (!isPayPeriodEligibleForProcessing(payPeriodStart, payPeriodEnd)) {
      toast({
        title: "Payroll not allowed",
        description: PAYROLL_CURRENT_MONTH_ERROR,
      });
      return;
    }

    if (!payrollCalculation) {
      toast({
        title: "Payroll not calculated",
        description: "Please select an employee to calculate payroll first.",
      });
      return;
    }

    form.handleSubmit(onSubmit)();
  };

  const onSubmit = (data: ProcessPayrollFormData) => {
    const { alreadyProcessed } = resolvePayrollChangeStatus(data);

    if (alreadyProcessed) {
      openProcessedDialog(data, true);
      return;
    }

    processPayrollMutation.mutate(data);
  };

  const handleConfirmOverwrite = () => {
    const formData = pendingFormData ?? form.getValues();
    if (!formData?.employeeId) {
      toast({
        title: "Error",
        description: "Form data is unavailable. Please close the dialog and try again.",
        variant: "destructive",
      });
      return;
    }
    processPayrollMutation.mutate({ ...formData, forceOverwrite: true });
  };

  if (userLoading) {
    return <div>Loading user...</div>;
  }
  if (userError || !user) {
    return <div className="text-red-600">Unable to load user context. Please log in again.</div>;
  }

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
    <>
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 py-6">
        <div className="lg:col-span-2">
          <Form {...form}>
            <div className="space-y-6">
              {/* Employee Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Employee & Pay Period</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => {
                      const payrollEmployeeOptions = payrollConfigs
                        .filter((config: any) => config.isActive)
                        .map((config: any) => {
                          const employee = employees.find((emp: any) => emp.id === config.employeeId);
                          if (!employee) return null;
                          return {
                            id: employee.id,
                            name: employee.name,
                            employeeId: employee.employeeId,
                            designation: employee.designation,
                            department: employee.department,
                            detail: `${employee.designation || "—"} (${formatCurrency(resolveEffectiveMonthlySalary(employee, config))}/month)`,
                          };
                        })
                        .filter(Boolean) as Array<{
                          id: number;
                          name: string;
                          employeeId?: string;
                          designation?: string;
                          department?: string;
                          detail: string;
                        }>;

                      return (
                      <FormItem>
                        <FormLabel>Employee *</FormLabel>
                        <FormControl>
                          <EmployeeSearchSelect
                            employees={payrollEmployeeOptions}
                            value={field.value ? field.value.toString() : ""}
                            onValueChange={(value) => {
                              field.onChange(parseInt(value, 10));
                              setPayrollCalculation(null);
                            }}
                            placeholder="Select employee to process payroll"
                            subtitle="designation"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                      );
                    }}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="payPeriodStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pay Period Start *</FormLabel>
                          <FormControl>
                            <StringDatePicker
                              value={field.value || ""}
                              onChange={field.onChange}
                            />
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
                            <StringDatePicker
                              value={field.value || ""}
                              onChange={field.onChange}
                            />
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
                            placeholder=""
                            value={field.value ?? ""}
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            onChange={(e) => {
                              const val = e.target.value;
                              field.onChange(val === "" ? undefined : parseFloat(val));
                              setPayrollCalculation(null);
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
            </div>
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

      <FormSheetFooter>
        <Button type="button" variant="outline" className={formSheetCancelClass} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          className={formSheetBlueSubmitClass}
          disabled={processPayrollMutation.isPending}
          onClick={handleProcessClick}
        >
          {processPayrollMutation.isPending ? "Processing..." : "Process Payroll"}
        </Button>
      </FormSheetFooter>
    </div>

      <Dialog
        open={processedDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeProcessedDialog();
          else setProcessedDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-md bg-white border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Payroll Already Processed</DialogTitle>
            <div className="space-y-2 pt-2 text-sm text-gray-600">
              <p>
                Payroll for{" "}
                <span className="font-semibold text-gray-900">{dialogMonthLabel}</span> has already
                been processed.
              </p>
              {processedDialogMode === "overwrite" && (
                <p>
                  {pendingFormData &&
                  resolvePayrollChangeStatus(pendingFormData).dataChanged
                    ? "Payroll values have been modified since the last run."
                    : "You can re-process and overwrite the existing payslip."}
                </p>
              )}
              <p>Do you want to overwrite the existing payslip and regenerate it?</p>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeProcessedDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmOverwrite}
              disabled={processPayrollMutation.isPending}
            >
              {processPayrollMutation.isPending ? "Processing..." : "Yes, Proceed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

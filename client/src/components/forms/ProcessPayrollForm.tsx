import { useState } from "react";
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
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertPayrollRecordSchema } from "@shared/schema";
import { CalendarIcon, Calculator, CheckCircle, AlertTriangle } from "lucide-react";

const processPayrollSchema = z.object({
  employeeId: z.coerce.number().min(1, "Please select an employee"),
  payPeriodStart: z.string().min(1, "Start date is required"),
  payPeriodEnd: z.string().min(1, "End date is required"),
  overtimeHours: z.coerce.number().min(0).default(0),
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

  // Fetch employee payroll configurations
  const { data: payrollConfigs = [], isLoading: configsLoading } = useQuery({
    queryKey: ["/api/employee-payroll"],
  });

  // Fetch employees for dropdown
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees"],
  });

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
      if (!payrollCalculation) {
        throw new Error("Please calculate payroll first");
      }

      const payload = {
        employeeId: data.employeeId,
        payrollConfigId: selectedEmployee.payrollConfig.id,
        payPeriodStart: data.payPeriodStart,
        payPeriodEnd: data.payPeriodEnd,
        baseSalary: payrollCalculation.breakdown.baseSalary,
        overtimeHours: data.overtimeHours,
        overtimePay: payrollCalculation.breakdown.overtimePay,
        allowances: payrollCalculation.breakdown.allowances,
        deductions: payrollCalculation.breakdown.deductions,
        grossPay: payrollCalculation.grossPay,
        taxDeduction: payrollCalculation.monthlyTaxDeduction,
        cpfDeduction: payrollCalculation.employeeCpf,
        netPay: payrollCalculation.netPay,
        status: 'pending',
        notes: data.notes,
      };

      const res = await apiRequest("POST", "/api/payroll-records", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-records"] });
      toast({
        title: "Success",
        description: "Payroll processed successfully and sent for approval",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
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
        throw new Error("Employee or payroll configuration not found");
      }

      setSelectedEmployee({ ...employee, payrollConfig });

      // Calculate age from date of birth for CPF calculations
      const today = new Date();
      const birthDate = new Date(employee.dateOfBirth || '1990-01-01');
      const age = today.getFullYear() - birthDate.getFullYear();
      
      // Determine citizenship status from visa type or default to citizen
      const citizenshipStatus = employee.visaType === 'employment_pass' || employee.visaType === 'work_permit' || employee.visaType === 's_pass' 
        ? 'foreigner' 
        : employee.visaType === 'pr' 
        ? 'pr' 
        : 'citizen';

      const calculationInput = {
        grossSalary: parseFloat(payrollConfig.baseSalary),
        age,
        citizenshipStatus,
        cpfStatus: 'full',
        monthlyAllowances: payrollConfig.allowances || {},
        monthlyDeductions: payrollConfig.deductions || {},
        overtimeHours: formData.overtimeHours,
        overtimeRate: parseFloat(payrollConfig.overtimeRate || '0'),
      };

      const res = await apiRequest("POST", "/api/payroll/calculate", calculationInput);
      const calculation = await res.json();
      setPayrollCalculation(calculation);
      
      toast({
        title: "Calculation Complete",
        description: "Singapore payroll calculation completed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Calculation Error",
        description: error.message,
        variant: "destructive",
      });
      setPayrollCalculation(null);
    } finally {
      setIsCalculating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
    }).format(amount);
  };

  const onSubmit = (data: ProcessPayrollFormData) => {
    processPayrollMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Process Monthly Payroll</h2>
          <p className="text-muted-foreground">
            Calculate and process employee payroll with Singapore CPF and tax compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={calculatePayroll}
            disabled={isCalculating || !form.watch("employeeId")}
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isCalculating ? "Calculating..." : "Calculate Payroll"}
          </Button>
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
                            {payrollConfigs
                              .filter((config: any) => config.isActive)
                              .map((config: any) => {
                                const employee = employees.find((emp: any) => emp.id === config.employeeId);
                                return employee ? (
                                  <SelectItem key={config.employeeId} value={config.employeeId.toString()}>
                                    {employee.name} - {employee.designation} ({formatCurrency(parseFloat(config.baseSalary))}/month)
                                  </SelectItem>
                                ) : null;
                              })}
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
                            <Input type="date" {...field} />
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
                            <Input type="date" {...field} />
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
                          <Input 
                            type="number" 
                            step="0.5" 
                            max="72"
                            placeholder="0" 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
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
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
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
              </div>
            </form>
          </Form>
        </div>

        {/* Payroll Calculation Preview */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {payrollCalculation ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                )}
                Singapore Payroll Calculation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payrollCalculation ? (
                <div className="space-y-4">
                  {selectedEmployee && (
                    <div className="border-b pb-3">
                      <h4 className="font-medium">{selectedEmployee.name}</h4>
                      <p className="text-sm text-muted-foreground">{selectedEmployee.designation}</p>
                      <Badge variant="outline" className="mt-1">
                        {selectedEmployee.payrollConfig.payrollPeriod}
                      </Badge>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Earnings</h4>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>Base Salary:</span>
                          <span>{formatCurrency(payrollCalculation.breakdown.baseSalary)}</span>
                        </div>
                        {payrollCalculation.breakdown.overtimePay > 0 && (
                          <div className="flex justify-between">
                            <span>Overtime Pay:</span>
                            <span>{formatCurrency(payrollCalculation.breakdown.overtimePay)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Allowances:</span>
                          <span>+{formatCurrency(payrollCalculation.allowancesTotal)}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Gross Pay:</span>
                          <span>{formatCurrency(payrollCalculation.grossPay)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Deductions</h4>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>Employee CPF:</span>
                          <span className="text-red-600">-{formatCurrency(payrollCalculation.employeeCpf)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Income Tax:</span>
                          <span className="text-red-600">-{formatCurrency(payrollCalculation.monthlyTaxDeduction)}</span>
                        </div>
                        {payrollCalculation.otherDeductions > 0 && (
                          <div className="flex justify-between">
                            <span>Other Deductions:</span>
                            <span className="text-red-600">-{formatCurrency(payrollCalculation.otherDeductions)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <hr />
                    
                    <div className="flex justify-between font-bold text-lg">
                      <span>Net Pay:</span>
                      <span className="text-green-600">{formatCurrency(payrollCalculation.netPay)}</span>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">CPF Breakdown</h4>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span>Ordinary Account:</span>
                          <span>{formatCurrency(payrollCalculation.cpfOrdinaryAccount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Special Account:</span>
                          <span>{formatCurrency(payrollCalculation.cpfSpecialAccount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Medisave:</span>
                          <span>{formatCurrency(payrollCalculation.cpfMediSave)}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Employer CPF:</span>
                          <span>{formatCurrency(payrollCalculation.employerCpf)}</span>
                        </div>
                      </div>
                    </div>

                    {payrollCalculation.breakdown.taxBracket && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Tax Information</h4>
                        <Badge variant="outline" className="text-xs">
                          {payrollCalculation.breakdown.taxBracket}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select an employee and click "Calculate Payroll" to see Singapore payroll breakdown</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
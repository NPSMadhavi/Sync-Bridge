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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertEmployeePayrollSchema } from "@shared/schema";
import { CalendarIcon, InfoIcon } from "lucide-react";

const payrollConfigSchema = insertEmployeePayrollSchema.extend({
  citizenshipStatus: z.enum(["citizen", "pr", "foreigner"]),
  age: z.coerce.number().min(16, "Employee must be at least 16 years old"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  allowanceTransport: z.coerce.number().default(0),
  allowanceMeal: z.coerce.number().default(0),
  allowancePhone: z.coerce.number().default(0),
  allowanceOthers: z.coerce.number().default(0),
  deductionMedical: z.coerce.number().default(0),
  deductionAdvance: z.coerce.number().default(0),
  deductionOthers: z.coerce.number().default(0),
});

type PayrollConfigFormData = z.infer<typeof payrollConfigSchema>;

interface PayrollConfigFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editData?: any;
}

export default function PayrollConfigForm({ onSuccess, onCancel, editData }: PayrollConfigFormProps) {
  const { toast } = useToast();
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationPreview, setCalculationPreview] = useState<any>(null);

  // Fetch employees for dropdown
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees"],
  });

  const form = useForm<PayrollConfigFormData>({
    resolver: zodResolver(payrollConfigSchema),
    defaultValues: {
      baseSalary: 0,
      payrollPeriod: "monthly",
      hourlyRate: 0,
      overtimeRate: 0,
      citizenshipStatus: "citizen",
      age: 25,
      dateOfBirth: "",
      allowanceTransport: 0,
      allowanceMeal: 0,
      allowancePhone: 0,
      allowanceOthers: 0,
      deductionMedical: 0,
      deductionAdvance: 0,
      deductionOthers: 0,
      isActive: true,
      effectiveFrom: new Date().toISOString().split('T')[0],
      ...editData,
    },
  });

  const createPayrollConfigMutation = useMutation({
    mutationFn: async (data: PayrollConfigFormData) => {
      const { age, citizenshipStatus, dateOfBirth, allowanceTransport, allowanceMeal, allowancePhone, allowanceOthers, deductionMedical, deductionAdvance, deductionOthers, ...payrollData } = data;
      
      const allowances = {
        transport: allowanceTransport || 0,
        meal: allowanceMeal || 0,
        phone: allowancePhone || 0,
        others: allowanceOthers || 0,
      };
      
      const deductions = {
        medical: deductionMedical || 0,
        advance: deductionAdvance || 0,
        others: deductionOthers || 0,
      };

      const payload = {
        ...payrollData,
        allowances,
        deductions,
        // Calculate Singapore-compliant CPF rates based on age and citizenship
        cpfRate: citizenshipStatus === 'foreigner' ? 0 : getCPFRate(age),
        taxRate: getTaxRate(data.baseSalary * 12), // Annual salary for tax calculation
      };

      const res = await apiRequest("POST", "/api/employee-payroll", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-payroll"] });
      toast({
        title: "Success",
        description: "Payroll configuration created successfully",
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

  // Calculate live preview of Singapore payroll
  const calculatePreview = async () => {
    const formData = form.getValues();
    setIsCalculating(true);
    
    try {
      const allowances = {
        transport: formData.allowanceTransport || 0,
        meal: formData.allowanceMeal || 0,
        phone: formData.allowancePhone || 0,
        others: formData.allowanceOthers || 0,
      };
      
      const deductions = {
        medical: formData.deductionMedical || 0,
        advance: formData.deductionAdvance || 0,
        others: formData.deductionOthers || 0,
      };

      const calculationInput = {
        grossSalary: formData.baseSalary,
        age: formData.age,
        citizenshipStatus: formData.citizenshipStatus,
        cpfStatus: 'full',
        monthlyAllowances: allowances,
        monthlyDeductions: deductions,
        overtimeHours: 0,
        overtimeRate: formData.overtimeRate || 0,
      };

      const res = await apiRequest("POST", "/api/payroll/calculate", calculationInput);
      const calculation = await res.json();
      setCalculationPreview(calculation);
    } catch (error) {
      toast({
        title: "Calculation Error",
        description: "Unable to calculate payroll preview",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  function getCPFRate(age: number): string {
    if (age < 50) return "20.00";
    if (age < 55) return "20.00";
    if (age < 60) return "13.00";
    if (age < 65) return "7.50";
    if (age < 70) return "5.00";
    return "5.00";
  }

  function getTaxRate(annualSalary: number): string {
    if (annualSalary <= 20000) return "0.00";
    if (annualSalary <= 30000) return "2.00";
    if (annualSalary <= 40000) return "3.50";
    if (annualSalary <= 80000) return "7.00";
    if (annualSalary <= 120000) return "11.50";
    if (annualSalary <= 160000) return "15.00";
    if (annualSalary <= 200000) return "18.00";
    return "22.00";
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
    }).format(amount);
  };

  const onSubmit = (data: PayrollConfigFormData) => {
    createPayrollConfigMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">
            {editData ? "Edit" : "Add"} Payroll Configuration
          </h2>
          <p className="text-muted-foreground">
            Configure employee payroll with Singapore CPF and tax compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={calculatePreview}
            disabled={isCalculating || !form.watch("baseSalary") || !form.watch("age")}
          >
            {isCalculating ? "Calculating..." : "Preview Calculation"}
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
                  <CardTitle>Employee Information</CardTitle>
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
                          onValueChange={(value) => field.onChange(parseInt(value))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employees.map((employee: any) => (
                              <SelectItem key={employee.id} value={employee.id.toString()}>
                                {employee.name} - {employee.designation}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age *</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="citizenshipStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Citizenship Status *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="citizen">Singapore Citizen</SelectItem>
                              <SelectItem value="pr">Permanent Resident</SelectItem>
                              <SelectItem value="foreigner">Foreigner</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth *</FormLabel>
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

              {/* Salary Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Salary Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="baseSalary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Salary (SGD) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="e.g., 5000.00"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payrollPeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pay Period *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
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
                              placeholder="e.g., 25.00"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="overtimeRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Overtime Rate (SGD/hour)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="e.g., 37.50"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Allowances */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Allowances (SGD)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="allowanceTransport"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transport Allowance</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="allowanceMeal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meal Allowance</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="allowancePhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Allowance</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="allowanceOthers"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Other Allowances</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Deductions */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Deductions (SGD)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="deductionMedical"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medical Insurance</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="deductionAdvance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Salary Advance</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="deductionOthers"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Other Deductions</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Effective Dates */}
              <Card>
                <CardHeader>
                  <CardTitle>Effective Period</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="effectiveFrom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective From *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="effectiveTo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective To (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
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
                          <FormLabel className="text-base">Active Configuration</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            This payroll configuration is currently active
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
                </CardContent>
              </Card>

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPayrollConfigMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {createPayrollConfigMutation.isPending 
                    ? "Creating..." 
                    : editData 
                    ? "Update Configuration" 
                    : "Create Configuration"
                  }
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* Calculation Preview */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <InfoIcon className="h-5 w-5" />
                Singapore Payroll Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {calculationPreview ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Gross Pay:</span>
                      <span className="font-medium">{formatCurrency(calculationPreview.grossPay)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm">Employee CPF:</span>
                      <span className="text-red-600">-{formatCurrency(calculationPreview.employeeCpf)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm">Income Tax:</span>
                      <span className="text-red-600">-{formatCurrency(calculationPreview.monthlyTaxDeduction)}</span>
                    </div>
                    
                    <hr />
                    
                    <div className="flex justify-between font-bold">
                      <span>Net Pay:</span>
                      <span className="text-green-600">{formatCurrency(calculationPreview.netPay)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">CPF Breakdown:</h4>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span>Ordinary Account:</span>
                        <span>{formatCurrency(calculationPreview.cpfOrdinaryAccount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Special Account:</span>
                        <span>{formatCurrency(calculationPreview.cpfSpecialAccount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Medisave:</span>
                        <span>{formatCurrency(calculationPreview.cpfMediSave)}</span>
                      </div>
                    </div>
                  </div>

                  {calculationPreview.breakdown.taxBracket && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Tax Information:</h4>
                      <div className="text-xs">
                        <Badge variant="outline">{calculationPreview.breakdown.taxBracket}</Badge>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <InfoIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Click "Preview Calculation" to see Singapore payroll breakdown</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect, useMemo } from "react";
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { StringDatePicker } from "@/components/ui/string-date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Info, Calculator } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  calculateSingaporePayrollSnapshot,
  calculateAgeFromDob,
  mapEmployeeResidency,
  mapPrStatusToYear,
  residencyLabel,
} from "@shared/singapore-payroll";

const payrollConfigFormSchema = z.object({
  employeeId: z.coerce.number().min(1, "Please select an employee"),
  baseSalary: z.coerce.number().min(0, "Base salary must be positive"),
  payrollPeriod: z.string().min(1, "Payroll period is required"),
  noOfWorkingDays: z.coerce.number().int().min(1, "No of working days is required"),
  hourlyRate: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0).optional()
  ),
  overtimeRate: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0).optional()
  ),
  citizenshipStatus: z.enum(["citizen", "pr", "foreigner"]),
  prStatus: z.string().optional(),
  age: z.coerce.number().min(16).max(100),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  allowanceTransport: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().min(0).optional()),
  allowanceMeal: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().min(0).optional()),
  allowancePhone: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().min(0).optional()),
  allowanceOthers: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().min(0).optional()),
  deductionMedical: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().min(0).optional()),
  deductionAdvance: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().min(0).optional()),
  deductionOthers: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().min(0).optional()),
  taxRate: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0).max(100).optional()
  ),
  isActive: z.boolean(),
  effectiveFrom: z.string().min(1, "Effective from date is required"),
  effectiveTo: z.string().optional(),
});

type PayrollConfigFormData = z.infer<typeof payrollConfigFormSchema>;

function mapEditDataToForm(editData: any): Partial<PayrollConfigFormData> {
  const allowances = editData?.allowances && typeof editData.allowances === "object" ? editData.allowances : {};
  const deductions = editData?.deductions && typeof editData.deductions === "object" ? editData.deductions : {};
  const { residencyType } = mapEmployeeResidency({
    nationality: editData?.nationality,
    prStatus: editData?.prStatus,
  });

  return {
    employeeId: editData?.employeeId ?? 0,
    baseSalary: parseFloat(editData?.baseSalary) || ("" as any),
    payrollPeriod: editData?.payrollPeriod || "monthly",
    noOfWorkingDays: editData?.noOfWorkingDays ?? ("" as any),
    hourlyRate: editData?.hourlyRate != null ? parseFloat(editData.hourlyRate) : undefined,
    overtimeRate: editData?.overtimeRate != null ? parseFloat(editData.overtimeRate) : undefined,
    citizenshipStatus: residencyType,
    prStatus: editData?.prStatus || "",
    age: editData?.dateOfBirth ? calculateAgeFromDob(editData.dateOfBirth) : ("" as any),
    dateOfBirth: editData?.dateOfBirth ? String(editData.dateOfBirth).split("T")[0] : "",
    allowanceTransport: allowances.transport ?? ("" as any),
    allowanceMeal: allowances.meal ?? ("" as any),
    allowancePhone: allowances.phone ?? ("" as any),
    allowanceOthers: allowances.others ?? ("" as any),
    deductionMedical: deductions.medical ?? ("" as any),
    deductionAdvance: deductions.advance ?? ("" as any),
    deductionOthers: deductions.others ?? ("" as any),
    taxRate: editData?.taxRate != null ? parseFloat(editData.taxRate) : ("" as any),
    isActive: editData?.isActive ?? true,
    effectiveFrom: editData?.effectiveFrom
      ? String(editData.effectiveFrom).split("T")[0]
      : new Date().toISOString().split("T")[0],
    effectiveTo: editData?.effectiveTo ? String(editData.effectiveTo).split("T")[0] : "",
  };
}

interface PayrollConfigFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editData?: any;
}

export default function PayrollConfigForm({ onSuccess, onCancel, editData }: PayrollConfigFormProps) {
  const { toast } = useToast();
  const { user, isLoading: userLoading, error: userError } = useAuth();
  const tenantId = user?.tenantId;
  const isEditMode = Boolean(editData?.id);

  const { data: employees = [], isLoading: employeesLoading, error: employeesError } = useQuery<any[]>({
    queryKey: ["/api/employees", tenantId],
    queryFn: () => apiRequest("GET", "/api/employees").then((r) => r.json()),
    enabled: !!user,
  });

  const form = useForm<PayrollConfigFormData>({
    resolver: zodResolver(payrollConfigFormSchema),
    defaultValues: editData?.id
      ? mapEditDataToForm(editData)
      : {
      employeeId: editData?.employeeId ?? 0,
      baseSalary: editData?.baseSalary ?? ("" as any),
      payrollPeriod: editData?.payrollPeriod || "monthly",
      noOfWorkingDays: editData?.noOfWorkingDays ?? ("" as any),
      hourlyRate: editData?.hourlyRate ?? undefined,
      overtimeRate: editData?.overtimeRate ?? undefined,
      citizenshipStatus: editData?.citizenshipStatus || "citizen",
      prStatus: editData?.prStatus || "",
      age: editData?.age ?? ("" as any),
      dateOfBirth: editData?.dateOfBirth || "",
      allowanceTransport: editData?.allowanceTransport ?? ("" as any),
      allowanceMeal: editData?.allowanceMeal ?? ("" as any),
      allowancePhone: editData?.allowancePhone ?? ("" as any),
      allowanceOthers: editData?.allowanceOthers ?? ("" as any),
      deductionMedical: editData?.deductionMedical ?? ("" as any),
      deductionAdvance: editData?.deductionAdvance ?? ("" as any),
      deductionOthers: editData?.deductionOthers ?? ("" as any),
      taxRate: editData?.taxRate ?? ("" as any),
      isActive: editData?.isActive ?? true,
      effectiveFrom: editData?.effectiveFrom || new Date().toISOString().split("T")[0],
      effectiveTo: editData?.effectiveTo || "",
    },
  });

  useEffect(() => {
    if (editData?.id) {
      form.reset(mapEditDataToForm(editData));
    }
  }, [editData?.id, form]);

  const watchedEmployeeId = form.watch("employeeId");
  const watchedSalary = form.watch("baseSalary");
  const watchedDOB = form.watch("dateOfBirth");
  const watchedCitizenship = form.watch("citizenshipStatus");
  const watchedPrStatus = form.watch("prStatus");
  const watchedAge = form.watch("age");
  const watchedAllowanceTransport = form.watch("allowanceTransport");
  const watchedAllowanceMeal = form.watch("allowanceMeal");
  const watchedAllowancePhone = form.watch("allowancePhone");
  const watchedAllowanceOthers = form.watch("allowanceOthers");
  const watchedDeductionMedical = form.watch("deductionMedical");
  const watchedDeductionAdvance = form.watch("deductionAdvance");
  const watchedDeductionOthers = form.watch("deductionOthers");

  useEffect(() => {
    if (isEditMode) return;
    if (!watchedEmployeeId) return;
    const emp = employees.find((e) => e.id === watchedEmployeeId);
    if (!emp) return;

    const { residencyType, prYear } = mapEmployeeResidency(emp);
    form.setValue("citizenshipStatus", residencyType, { shouldValidate: true });
    if (residencyType === "pr") {
      form.setValue("prStatus", emp.prStatus || "year_3_plus", { shouldValidate: true });
    } else {
      form.setValue("prStatus", "", { shouldValidate: true });
    }

    if (emp.dateOfBirth) {
      form.setValue("dateOfBirth", emp.dateOfBirth.split("T")[0], { shouldValidate: true });
      form.setValue("age", calculateAgeFromDob(emp.dateOfBirth), { shouldValidate: true });
    }

    if (emp.salary) {
      form.setValue("baseSalary", parseFloat(String(emp.salary)), { shouldValidate: true });
    }
  }, [watchedEmployeeId, employees, form, isEditMode]);

  useEffect(() => {
    if (!watchedDOB) return;
    form.setValue("age", calculateAgeFromDob(watchedDOB), { shouldValidate: true });
  }, [watchedDOB, form]);

  const allowanceTotal =
    (Number(watchedAllowanceTransport) || 0) +
    (Number(watchedAllowanceMeal) || 0) +
    (Number(watchedAllowancePhone) || 0) +
    (Number(watchedAllowanceOthers) || 0);
  const deductionTotal =
    (Number(watchedDeductionMedical) || 0) +
    (Number(watchedDeductionAdvance) || 0) +
    (Number(watchedDeductionOthers) || 0);
  const grossSalaryPreview =
    Number(watchedSalary) > 0
      ? Math.max(0, Number(watchedSalary) + allowanceTotal - deductionTotal)
      : 0;

  const payrollSnapshot = useMemo(() => {
    const salary = Number(watchedSalary);
    const age = Number(watchedAge);
    if (!salary || salary <= 0 || !age) return null;

    const { residencyType } = mapEmployeeResidency({
      nationality: watchedCitizenship,
      prStatus: watchedPrStatus,
    });
    const prYear =
      residencyType === "pr" ? mapPrStatusToYear(watchedPrStatus) : null;

    return calculateSingaporePayrollSnapshot({
      monthlySalary: salary,
      age,
      residencyType,
      prYear,
      monthlyAllowances: allowanceTotal,
      monthlyDeductions: deductionTotal,
    });
  }, [
    watchedSalary,
    watchedAge,
    watchedCitizenship,
    watchedPrStatus,
    allowanceTotal,
    deductionTotal,
  ]);

  useEffect(() => {
    if (payrollSnapshot) {
      form.setValue("taxRate", payrollSnapshot.effectiveTaxRate, { shouldValidate: false });
    }
  }, [payrollSnapshot, form]);

  const buildPayload = (data: PayrollConfigFormData) => {
    if (!payrollSnapshot) throw new Error("Unable to calculate payroll — check salary and age");

    const {
      age,
      citizenshipStatus,
      prStatus,
      dateOfBirth,
      allowanceTransport,
      allowanceMeal,
      allowancePhone,
      allowanceOthers,
      deductionMedical,
      deductionAdvance,
      deductionOthers,
      ...payrollData
    } = data;

    return {
      ...payrollData,
      allowances: {
        transport: Number(allowanceTransport) || 0,
        meal: Number(allowanceMeal) || 0,
        phone: Number(allowancePhone) || 0,
        others: Number(allowanceOthers) || 0,
      },
      deductions: {
        medical: Number(deductionMedical) || 0,
        advance: Number(deductionAdvance) || 0,
        others: Number(deductionOthers) || 0,
      },
      // Tax reference (not applied): payrollSnapshot.effectiveTaxRate, monthlyIncomeTax, annualIncomeTax
      taxRate: 0,
      taxAmount: 0,
      incomeTax: 0,
      cpfRate: payrollSnapshot.employeeCpfRate,
      cpfAmount: payrollSnapshot.monthlyEmployeeCpf,
      employerCpfRate: payrollSnapshot.employerCpfRate,
      employerCpfAmount: payrollSnapshot.monthlyEmployerCpf,
      netSalary: payrollSnapshot.netSalary,
    };
  };

  const saveMutation = useMutation({
    mutationFn: async (data: PayrollConfigFormData) => {
      if (!data.employeeId || !data.baseSalary || !data.effectiveFrom)
        throw new Error("Please fill in all required fields");

      const payload = buildPayload(data);

      if (isEditMode && editData?.id) {
        const res = await apiRequest("PUT", `/api/payroll/configs/${editData.id}`, payload);
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Failed to update payroll configuration");
        }
        return res.json();
      }

      const res = await apiRequest("POST", "/api/payroll/configs", payload);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to create payroll configuration");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/configs", tenantId] });
      toast({
        title: "Success",
        description: isEditMode
          ? "Payroll configuration updated successfully"
          : "Payroll configuration created successfully",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(n);

  const selectedEmployee = employees.find((e) => e.id === form.watch("employeeId"));

  if (userLoading) return <div>Loading user...</div>;
  if (userError || !user) return <div className="text-red-600">Unable to load user context. Please log in again.</div>;
  if (employeesLoading) return <div>Loading employees...</div>;
  if (employeesError) return <div className="text-red-600">Error loading employees. Please try again.</div>;
  if (employees.length === 0) return <div className="text-yellow-600">No employees found. Please add employees first.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{isEditMode ? "Edit Payroll Configuration" : "Create Payroll Configuration"}</h2>
        <p className="text-muted-foreground">
          Select an employee — CPF is calculated automatically from Employee Master data.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Employee Selection</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee *</FormLabel>
                        <Select
                          value={field.value?.toString()}
                          onValueChange={(v) => field.onChange(parseInt(v))}
                          disabled={isEditMode}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id.toString()}>
                                {emp.name} ({emp.employeeId}) — {emp.designation}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedEmployee && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
                      <div><p className="text-xs text-blue-600 font-medium">Employee ID</p><p className="font-semibold">{selectedEmployee.employeeId}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Employee Name</p><p className="font-semibold">{selectedEmployee.name}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Department</p><p className="font-semibold">{selectedEmployee.department}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Designation</p><p className="font-semibold">{selectedEmployee.designation}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Salary (Monthly)</p><p className="font-semibold">{selectedEmployee.salary ? formatCurrency(parseFloat(String(selectedEmployee.salary))) : "—"}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Annual Salary</p><p className="font-semibold">{selectedEmployee.salary ? formatCurrency(parseFloat(String(selectedEmployee.salary)) * 12) : "—"}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Nationality</p><p className="font-semibold">{residencyLabel(selectedEmployee.nationality, selectedEmployee.prStatus)}</p></div>
                      {mapEmployeeResidency(selectedEmployee).residencyType === "pr" && (
                        <div>
                          <p className="text-xs text-blue-600 font-medium">PR Status</p>
                          <p className="font-semibold">
                            {selectedEmployee.prStatus === "year_1"
                              ? "1 Year PR"
                              : selectedEmployee.prStatus === "year_2"
                              ? "2 Year PR"
                              : "3 Year PR and Above"}
                          </p>
                        </div>
                      )}
                      <div><p className="text-xs text-blue-600 font-medium">Date of Birth</p><p className="font-semibold">{selectedEmployee.dateOfBirth ? new Date(selectedEmployee.dateOfBirth).toLocaleDateString("en-GB") : "—"}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Age</p><p className="font-semibold">{form.watch("age") || "—"}</p></div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Payroll Setup</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="baseSalary"
                      render={({ field }) => (
                        <FormItem>
                       <FormLabel>
  Base Salary / Monthly Salary (SGD) *
</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              readOnly={!!selectedEmployee?.salary}
                              className={selectedEmployee?.salary ? "bg-muted cursor-not-allowed" : ""}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem>
                      <FormLabel>Annual Salary (Auto)</FormLabel>
                      <Input
                        readOnly
                        className="bg-muted"
                        value={watchedSalary > 0 ? formatCurrency(Number(watchedSalary) * 12) : "—"}
                      />
                      <FormDescription className="text-xs">Salary × 12</FormDescription>
                    </FormItem>
                    <FormField
                      control={form.control}
                      name="payrollPeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payroll Period *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger><SelectValue /></SelectTrigger>
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
                      name="noOfWorkingDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>No of Working Days *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              placeholder="e.g. 26"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value, 10) || "")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="hourlyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hourly Rate (SGD) <span className="text-xs text-muted-foreground">(optional)</span></FormLabel>
                          <FormControl>
                            <Input
                              type="number" step="0.01" placeholder="0.00"
                              {...field} value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
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
                          <FormLabel>Overtime Rate (SGD) <span className="text-xs text-muted-foreground">(optional)</span></FormLabel>
                          <FormControl>
                            <Input
                              type="number" step="0.01" placeholder="0.00"
                              {...field} value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div> */}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Employee Details (CPF)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="citizenshipStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Citizenship Status</FormLabel>
                        <div className="px-3 py-2 bg-muted rounded-md border text-sm min-h-[40px] flex items-center">
                          {field.value === "foreigner"
                            ? "Foreigner"
                            : field.value === "pr"
                            ? `PR — ${form.watch("prStatus")?.replace("year_", "").replace("_plus", "+") || "3+"}`
                            : field.value === "citizen"
                            ? "Singapore Citizen"
                            : "Select employee"}
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <StringDatePicker value={field.value || ""} onChange={field.onChange} disabled />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age</FormLabel>
                        <Input type="number" {...field} readOnly className="bg-muted" />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                    <div className="flex items-start gap-2">
                   
                      <p className="text-xs text-blue-800">
                        
                      </p>
                    </div>
                  </div> */}
                </CardContent>
              </Card>

              {/* Monthly Allowances — existing */}
              <Card>
                <CardHeader><CardTitle>Monthly Allowances</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { name: "allowanceTransport" as const, label: "Transport Allowance" },
                      { name: "allowanceMeal" as const, label: "Meal Allowance" },
                      { name: "allowancePhone" as const, label: "Phone Allowance" },
                      { name: "allowanceOthers" as const, label: "Other Allowances" },
                    ].map(({ name, label }) => (
                      <FormField key={name} control={form.control} name={name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="0.00"
                                {...field} value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Monthly Deductions — existing */}
              <Card>
                <CardHeader><CardTitle>Monthly Deductions</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { name: "deductionMedical" as const, label: "Medical Deduction" },
                      { name: "deductionAdvance" as const, label: "Advance Deduction" },
                      { name: "deductionOthers" as const, label: "Other Deductions" },
                    ].map(({ name, label }) => (
                      <FormField key={name} control={form.control} name={name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="0.00"
                                {...field} value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Auto-calculated payroll fields — existing */}
              {payrollSnapshot && (
                <Card>
                  <CardHeader><CardTitle>Auto-Calculated Payroll Values</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormItem>
                        <FormLabel>Gross Salary</FormLabel>
                        <Input
                          readOnly
                          className="bg-muted"
                          value={formatCurrency(grossSalaryPreview)}
                        />
                      </FormItem>
                      <FormItem>
                        <FormLabel>CPF Rate (Employee %)</FormLabel>
                        <Input readOnly className="bg-muted" value={`${payrollSnapshot.employeeCpfRate}%`} />
                      </FormItem>
                      <FormItem>
                        <FormLabel>CPF Amount (Employee)</FormLabel>
                        <Input readOnly className="bg-muted" value={formatCurrency(payrollSnapshot.monthlyEmployeeCpf)} />
                      </FormItem>
                      <FormItem>
                        <FormLabel>CPF Rate (Employer %)</FormLabel>
                        <Input readOnly className="bg-muted" value={`${payrollSnapshot.employerCpfRate}%`} />
                      </FormItem>
                      <FormItem>
                        <FormLabel>CPF Amount (Employer)</FormLabel>
                        <Input readOnly className="bg-muted" value={formatCurrency(payrollSnapshot.monthlyEmployerCpf)} />
                      </FormItem>
                      <FormItem>
                        <FormLabel>Net Salary (Monthly)</FormLabel>
                        <Input readOnly className="bg-muted" value={formatCurrency(payrollSnapshot.netSalary)} />
                      </FormItem>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle>Effective Dates</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="effectiveFrom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective From *</FormLabel>
                          <StringDatePicker value={field.value || ""} onChange={field.onChange} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="effectiveTo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective To</FormLabel>
                          <StringDatePicker value={field.value || ""} onChange={field.onChange} />
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
                        <FormLabel>Active Configuration</FormLabel>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending || !payrollSnapshot}>
                  {saveMutation.isPending
                    ? isEditMode ? "Updating..." : "Creating..."
                    : isEditMode ? "Update Payroll Configuration" : "Create Payroll Configuration"}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                CPF Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payrollSnapshot && selectedEmployee ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Salary</span><span className="font-medium">{formatCurrency(payrollSnapshot.monthlySalary)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Annual Income</span><span className="font-medium">{formatCurrency(payrollSnapshot.annualSalary)}</span></div>
                  <div className="flex justify-between"><span>Employee CPF ({payrollSnapshot.employeeCpfRate}%)</span><span>−{formatCurrency(payrollSnapshot.monthlyEmployeeCpf)}</span></div>
                  <div className="flex justify-between"><span>Employer CPF ({payrollSnapshot.employerCpfRate}%)</span><span>{formatCurrency(payrollSnapshot.monthlyEmployerCpf)}</span></div>
                  <div className="border-t pt-2 flex justify-between font-bold text-lg"><span>Net Salary</span><span className="text-green-600">{formatCurrency(payrollSnapshot.netSalary)}</span></div>
                  {/* Singapore tax preview reference (not shown):
                  chargeableIncome, annualIncomeTax, monthlyIncomeTax, taxBreakdown
                  */}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Calculator className="h-12 w-12 mx-auto opacity-30 mb-2" />
                  <p className="text-sm">Select an employee with salary and DOB to preview CPF.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

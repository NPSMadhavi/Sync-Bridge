import { useEffect, useMemo } from "react";
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
import { StringDatePicker } from "@/components/ui/string-date-picker";
import { EmployeeSearchSelect } from "@/components/ui/employee-search-select";
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
import { useAuth } from "@/hooks/use-auth";
import {
  calculateAgeFromDob,
  mapEmployeeResidency,
  residencyLabel,
} from "@shared/singapore-payroll";
import { usePayrollCalculationPreview } from "@/hooks/use-payroll-calculation-preview";
import PayrollCalculationPreviewPanel from "@/components/payroll/PayrollCalculationPreviewPanel";
import { FormSheetFooter, formSheetCancelClass, formSheetSubmitClass } from "@/components/ui/form-sheet-footer";

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
  age: z.coerce.number().optional(),
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

function toOptionalFormNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(num) || num === 0) return undefined;
  return num;
}

function toRequiredFormNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : undefined;
}

function mapEditDataToForm(editData: any): Partial<PayrollConfigFormData> {
  const allowances = editData?.allowances && typeof editData.allowances === "object" ? editData.allowances : {};
  const deductions = editData?.deductions && typeof editData.deductions === "object" ? editData.deductions : {};
  const { residencyType } = mapEmployeeResidency({
    nationality: editData?.nationality,
    prStatus: editData?.prStatus,
  });

  return {
    employeeId: editData?.employeeId ?? 0,
    baseSalary: toRequiredFormNumber(editData?.baseSalary) as any,
    payrollPeriod: editData?.payrollPeriod || "monthly",
    noOfWorkingDays: toRequiredFormNumber(editData?.noOfWorkingDays) as any,
    hourlyRate: toOptionalFormNumber(editData?.hourlyRate),
    overtimeRate: toOptionalFormNumber(editData?.overtimeRate),
    citizenshipStatus: residencyType,
    prStatus: editData?.prStatus || "",
    age: editData?.dateOfBirth ? calculateAgeFromDob(editData.dateOfBirth) : (undefined as any),
    dateOfBirth: editData?.dateOfBirth ? String(editData.dateOfBirth).split("T")[0] : "",
    allowanceTransport: toOptionalFormNumber(allowances.transport),
    allowanceMeal: toOptionalFormNumber(allowances.meal),
    allowancePhone: toOptionalFormNumber(allowances.phone),
    allowanceOthers: toOptionalFormNumber(allowances.others),
    deductionMedical: toOptionalFormNumber(deductions.medical),
    deductionAdvance: toOptionalFormNumber(deductions.advance),
    deductionOthers: toOptionalFormNumber(deductions.others),
    taxRate: toOptionalFormNumber(editData?.taxRate),
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
  const watchedOvertimeRate = form.watch("overtimeRate");

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

  const calculationInput = useMemo(() => {
    const salary = Number(watchedSalary);
    if (!salary || salary <= 0) return null;
    const age = Number(watchedAge) || undefined;

    const { residencyType, prYear } = mapEmployeeResidency({
      residencyType: watchedCitizenship,
      prStatus: watchedPrStatus,
    });

    return {
      grossSalary: salary,
      age,
      dateOfBirth: watchedDOB || null,
      citizenshipStatus: residencyType,
      prYear: residencyType === "pr" ? prYear : null,
      prRateType: "GG" as const,
      contributionMonth: new Date().getMonth() + 1,
      contributionYear: new Date().getFullYear(),
      monthlyAllowances: {
        transport: Number(watchedAllowanceTransport) || 0,
        meal: Number(watchedAllowanceMeal) || 0,
        phone: Number(watchedAllowancePhone) || 0,
        others: Number(watchedAllowanceOthers) || 0,
      },
      monthlyDeductions: {
        medical: Number(watchedDeductionMedical) || 0,
        advance: Number(watchedDeductionAdvance) || 0,
        others: Number(watchedDeductionOthers) || 0,
      },
      overtimeHours: 0,
      overtimeRate: Number(watchedOvertimeRate) || 0,
    };
  }, [
    watchedSalary,
    watchedAge,
    watchedDOB,
    watchedCitizenship,
    watchedPrStatus,
    watchedAllowanceTransport,
    watchedAllowanceMeal,
    watchedAllowancePhone,
    watchedAllowanceOthers,
    watchedDeductionMedical,
    watchedDeductionAdvance,
    watchedDeductionOthers,
    watchedOvertimeRate,
  ]);

  const { calculation, isLoading: isCalculating, error: calculationError } =
    usePayrollCalculationPreview(calculationInput);

  const buildPayload = (data: PayrollConfigFormData) => {
    if (!calculation) throw new Error("Unable to calculate payroll — check salary and date of birth");

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
      cpfRate: calculation.employeeCpfRate,
      cpfAmount: calculation.employeeCpf,
      employerCpfRate: calculation.employerCpfRate,
      employerCpfAmount: calculation.employerCpf,
      netSalary: calculation.netPay,
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
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: isEditMode
          ? "Payroll configuration updated successfully"
          : "Payroll configuration created successfully",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ description: error.message });
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
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 py-6">
        <div className="lg:col-span-2">
          <Form {...form}>
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Employee Selection</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee *</FormLabel>
                        <FormControl>
                          <EmployeeSearchSelect
                            employees={employees}
                            value={field.value ? field.value.toString() : ""}
                            onValueChange={(v) => field.onChange(parseInt(v, 10))}
                            disabled={isEditMode}
                            placeholder="Search employee..."
                            subtitle="designation"
                          />
                        </FormControl>
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
                          <FormLabel>Base Salary / Monthly Salary</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Enter monthly salary"
                              {...field}
                              value={field.value ?? ""}
                              readOnly={!!selectedEmployee?.salary}
                              className={selectedEmployee?.salary ? "bg-muted cursor-not-allowed" : ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === "" ? undefined : parseFloat(e.target.value)
                                )
                              }
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
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === "" ? undefined : parseInt(e.target.value, 10)
                                )
                              }
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
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <FormField
                    control={form.control}
                    name="citizenshipStatus"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Citizenship Status</FormLabel>
                        <FormControl>
                          <Input
                            readOnly
                            className="h-10 bg-muted cursor-default"
                            value={
                              field.value === "foreigner"
                                ? "Foreigner"
                                : field.value === "pr"
                                ? `PR — ${form.watch("prStatus")?.replace("year_", "").replace("_plus", "+") || "3+"}`
                                : field.value === "citizen"
                                ? "Singapore Citizen"
                                : "Select employee"
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <StringDatePicker
                            value={field.value || ""}
                            onChange={field.onChange}
                            disabled
                            className="h-10 w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Age</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            value={field.value ?? ""}
                            readOnly
                            className="h-10 w-full bg-muted"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Enter amount"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === "" ? undefined : parseFloat(e.target.value)
                                  )
                                }
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
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Enter amount"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === "" ? undefined : parseFloat(e.target.value)
                                  )
                                }
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

              {/* Auto-calculated payroll fields */}
              {calculation && (
                <Card>
                  <CardHeader><CardTitle>Auto-Calculated Payroll Values</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormItem>
                        <FormLabel>Gross Salary</FormLabel>
                        <Input
                          readOnly
                          className="bg-muted"
                          value={formatCurrency(calculation.grossPay || 0)}
                        />
                      </FormItem>
                      <FormItem>
                        <FormLabel>CPF Rate (Employee %)</FormLabel>
                        <Input readOnly className="bg-muted" value={`${calculation.employeeCpfRate}%`} />
                      </FormItem>
                      <FormItem>
                        <FormLabel>CPF Amount (Employee)</FormLabel>
                        <Input readOnly className="bg-muted" value={formatCurrency(calculation.employeeCpf || 0)} />
                      </FormItem>
                      <FormItem>
                        <FormLabel>CPF Rate (Employer %)</FormLabel>
                        <Input readOnly className="bg-muted" value={`${calculation.employerCpfRate}%`} />
                      </FormItem>
                      <FormItem>
                        <FormLabel>CPF Amount (Employer)</FormLabel>
                        <Input readOnly className="bg-muted" value={formatCurrency(calculation.employerCpf || 0)} />
                      </FormItem>
                      <FormItem>
                        <FormLabel>Net Salary (Monthly)</FormLabel>
                        <Input readOnly className="bg-muted" value={formatCurrency(calculation.netPay || 0)} />
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
            </div>
          </Form>
        </div>

        <div className="lg:col-span-1">
          <PayrollCalculationPreviewPanel
            className="sticky top-4"
            calculation={calculation}
            isLoading={isCalculating}
            error={calculationError}
            emptyMessage="Select an employee with salary and date of birth to preview CPF."
          />
        </div>
      </div>
      </div>

      <FormSheetFooter>
        <Button type="button" variant="outline" className={formSheetCancelClass} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          className={formSheetSubmitClass}
          disabled={saveMutation.isPending || !calculation || isCalculating}
          onClick={form.handleSubmit((d) => saveMutation.mutate(d))}
        >
          {saveMutation.isPending
            ? isEditMode ? "Updating..." : "Creating..."
            : isEditMode ? "Update" : "Create "}
        </Button>
      </FormSheetFooter>
    </div>
  );
}

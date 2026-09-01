import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  calculateAgeFromDob,
  mapEmployeeResidency,
  residencyLabel,
} from "@shared/singapore-payroll";
import {
  usePayrollCalculationPreview,
  type PayrollCalculationPreviewInput,
  type PayrollCalculationPreviewResult,
} from "@/hooks/use-payroll-calculation-preview";
import PayrollCalculationPreviewPanel from "@/components/payroll/PayrollCalculationPreviewPanel";
import { FormSheetFooter, formSheetCancelClass, formSheetSubmitClass } from "@/components/ui/form-sheet-footer";

const payrollConfigFormSchema = z.object({
  employeeId: z.preprocess(
    (val) => (val === "" || val === null || val === undefined || val === 0 ? undefined : Number(val)),
    z.number().min(1, "Please select an employee").optional()
  ),
  citizenshipStatus: z.enum(["citizen", "pr", "foreigner"]).optional(),
  prStatus: z.string().optional(),
  age: z.coerce.number().optional(),
  dateOfBirth: z.string().optional(),
});

type PayrollConfigFormData = z.infer<typeof payrollConfigFormSchema>;

type CompanyPayrollDraft = {
  companyId: number;
  companyName: string;
  salary: number;
  annualSalary: number;
  payrollPeriod: string;
  noOfWorkingDays: string;
  allowanceTransport?: number;
  allowanceMeal?: number;
  allowancePhone?: number;
  allowanceOthers?: number;
  deductionMedical?: number;
  deductionAdvance?: number;
  deductionOthers?: number;
  overtimeRate?: number;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
  configId?: number;
};

const EMPTY_DRAFT: CompanyPayrollDraft = {
  companyId: 0,
  companyName: "",
  salary: 0,
  annualSalary: 0,
  payrollPeriod: "monthly",
  noOfWorkingDays: "",
  effectiveFrom: new Date().toISOString().split("T")[0],
  effectiveTo: "",
  isActive: true,
};

function toOptionalFormNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(num) || num === 0) return undefined;
  return num;
}

function emptyDraftFromSalary(entry: {
  companyId: number;
  companyName: string;
  salary?: string | number | null;
  annualSalary?: string | number | null;
}): CompanyPayrollDraft {
  const monthly =
    entry.salary != null && entry.salary !== "" ? parseFloat(String(entry.salary)) : NaN;
  const annual =
    entry.annualSalary != null && entry.annualSalary !== ""
      ? parseFloat(String(entry.annualSalary))
      : Number.isFinite(monthly)
        ? monthly * 12
        : NaN;

  return {
    companyId: entry.companyId,
    companyName: entry.companyName,
    salary: Number.isFinite(monthly) ? monthly : 0,
    annualSalary: Number.isFinite(annual) ? annual : 0,
    payrollPeriod: "monthly",
    noOfWorkingDays: "",
    effectiveFrom: new Date().toISOString().split("T")[0],
    effectiveTo: "",
    isActive: true,
  };
}

function draftFromExistingConfig(
  entry: {
    companyId: number;
    companyName: string;
    salary?: string | number | null;
    annualSalary?: string | number | null;
  },
  config: any
): CompanyPayrollDraft {
  const allowances =
    config?.allowances && typeof config.allowances === "object" ? config.allowances : {};
  const deductions =
    config?.deductions && typeof config.deductions === "object" ? config.deductions : {};

  const draft = emptyDraftFromSalary(entry);
  return {
    ...draft,
    salary: config?.baseSalary != null ? Number(config.baseSalary) : draft.salary,
    payrollPeriod: config?.payrollPeriod || "monthly",
    noOfWorkingDays:
      config?.noOfWorkingDays != null ? String(config.noOfWorkingDays) : "",
    allowanceTransport: toOptionalFormNumber(allowances.transport),
    allowanceMeal: toOptionalFormNumber(allowances.meal),
    allowancePhone: toOptionalFormNumber(allowances.phone),
    allowanceOthers: toOptionalFormNumber(allowances.others),
    deductionMedical: toOptionalFormNumber(deductions.medical),
    deductionAdvance: toOptionalFormNumber(deductions.advance),
    deductionOthers: toOptionalFormNumber(deductions.others),
    overtimeRate: toOptionalFormNumber(config?.overtimeRate),
    effectiveFrom: config?.effectiveFrom
      ? String(config.effectiveFrom).split("T")[0]
      : draft.effectiveFrom,
    effectiveTo: config?.effectiveTo ? String(config.effectiveTo).split("T")[0] : "",
    isActive: config?.isActive ?? true,
    configId: config?.id,
  };
}

function CompanyCpfPreview({
  companyId,
  companyName,
  salary,
  calculationInputBase,
  onCalculation,
}: {
  companyId: number;
  companyName: string;
  salary: number;
  calculationInputBase: Omit<PayrollCalculationPreviewInput, "grossSalary"> | null;
  onCalculation: (companyId: number, calc: PayrollCalculationPreviewResult | null) => void;
}) {
  const input = useMemo(() => {
    if (!calculationInputBase || !salary || salary <= 0) return null;
    return { ...calculationInputBase, grossSalary: salary };
  }, [calculationInputBase, salary]);

  const { calculation, isLoading, isRefreshing, error } = usePayrollCalculationPreview(input);

  useEffect(() => {
    onCalculation(companyId, calculation);
  }, [companyId, calculation, onCalculation]);

  return (
    <PayrollCalculationPreviewPanel
      title={`CPF Preview — ${companyName}`}
      calculation={calculation}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      error={error}
      emptyMessage="Salary is required to preview CPF for this company."
    />
  );
}

function getCompanyDropdownLabel(
  entry: CompanyPayrollDraft,
  configuredCompanyIds: Set<number>
): string {
  if (configuredCompanyIds.has(entry.companyId)) {
    return `${entry.companyName} (Saved)`;
  }
  return entry.companyName;
}

function DebouncedNumberInput({
  value,
  onCommit,
  disabled,
  placeholder = "Enter amount",
}: {
  value?: number;
  onCommit: (value: number | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(
    value != null && !Number.isNaN(value) ? String(value) : ""
  );

  useEffect(() => {
    setText(value != null && !Number.isNaN(value) ? String(value) : "");
  }, [value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (text.trim() === "") {
        onCommit(undefined);
        return;
      }
      const parsed = parseFloat(text);
      if (!Number.isNaN(parsed)) {
        onCommit(parsed);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [text, onCommit]);

  return (
    <Input
      type="number"
      step="0.01"
      placeholder={placeholder}
      disabled={disabled}
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  );
}

function parseApiError(text: string): string {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === "string") return parsed.message;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => item?.message || "Validation error").join(", ");
    }
  } catch {
    // plain text
  }
  return text || "Something went wrong";
}

function buildCalculationInputForDraft(
  draft: CompanyPayrollDraft,
  employeeContext: {
    age?: number;
    dateOfBirth?: string;
    citizenshipStatus?: string;
    prStatus?: string;
  }
): PayrollCalculationPreviewInput | null {
  if (!draft.salary || draft.salary <= 0 || !employeeContext.citizenshipStatus) return null;

  const { residencyType, prYear } = mapEmployeeResidency({
    residencyType: employeeContext.citizenshipStatus,
    prStatus: employeeContext.prStatus,
  });

  return {
    grossSalary: draft.salary,
    age: employeeContext.age,
    dateOfBirth: employeeContext.dateOfBirth || null,
    citizenshipStatus: residencyType,
    prYear: residencyType === "pr" ? prYear : null,
    prRateType: "GG",
    contributionMonth: new Date().getMonth() + 1,
    contributionYear: new Date().getFullYear(),
    monthlyAllowances: {
      transport: Number(draft.allowanceTransport) || 0,
      meal: Number(draft.allowanceMeal) || 0,
      phone: Number(draft.allowancePhone) || 0,
      others: Number(draft.allowanceOthers) || 0,
    },
    monthlyDeductions: {
      medical: Number(draft.deductionMedical) || 0,
      advance: Number(draft.deductionAdvance) || 0,
      others: Number(draft.deductionOthers) || 0,
    },
    overtimeHours: 0,
    overtimeRate: Number(draft.overtimeRate) || 0,
  };
}

async function fetchCalculationForDraft(
  draft: CompanyPayrollDraft,
  employeeContext: {
    age?: number;
    dateOfBirth?: string;
    citizenshipStatus?: string;
    prStatus?: string;
  }
): Promise<PayrollCalculationPreviewResult> {
  const input = buildCalculationInputForDraft(draft, employeeContext);
  if (!input) {
    throw new Error(`Unable to calculate CPF for ${draft.companyName}`);
  }

  const res = await fetch("/api/payroll/calculate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(parseApiError(await res.text()));
  }

  return res.json();
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

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    editData?.companyId ?? null
  );
  const [companyDrafts, setCompanyDrafts] = useState<Record<number, CompanyPayrollDraft>>({});
  const [companyCalculations, setCompanyCalculations] = useState<
    Record<number, PayrollCalculationPreviewResult | null>
  >({});
  const [configuredCompanyIds, setConfiguredCompanyIds] = useState<Set<number>>(new Set());

  const { data: employees = [], isLoading: employeesLoading, error: employeesError } = useQuery<any[]>({
    queryKey: ["/api/employees", tenantId],
    queryFn: () => apiRequest("GET", "/api/employees").then((r) => r.json()),
    enabled: !!user,
  });

  const form = useForm<PayrollConfigFormData>({
    resolver: zodResolver(payrollConfigFormSchema),
    defaultValues: {
      employeeId: editData?.employeeId ?? undefined,
      citizenshipStatus: "citizen",
      prStatus: "",
      age: undefined,
      dateOfBirth: editData?.dateOfBirth ? String(editData.dateOfBirth).split("T")[0] : "",
    },
  });

  const watchedEmployeeId = form.watch("employeeId");
  const watchedDOB = form.watch("dateOfBirth");
  const watchedCitizenship = form.watch("citizenshipStatus");
  const watchedPrStatus = form.watch("prStatus");
  const watchedAge = form.watch("age");

  const selectedDraft = selectedCompanyId ? companyDrafts[selectedCompanyId] : null;
  const displayDraft = selectedDraft ?? EMPTY_DRAFT;
  const fieldsDisabled = !selectedDraft;
  const companyList = useMemo(() => Object.values(companyDrafts), [companyDrafts]);

  const updateSelectedDraft = useCallback(
    (updates: Partial<CompanyPayrollDraft>) => {
      if (!selectedCompanyId) return;
      setCompanyDrafts((prev) => ({
        ...prev,
        [selectedCompanyId]: { ...prev[selectedCompanyId], ...updates },
      }));
      setConfiguredCompanyIds((prev) => new Set(prev).add(selectedCompanyId));
    },
    [selectedCompanyId]
  );

  useEffect(() => {
    if (!watchedEmployeeId) {
      setCompanyDrafts({});
      setCompanyCalculations({});
      setConfiguredCompanyIds(new Set());
      setSelectedCompanyId(null);
      return;
    }

    const emp = employees.find((e) => e.id === watchedEmployeeId);
    if (!emp) return;

    const { residencyType } = mapEmployeeResidency(emp);
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

    void (async () => {
      try {
        const [salariesRes, configsRes] = await Promise.all([
          apiRequest("GET", `/api/employees/${emp.id}/company-salaries`),
          apiRequest("GET", `/api/payroll/configs?employeeId=${emp.id}`),
        ]);

        let salaries: Array<{
          companyId: number;
          companyName: string;
          salary?: string | number | null;
          annualSalary?: string | number | null;
        }> = [];

        if (salariesRes.ok) {
          const data = await salariesRes.json();
          if (Array.isArray(data) && data.length > 0) salaries = data;
        }

        if (salaries.length === 0 && emp.companyId) {
          salaries = [
            {
              companyId: emp.companyId,
              companyName: emp.companyName || "Company",
              salary: emp.salary,
              annualSalary: emp.salary ? Number(emp.salary) * 12 : null,
            },
          ];
        }

        const existingConfigs: any[] = configsRes.ok ? await configsRes.json() : [];
        const drafts: Record<number, CompanyPayrollDraft> = {};
        const legacyConfig =
          existingConfigs.length === 1 && !existingConfigs[0]?.companyId
            ? existingConfigs[0]
            : null;

        for (const [index, entry] of salaries.entries()) {
          const existing =
            existingConfigs.find(
              (c) => c.companyId != null && Number(c.companyId) === Number(entry.companyId)
            ) ?? (legacyConfig && index === 0 ? legacyConfig : undefined);
          drafts[entry.companyId] = existing
            ? draftFromExistingConfig(entry, existing)
            : emptyDraftFromSalary(entry);
        }

        if (isEditMode && editData?.companyId && editData?.id) {
          const editEntry = salaries.find((s) => s.companyId === editData.companyId) ?? {
            companyId: editData.companyId,
            companyName: editData.companyName || "Company",
            salary: editData.baseSalary,
          };
          drafts[editData.companyId] = draftFromExistingConfig(editEntry, editData);
        }

        setCompanyDrafts(drafts);

        const configured = new Set<number>();
        if (isEditMode) {
          for (const draft of Object.values(drafts)) {
            if (draft.configId) configured.add(draft.companyId);
          }
        }
        setConfiguredCompanyIds(configured);

        const initialCompanyId =
          (isEditMode && editData?.companyId) ||
          salaries[0]?.companyId ||
          null;
        setSelectedCompanyId(initialCompanyId ?? null);
      } catch {
        setCompanyDrafts({});
        setSelectedCompanyId(null);
      }
    })();
  }, [watchedEmployeeId, employees, form, isEditMode, editData?.id, editData?.companyId]);

  useEffect(() => {
    if (!watchedDOB) return;
    form.setValue("age", calculateAgeFromDob(watchedDOB), { shouldValidate: true });
  }, [watchedDOB, form]);

  const employeeContext = useMemo(
    () => ({
      age: Number(watchedAge) || undefined,
      dateOfBirth: watchedDOB || "",
      citizenshipStatus: watchedCitizenship,
      prStatus: watchedPrStatus,
    }),
    [watchedAge, watchedDOB, watchedCitizenship, watchedPrStatus]
  );

  const calculationInputBase = useMemo((): Omit<
    PayrollCalculationPreviewInput,
    "grossSalary"
  > | null => {
    if (!selectedDraft || !watchedCitizenship) return null;
    const input = buildCalculationInputForDraft(selectedDraft, employeeContext);
    if (!input) return null;
    const { grossSalary: _gross, ...rest } = input;
    return rest;
  }, [selectedDraft, employeeContext, watchedCitizenship]);

  const handleCompanyCalculation = useCallback(
    (companyId: number, calc: PayrollCalculationPreviewResult | null) => {
      setCompanyCalculations((prev) => ({ ...prev, [companyId]: calc }));
    },
    []
  );

  const buildPayload = (
    draft: CompanyPayrollDraft,
    calculation: PayrollCalculationPreviewResult
  ) => {
    if (!draft.salary || draft.salary <= 0) {
      throw new Error(`Valid salary is required for ${draft.companyName}.`);
    }
    if (!draft.effectiveFrom) {
      throw new Error(`Effective from date is required for ${draft.companyName}.`);
    }

    const workingDays = draft.noOfWorkingDays?.trim()
      ? parseInt(draft.noOfWorkingDays, 10)
      : undefined;

    const payload: Record<string, unknown> = {
      employeeId: watchedEmployeeId,
      companyId: draft.companyId,
      baseSalary: draft.salary,
      payrollPeriod: draft.payrollPeriod || "monthly",
      overtimeRate: draft.overtimeRate,
      allowances: {
        transport: Number(draft.allowanceTransport) || 0,
        meal: Number(draft.allowanceMeal) || 0,
        phone: Number(draft.allowancePhone) || 0,
        others: Number(draft.allowanceOthers) || 0,
      },
      deductions: {
        medical: Number(draft.deductionMedical) || 0,
        advance: Number(draft.deductionAdvance) || 0,
        others: Number(draft.deductionOthers) || 0,
      },
      taxRate: 0,
      taxAmount: 0,
      incomeTax: 0,
      cpfRate: calculation.employeeCpfRate,
      cpfAmount: calculation.employeeCpf,
      employerCpfRate: calculation.employerCpfRate,
      employerCpfAmount: calculation.employerCpf,
      netSalary: calculation.netPay,
      isActive: draft.isActive,
      effectiveFrom: draft.effectiveFrom,
      effectiveTo: draft.effectiveTo?.trim() ? draft.effectiveTo : null,
    };

    if (Number.isFinite(workingDays)) {
      payload.noOfWorkingDays = workingDays;
    }

    if (draft.configId) {
      payload.configId = draft.configId;
    }

    return payload;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!watchedEmployeeId) throw new Error("Please select an employee");
      if (companyList.length === 0) {
        throw new Error("No company salary details found for this employee.");
      }

      const notReady = companyList.filter((c) => !configuredCompanyIds.has(c.companyId));
      if (notReady.length > 0) {
        throw new Error(
          `Please enter payroll details for: ${notReady.map((d) => d.companyName).join(", ")}`
        );
      }

      const configs = [];
      for (const draft of companyList) {
        let calculation = companyCalculations[draft.companyId];
        if (!calculation) {
          calculation = await fetchCalculationForDraft(draft, employeeContext);
        }
        configs.push(buildPayload(draft, calculation));
      }

      const res = await apiRequest("POST", "/api/payroll/configs/batch", {
        employeeId: watchedEmployeeId,
        configs,
      });
      if (!res.ok) throw new Error(parseApiError(await res.text()));

      const data = await res.json();
      const saved = Array.isArray(data?.configs) ? data.configs : [];
      return saved.map((item: any, index: number) => ({
        companyId: companyList[index]?.companyId ?? Number(item.companyId),
        configId: Number(item.id),
      }));
    },
    onSuccess: (savedConfigs) => {
      setCompanyDrafts((prev) => {
        const next = { ...prev };
        for (const { companyId, configId } of savedConfigs) {
          if (next[companyId]) next[companyId] = { ...next[companyId], configId };
        }
        return next;
      });
      setConfiguredCompanyIds(new Set(savedConfigs.map((c) => c.companyId)));
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/configs", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Saved",
        description: `Payroll configuration saved for all ${savedConfigs.length} companies.`,
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ description: error.message });
    },
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(n);

  const selectedEmployee = employees.find((e) => e.id === watchedEmployeeId);

  const canSubmit =
    !!watchedEmployeeId &&
    companyList.length > 0 &&
    companyList.every((c) => configuredCompanyIds.has(c.companyId));

  if (userLoading) return <div>Loading user...</div>;
  if (userError || !user) return <div className="text-red-600">Unable to load user context. Please log in again.</div>;
  if (employeesLoading) return <div>Loading employees...</div>;
  if (employeesError) return <div className="text-red-600">Error loading employees. Please try again.</div>;
  if (employees.length === 0) return <div className="text-yellow-600">No employees found. Please add employees first.</div>;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 py-6 space-y-6">
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
                      <div><p className="text-xs text-blue-600 font-medium">Employee ID</p><p className="font-semibold">{selectedEmployee.employeeId}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Employee Name</p><p className="font-semibold">{selectedEmployee.name}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Department</p><p className="font-semibold">{selectedEmployee.department}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Designation</p><p className="font-semibold">{selectedEmployee.designation}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Nationality</p><p className="font-semibold">{residencyLabel(selectedEmployee.nationality, selectedEmployee.prStatus)}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Date of Birth</p><p className="font-semibold">{selectedEmployee.dateOfBirth ? new Date(selectedEmployee.dateOfBirth).toLocaleDateString("en-GB") : "—"}</p></div>
                      <div><p className="text-xs text-blue-600 font-medium">Age</p><p className="font-semibold">{form.watch("age") || "—"}</p></div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Company *</Label>
                    <Select
                      value={selectedCompanyId ? String(selectedCompanyId) : undefined}
                      onValueChange={(v) => setSelectedCompanyId(parseInt(v, 10))}
                      disabled={!selectedEmployee || companyList.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !selectedEmployee
                              ? "Select employee first..."
                              : companyList.length === 0
                                ? "No companies assigned"
                                : "Select company..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {companyList.map((entry) => (
                          <SelectItem key={entry.companyId} value={entry.companyId.toString()}>
                            {getCompanyDropdownLabel(entry, configuredCompanyIds)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Payroll Setup{displayDraft.companyName ? ` — ${displayDraft.companyName}` : ""}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Salary (Monthly)</p>
                        <p className="font-semibold">
                          {displayDraft.salary > 0 ? formatCurrency(displayDraft.salary) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Annual Salary</p>
                        <p className="font-semibold">
                          {displayDraft.annualSalary > 0 ? formatCurrency(displayDraft.annualSalary) : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Payroll Period *</Label>
                        <Select
                          value={displayDraft.payrollPeriod}
                          onValueChange={(value) => updateSelectedDraft({ payrollPeriod: value })}
                          disabled={fieldsDisabled}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="bi_weekly">Bi-weekly</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>No of Working Days</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          placeholder="e.g. 26"
                          value={displayDraft.noOfWorkingDays}
                          disabled={fieldsDisabled}
                          onChange={(e) =>
                            updateSelectedDraft({ noOfWorkingDays: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {selectedDraft ? (
                  <CompanyCpfPreview
                    companyId={selectedDraft.companyId}
                    companyName={selectedDraft.companyName}
                    salary={selectedDraft.salary}
                    calculationInputBase={calculationInputBase}
                    onCalculation={handleCompanyCalculation}
                  />
                ) : (
                  <PayrollCalculationPreviewPanel
                    title="CPF Preview"
                    calculation={null}
                    emptyMessage="Select employee and company to preview CPF calculations."
                  />
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Monthly Allowances{displayDraft.companyName ? ` — ${displayDraft.companyName}` : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: "allowanceTransport" as const, label: "Transport Allowance" },
                      { key: "allowanceMeal" as const, label: "Meal Allowance" },
                      { key: "allowancePhone" as const, label: "Phone Allowance" },
                      { key: "allowanceOthers" as const, label: "Other Allowances" },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <DebouncedNumberInput
                          disabled={fieldsDisabled}
                          value={displayDraft[key]}
                          onCommit={(amount) => updateSelectedDraft({ [key]: amount })}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Monthly Deductions{displayDraft.companyName ? ` — ${displayDraft.companyName}` : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: "deductionMedical" as const, label: "Medical Deduction" },
                      { key: "deductionAdvance" as const, label: "Advance Deduction" },
                      { key: "deductionOthers" as const, label: "Other Deductions" },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <DebouncedNumberInput
                          disabled={fieldsDisabled}
                          value={displayDraft[key]}
                          onCommit={(amount) => updateSelectedDraft({ [key]: amount })}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Effective Dates{displayDraft.companyName ? ` — ${displayDraft.companyName}` : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Effective From *</Label>
                      <StringDatePicker
                        value={displayDraft.effectiveFrom || ""}
                        disabled={fieldsDisabled}
                        onChange={(v) => updateSelectedDraft({ effectiveFrom: v })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Effective To</Label>
                      <StringDatePicker
                        value={displayDraft.effectiveTo || ""}
                        disabled={fieldsDisabled}
                        onChange={(v) => updateSelectedDraft({ effectiveTo: v })}
                      />
                    </div>
                  </div>
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <Label>Active Configuration</Label>
                    <Switch
                      checked={displayDraft.isActive}
                      disabled={fieldsDisabled}
                      onCheckedChange={(checked) => updateSelectedDraft({ isActive: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </Form>
        </div>
      </div>

      <FormSheetFooter>
        <Button type="button" variant="outline" className={formSheetCancelClass} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          className={formSheetSubmitClass}
          disabled={saveMutation.isPending || !canSubmit}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending
            ? "Saving..."
            : `Save Configuration${companyList.length > 1 ? ` (${companyList.length} companies)` : ""}`}
        </Button>
      </FormSheetFooter>
    </div>
  );
}

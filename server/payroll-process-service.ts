import dayjs from "dayjs";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "./db";
import { employeeCompanySalaries, employeePayroll, employees, payrollRecords } from "@shared/schema";
import {
  calculateAgeFromDob,
  mapEmployeeResidency,
} from "@shared/singapore-payroll";
import { calculateSingaporePayroll } from "./singapore-payroll-calculator";
import { getEmployeeCompanySalaries } from "./employee-company-salary-service";
import {
  resolveCompanyIdForDate,
  resolveReferenceDateFromPayPeriod,
  toDateOnly,
} from "./employee-company-history-service";
import {
  buildPayrollEmployeeSnapshot,
  type PayrollEmployeeSnapshot,
} from "./payroll-snapshot-service";

export type PayrollProcessAction = "created" | "updated" | "skipped";

export function parseForceOverwriteFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

export interface PayrollProcessResult {
  action: PayrollProcessAction;
  record?: typeof payrollRecords.$inferSelect;
  reason?: string;
}

export interface BatchPayrollSummary {
  totalEmployees: number;
  processedNew: number;
  updated: number;
  skipped: number;
  failures: { employeeName: string; message: string }[];
}

export function getPayPeriodForMonth(year: number, month: number) {
  const payPeriodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const payPeriodEnd = dayjs(payPeriodStart).endOf("month").format("YYYY-MM-DD");
  return { payPeriodStart, payPeriodEnd, year, month };
}

export function formatPayrollMonthLabel(year: number, month: number) {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${monthNames[month - 1]} ${year}`;
}

/** Parse YYYY-MM-DD without timezone shifts (avoids month-off-by-one bugs). */
export function normalizePayPeriodDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const iso = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

export function derivePayrollMonthYear(payPeriodStart: string | Date | null | undefined) {
  const normalized = normalizePayPeriodDate(payPeriodStart);
  const [yearStr, monthStr] = normalized.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  return {
    year: Number.isFinite(year) ? year : 0,
    month: Number.isFinite(month) ? month : 0,
    monthLabel: Number.isFinite(month) && Number.isFinite(year)
      ? formatPayrollMonthLabel(year, month)
      : "",
  };
}

export function formatPayPeriodLabelFromIso(isoDate: string): string {
  const normalized = normalizePayPeriodDate(isoDate);
  const [yearStr, monthStr, dayStr] = normalized.split("-");
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
    return normalized;
  }
  return `${String(day).padStart(2, "0")} ${monthNames[month - 1]} ${year}`;
}

export function getBatchZipNameFromPeriod(payPeriodStart: string) {
  const { monthLabel, year } = derivePayrollMonthYear(payPeriodStart);
  const safeLabel = monthLabel.replace(" ", "_");
  return `Payslips_${safeLabel}.zip`;
}

function normalizeJson(value: unknown) {
  return JSON.stringify(value ?? {});
}

function normalizePayrollComponentMap(value: unknown): string {
  const obj = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<
    string,
    unknown
  >;
  const entries = Object.entries(obj)
    .map(([key, val]) => [key, Number(val) || 0] as const)
    .filter(([, num]) => num !== 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return JSON.stringify(Object.fromEntries(entries));
}

export function formatLocalDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getMonthEndDay(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function resolvePayrollMonthYearFromRecord(record: {
  payrollMonth?: number | null;
  payrollYear?: number | null;
  payPeriodStart: string | Date | null | undefined;
}) {
  if (record.payrollMonth && record.payrollYear) {
    return {
      year: record.payrollYear,
      month: record.payrollMonth,
      monthLabel: formatPayrollMonthLabel(record.payrollYear, record.payrollMonth),
    };
  }
  return derivePayrollMonthYear(record.payPeriodStart);
}

export async function findPayrollRecordForPeriod(
  employeeId: number,
  payPeriodStart: string,
  payPeriodEnd: string,
  companyId?: number | null
) {
  const start = normalizePayPeriodDate(payPeriodStart);
  const end = normalizePayPeriodDate(payPeriodEnd);
  const { year, month } = derivePayrollMonthYear(start);

  const periodMatch = sql`(
    (${payrollRecords.payrollYear} = ${year} AND ${payrollRecords.payrollMonth} = ${month})
    OR (
      (${payrollRecords.payrollYear} IS NULL OR ${payrollRecords.payrollMonth} IS NULL)
      AND EXTRACT(YEAR FROM ${payrollRecords.payPeriodStart}::date) = ${year}
      AND EXTRACT(MONTH FROM ${payrollRecords.payPeriodStart}::date) = ${month}
    )
  )`;

  const companyMatch =
    companyId != null
      ? eq(payrollRecords.companyId, companyId)
      : undefined;

  const [record] = await db
    .select()
    .from(payrollRecords)
    .where(
      and(
        eq(payrollRecords.employeeId, employeeId),
        periodMatch,
        companyMatch
      )
    )
    .orderBy(desc(payrollRecords.updatedAt), desc(payrollRecords.createdAt))
    .limit(1);

  if (record) {
    return record;
  }

  const [overlapRecord] = await db
    .select()
    .from(payrollRecords)
    .where(
      and(
        eq(payrollRecords.employeeId, employeeId),
        sql`${payrollRecords.payPeriodStart}::date <= ${end}::date`,
        sql`${payrollRecords.payPeriodEnd}::date >= ${start}::date`,
        companyMatch
      )
    )
    .orderBy(desc(payrollRecords.updatedAt), desc(payrollRecords.createdAt))
    .limit(1);

  return overlapRecord;
}

export function hasPayrollConfigChanged(
  config: typeof employeePayroll.$inferSelect,
  record: typeof payrollRecords.$inferSelect,
  requestedOvertimeHours = 0
) {
  if (Number(record.payrollConfigId) !== Number(config.id)) {
    return true;
  }

  if (Number(record.baseSalary) !== Number(config.baseSalary)) {
    return true;
  }

  if (normalizePayrollComponentMap(record.allowances) !== normalizePayrollComponentMap(config.allowances)) {
    return true;
  }

  if (normalizePayrollComponentMap(record.deductions) !== normalizePayrollComponentMap(config.deductions)) {
    return true;
  }

  if (Number(requestedOvertimeHours) !== Number(record.overtimeHours ?? 0)) {
    return true;
  }

  return false;
}

function amountsNearlyEqual(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

/** Compare stored payroll snapshot vs what would be saved now. */
export function hasPayrollSnapshotChanged(
  existing: typeof payrollRecords.$inferSelect,
  snapshot: PayrollEmployeeSnapshot,
  payload: {
    baseSalary: number | string;
    grossPay: number | string;
    netPay: number | string;
    cpfDeduction?: number | string | null;
  }
): boolean {
  if ((existing.employeeName ?? "") !== (snapshot.employeeName ?? "")) return true;
  if ((existing.designation ?? "") !== (snapshot.designation ?? "")) return true;
  if ((existing.department ?? "") !== (snapshot.department ?? "")) return true;
  if ((existing.companyName ?? "") !== (snapshot.companyName ?? "")) return true;
  if (existing.monthlySalary != null && snapshot.monthlySalary != null) {
    if (!amountsNearlyEqual(Number(existing.monthlySalary), Number(snapshot.monthlySalary))) {
      return true;
    }
  }
  if (!amountsNearlyEqual(Number(payload.baseSalary), Number(existing.baseSalary))) return true;
  if (!amountsNearlyEqual(Number(payload.grossPay), Number(existing.grossPay))) return true;
  if (!amountsNearlyEqual(Number(payload.netPay), Number(existing.netPay))) return true;
  if (
    !amountsNearlyEqual(
      Number(payload.cpfDeduction ?? 0),
      Number(existing.cpfDeduction ?? 0)
    )
  ) {
    return true;
  }
  return false;
}

/** Detects payroll config, employee profile, or calculated amount changes vs an existing record. */
export function hasPayrollInputsChanged(
  config: typeof employeePayroll.$inferSelect,
  employee: typeof employees.$inferSelect,
  record: typeof payrollRecords.$inferSelect,
  payPeriodStart: string,
  payPeriodEnd: string,
  requestedOvertimeHours = 0
) {
  if (hasPayrollConfigChanged(config, record, requestedOvertimeHours)) {
    return true;
  }

  const payload = buildPayrollRecordPayload(
    config,
    employee,
    payPeriodStart,
    payPeriodEnd,
    0,
    config.tenantId,
    "",
    requestedOvertimeHours
  );

  return (
    !amountsNearlyEqual(Number(payload.grossPay), Number(record.grossPay)) ||
    !amountsNearlyEqual(Number(payload.netPay), Number(record.netPay)) ||
    !amountsNearlyEqual(Number(payload.cpfDeduction ?? 0), Number(record.cpfDeduction ?? 0))
  );
}

export function buildPayrollCalculationInput(
  config: typeof employeePayroll.$inferSelect,
  employee: typeof employees.$inferSelect,
  overtimeHours = 0,
  options?: {
    contributionMonth?: number;
    contributionYear?: number;
    prRateType?: "GG" | "FG" | "FF" | null;
    ordinaryWagesSubjectYtd?: number;
    additionalWagesSubjectYtd?: number;
    totalCpfPaidYtd?: number;
    additionalWages?: number;
  }
) {
  const age = calculateAgeFromDob(employee.dateOfBirth) ?? 25;
  const { residencyType, prYear } = mapEmployeeResidency(employee);
  const now = new Date();

  return {
    grossSalary: Number(config.baseSalary),
    age,
    citizenshipStatus: residencyType,
    prYear: residencyType === "pr" ? prYear : null,
    prRateType: options?.prRateType ?? "GG",
    monthlyAllowances: (config.allowances as Record<string, number>) || {},
    monthlyDeductions: (config.deductions as Record<string, number>) || {},
    overtimeHours: Number(overtimeHours) || 0,
    overtimeRate: Number(config.overtimeRate) || 0,
    additionalWages: options?.additionalWages,
    dateOfBirth: employee.dateOfBirth,
    contributionMonth: options?.contributionMonth ?? now.getMonth() + 1,
    contributionYear: options?.contributionYear ?? now.getFullYear(),
    ordinaryWagesSubjectYtd: options?.ordinaryWagesSubjectYtd,
    additionalWagesSubjectYtd: options?.additionalWagesSubjectYtd,
    totalCpfPaidYtd: options?.totalCpfPaidYtd,
  };
}

function resolveMonthlySalaryFromEmployee(employee: typeof employees.$inferSelect): number | null {
  if (employee.salary != null && String(employee.salary).trim() !== "") {
    const monthly = Number(employee.salary);
    if (!Number.isNaN(monthly) && monthly > 0) return monthly;
  }
  if (employee.annualSalary != null && String(employee.annualSalary).trim() !== "") {
    const monthly = Number(employee.annualSalary) / 12;
    if (!Number.isNaN(monthly) && monthly > 0) return monthly;
  }
  return null;
}

/** Resolve monthly salary for a payroll config — prefers per-company salary when configured. */
export async function resolveMonthlySalaryForConfig(
  employee: typeof employees.$inferSelect,
  config: typeof employeePayroll.$inferSelect
): Promise<number> {
  if (config.companyId) {
    const [companySalary] = await db
      .select({ salary: employeeCompanySalaries.salary })
      .from(employeeCompanySalaries)
      .where(
        and(
          eq(employeeCompanySalaries.employeeId, employee.id),
          eq(employeeCompanySalaries.companyId, config.companyId)
        )
      )
      .limit(1);
    if (companySalary?.salary != null) {
      const monthly = Number(companySalary.salary);
      if (!Number.isNaN(monthly) && monthly > 0) return monthly;
    }
  }
  return resolveMonthlySalaryFromEmployee(employee) ?? Number(config.baseSalary) ?? 0;
}

export function buildPayrollRecordPayload(
  config: typeof employeePayroll.$inferSelect,
  employee: typeof employees.$inferSelect,
  payPeriodStart: string,
  payPeriodEnd: string,
  userId: number,
  tenantId: number,
  notes = "",
  overtimeHours = 0,
  companyId: number | null = null
) {
  const normalizedStart = normalizePayPeriodDate(payPeriodStart);
  const normalizedEnd = normalizePayPeriodDate(payPeriodEnd);
  const { month: payrollMonth, year: payrollYear } = derivePayrollMonthYear(normalizedStart);

  const calculationInput = buildPayrollCalculationInput(config, employee, overtimeHours, {
    contributionMonth: payrollMonth,
    contributionYear: payrollYear,
  });
  const calculation = calculateSingaporePayroll(calculationInput);
  const breakdown = calculation.breakdown || {};

  const allowances = breakdown.allowances
    ? Object.fromEntries(
        Object.entries(breakdown.allowances).map(([key, value]) => [key, Number(value)])
      )
    : {};
  const deductions = breakdown.deductions
    ? Object.fromEntries(
        Object.entries(breakdown.deductions).map(([key, value]) => [key, Number(value)])
      )
    : {};

  return {
    tenantId,
    employeeId: employee.id,
    payrollConfigId: config.id,
    payPeriodStart: normalizedStart,
    payPeriodEnd: normalizedEnd,
    payrollMonth,
    payrollYear,
    baseSalary: Number(breakdown.baseSalary || 0),
    overtimeHours: Number(overtimeHours) || 0,
    overtimePay: Number(breakdown.overtimePay || 0),
    allowances,
    deductions,
    grossPay: Number(calculation.grossPay || 0),
    taxDeduction: 0,
    cpfDeduction: Number(calculation.employeeCpf || 0),
    netPay: Number(calculation.netPay || 0),
    companyId,
    status: "pending" as const,
    notes,
    createdBy: userId,
  };
}

export async function upsertPayrollRecord(
  config: typeof employeePayroll.$inferSelect,
  employee: typeof employees.$inferSelect,
  payPeriodStart: string,
  payPeriodEnd: string,
  userId: number,
  tenantId: number,
  options: {
    notes?: string;
    overtimeHours?: number;
    allowReprocess?: boolean;
    forceUpdate?: boolean;
    requireForceForReprocess?: boolean;
  } = {}
): Promise<PayrollProcessResult> {
  const activeConfig = (await syncPayrollConfigFromEmployee(employee, config.id)) ?? config;

  const normalizedStart = normalizePayPeriodDate(payPeriodStart);
  const normalizedEnd = normalizePayPeriodDate(payPeriodEnd);
  const { month: payrollMonth, year: payrollYear } = derivePayrollMonthYear(normalizedStart);
  const referenceDate = resolveReferenceDateFromPayPeriod(
    normalizedStart,
    normalizedEnd,
    payrollMonth,
    payrollYear
  );
  const companyId =
    config.companyId ??
    (await resolveCompanyIdForDate(employee.id, referenceDate));

  const existing = await findPayrollRecordForPeriod(
    employee.id,
    normalizedStart,
    normalizedEnd,
    companyId
  );
  const snapshot = await buildPayrollEmployeeSnapshot(
    employee,
    activeConfig,
    companyId,
    referenceDate
  );
  const payload = {
    ...buildPayrollRecordPayload(
      activeConfig,
      employee,
      normalizedStart,
      normalizedEnd,
      userId,
      tenantId,
      options.notes ?? "",
      options.overtimeHours ?? 0,
      companyId
    ),
    ...snapshot,
  };

  if (!existing) {
    const [record] = await db.insert(payrollRecords).values(payload).returning();
    return { action: "created", record };
  }

  const forceUpdate = parseForceOverwriteFlag(options.forceUpdate);
  const inputsChanged =
    hasPayrollInputsChanged(
      activeConfig,
      employee,
      existing,
      normalizePayPeriodDate(payPeriodStart),
      normalizePayPeriodDate(payPeriodEnd),
      options.overtimeHours ?? 0
    ) || hasPayrollSnapshotChanged(existing, snapshot, payload);

  if (!forceUpdate) {
    if (!inputsChanged) {
      return {
        action: "skipped",
        record: existing,
        reason: "already_processed",
      };
    }

    if (options.requireForceForReprocess) {
      return {
        action: "skipped",
        record: existing,
        reason: "data_changed",
      };
    }

    if (!options.allowReprocess) {
      return {
        action: "skipped",
        record: existing,
        reason: "already_processed",
      };
    }
  }

  const { createdBy, ...updateFields } = payload;

  const [record] = await db
    .update(payrollRecords)
    .set({
      ...updateFields,
      updatedAt: new Date(),
    })
    .where(eq(payrollRecords.id, existing.id))
    .returning();

  return { action: "updated", record };
}

/** Keep active payroll config in sync when employee profile/salary changes elsewhere. */
export async function syncPayrollConfigFromEmployee(
  employee: typeof employees.$inferSelect,
  targetConfigId?: number
): Promise<typeof employeePayroll.$inferSelect | null> {
  let config: typeof employeePayroll.$inferSelect | undefined;

  if (targetConfigId) {
    [config] = await db
      .select()
      .from(employeePayroll)
      .where(
        and(eq(employeePayroll.id, targetConfigId), eq(employeePayroll.employeeId, employee.id))
      )
      .limit(1);
  } else {
    [config] = await db
      .select()
      .from(employeePayroll)
      .where(and(eq(employeePayroll.employeeId, employee.id), eq(employeePayroll.isActive, true)))
      .orderBy(desc(employeePayroll.updatedAt))
      .limit(1);
  }

  if (!config) return null;

  const monthlySalary = await resolveMonthlySalaryForConfig(employee, config);
  const configForCalc = { ...config, baseSalary: String(monthlySalary) };
  const calculation = calculateSingaporePayroll(buildPayrollCalculationInput(configForCalc, employee, 0));

  const [updated] = await db
    .update(employeePayroll)
    .set({
      baseSalary: String(monthlySalary),
      cpfRate: String(calculation.employeeCpfRate),
      cpfAmount: String(calculation.employeeCpf),
      employerCpfRate: String(calculation.employerCpfRate),
      employerCpfAmount: String(calculation.employerCpf),
      netSalary: String(calculation.netPay),
      updatedAt: new Date(),
    })
    .where(eq(employeePayroll.id, config.id))
    .returning();

  return updated ?? null;
}

/** Current company IDs assigned to this employee via employee_company_salaries. */
export async function getCurrentEmployeeCompanyIds(
  employeeId: number
): Promise<number[]> {
  const salaries = await getEmployeeCompanySalaries(employeeId);
  return salaries.map((entry) => Number(entry.companyId)).filter((id) => id > 0);
}

/**
 * Align employee_payroll rows with employee_company_salaries:
 * deactivate removed companies, create/reactivate configs for current companies.
 */
export async function syncPayrollConfigsWithCompanySalaries(
  employee: typeof employees.$inferSelect,
  createdByUserId?: number
): Promise<void> {
  const salaries = await getEmployeeCompanySalaries(employee.id);
  const currentCompanyIds = new Set(
    salaries.map((entry) => Number(entry.companyId)).filter((id) => id > 0)
  );

  const allConfigs = await db
    .select()
    .from(employeePayroll)
    .where(eq(employeePayroll.employeeId, employee.id));

  const templateConfig =
    allConfigs.find((config) => config.isActive) ?? allConfigs[0] ?? null;
  const createdBy =
    createdByUserId ??
    templateConfig?.createdBy ??
    1;

  for (const config of allConfigs) {
    const configCompanyId =
      config.companyId != null ? Number(config.companyId) : null;
    const shouldDeactivate =
      currentCompanyIds.size > 0 &&
      (configCompanyId == null || !currentCompanyIds.has(configCompanyId));

    if (shouldDeactivate && config.isActive) {
      await db
        .update(employeePayroll)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(employeePayroll.id, config.id));
    }
  }

  if (currentCompanyIds.size === 0) {
    for (const config of allConfigs.filter((row) => row.isActive)) {
      await syncPayrollConfigFromEmployee(employee, config.id);
    }
    return;
  }

  for (const salary of salaries) {
    const companyId = Number(salary.companyId);
    if (!companyId) continue;

    let config = allConfigs.find((row) => Number(row.companyId) === companyId);

    if (config) {
      if (!config.isActive) {
        const [reactivated] = await db
          .update(employeePayroll)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(employeePayroll.id, config.id))
          .returning();
        config = reactivated ?? config;
      }
      await syncPayrollConfigFromEmployee(employee, config.id);
      continue;
    }

    const monthlySalary = salary.salary != null ? Number(salary.salary) : 0;
    const draftConfig = {
      ...(templateConfig ?? {}),
      tenantId: employee.tenantId ?? templateConfig?.tenantId,
      employeeId: employee.id,
      companyId,
      baseSalary: String(monthlySalary || 0),
      payrollPeriod: templateConfig?.payrollPeriod ?? ("monthly" as const),
      noOfWorkingDays: templateConfig?.noOfWorkingDays ?? null,
      hourlyRate: templateConfig?.hourlyRate ?? "0",
      overtimeRate: templateConfig?.overtimeRate ?? "0",
      allowances: templateConfig?.allowances ?? {},
      deductions: templateConfig?.deductions ?? {},
      taxRate: templateConfig?.taxRate ?? "0.00",
      cpfRate: templateConfig?.cpfRate ?? "20.00",
      isActive: true,
      effectiveFrom: toDateOnly(new Date()),
      effectiveTo: null,
      createdBy,
    };

    const configForCalc = {
      ...draftConfig,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as typeof employeePayroll.$inferSelect;

    const calculation = calculateSingaporePayroll(
      buildPayrollCalculationInput(configForCalc, employee, 0)
    );

    const [created] = await db
      .insert(employeePayroll)
      .values({
        tenantId: draftConfig.tenantId!,
        employeeId: employee.id,
        companyId,
        baseSalary: String(monthlySalary || 0),
        payrollPeriod: draftConfig.payrollPeriod,
        noOfWorkingDays: draftConfig.noOfWorkingDays,
        hourlyRate: draftConfig.hourlyRate,
        overtimeRate: draftConfig.overtimeRate,
        allowances: draftConfig.allowances,
        deductions: draftConfig.deductions,
        taxRate: draftConfig.taxRate,
        cpfRate: String(calculation.employeeCpfRate),
        cpfAmount: String(calculation.employeeCpf),
        employerCpfRate: String(calculation.employerCpfRate),
        employerCpfAmount: String(calculation.employerCpf),
        netSalary: String(calculation.netPay),
        isActive: true,
        effectiveFrom: draftConfig.effectiveFrom,
        effectiveTo: null,
        createdBy,
      })
      .returning();

    if (created) {
      await syncPayrollConfigFromEmployee(employee, created.id);
    }
  }
}

/** Active payroll configs for current company assignments only. */
export async function resolvePayrollConfigsForProcessing(
  employeeId: number,
  tenantId: number
): Promise<(typeof employeePayroll.$inferSelect)[]> {
  const currentCompanyIds = await getCurrentEmployeeCompanyIds(employeeId);

  if (currentCompanyIds.length > 0) {
    return db
      .select()
      .from(employeePayroll)
      .where(
        and(
          eq(employeePayroll.employeeId, employeeId),
          eq(employeePayroll.tenantId, tenantId),
          eq(employeePayroll.isActive, true),
          inArray(employeePayroll.companyId, currentCompanyIds)
        )
      )
      .orderBy(employeePayroll.companyId);
  }

  const configs = await db
    .select()
    .from(employeePayroll)
    .where(
      and(
        eq(employeePayroll.employeeId, employeeId),
        eq(employeePayroll.tenantId, tenantId),
        eq(employeePayroll.isActive, true)
      )
    )
    .orderBy(desc(employeePayroll.updatedAt));

  return configs.length > 0 ? [configs[0]] : [];
}

/** Remove payroll records for companies no longer assigned when re-processing a month. */
export async function purgeStalePayrollRecordsForMonth(
  employeeId: number,
  year: number,
  month: number,
  allowedCompanyIds: number[]
): Promise<void> {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = dayjs(monthStart).endOf("month").format("YYYY-MM-DD");
  const allowed = new Set(allowedCompanyIds.map(Number).filter((id) => id > 0));

  if (allowed.size === 0) return;

  await db.delete(payrollRecords).where(
    and(
      eq(payrollRecords.employeeId, employeeId),
      sql`(
        (${payrollRecords.payrollYear} = ${year} AND ${payrollRecords.payrollMonth} = ${month})
        OR (
          (${payrollRecords.payrollYear} IS NULL OR ${payrollRecords.payrollMonth} IS NULL)
          AND EXTRACT(YEAR FROM ${payrollRecords.payPeriodStart}::date) = ${year}
          AND EXTRACT(MONTH FROM ${payrollRecords.payPeriodStart}::date) = ${month}
        )
      )`,
      sql`${payrollRecords.payPeriodStart}::date <= ${monthEnd}::date`,
      sql`${payrollRecords.payPeriodEnd}::date >= ${monthStart}::date`,
      or(
        isNull(payrollRecords.companyId),
        sql`${payrollRecords.companyId} NOT IN (${sql.join(
          [...allowed].map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    )
  );
}

/**
 * Drop outdated company payroll rows for a month before processing with current companies.
 * Preserves valid historical months unless force-overwrite or month only has stale companies.
 */
export async function reconcilePayrollRecordsBeforeProcessing(
  employeeId: number,
  year: number,
  month: number,
  allowedCompanyIds: number[],
  forceOverwrite: boolean
): Promise<void> {
  const allowed = new Set(allowedCompanyIds.map(Number).filter((id) => id > 0));
  if (allowed.size === 0) return;

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = dayjs(monthStart).endOf("month").format("YYYY-MM-DD");

  const existing = await db
    .select({
      companyId: payrollRecords.companyId,
    })
    .from(payrollRecords)
    .where(
      and(
        eq(payrollRecords.employeeId, employeeId),
        sql`(
          (${payrollRecords.payrollYear} = ${year} AND ${payrollRecords.payrollMonth} = ${month})
          OR (
            (${payrollRecords.payrollYear} IS NULL OR ${payrollRecords.payrollMonth} IS NULL)
            AND EXTRACT(YEAR FROM ${payrollRecords.payPeriodStart}::date) = ${year}
            AND EXTRACT(MONTH FROM ${payrollRecords.payPeriodStart}::date) = ${month}
          )
        )`,
        sql`${payrollRecords.payPeriodStart}::date <= ${monthEnd}::date`,
        sql`${payrollRecords.payPeriodEnd}::date >= ${monthStart}::date`
      )
    );

  const hasStale = existing.some(
    (row) => row.companyId != null && !allowed.has(Number(row.companyId))
  );
  const hasCurrent = existing.some(
    (row) => row.companyId != null && allowed.has(Number(row.companyId))
  );

  if (forceOverwrite || (hasStale && !hasCurrent)) {
    await purgeStalePayrollRecordsForMonth(employeeId, year, month, allowedCompanyIds);
  }
}

/** Sync every active company payroll config from current employee + company salaries. */
export async function syncAllPayrollConfigsFromEmployee(
  employee: typeof employees.$inferSelect,
  createdByUserId?: number
): Promise<void> {
  await syncPayrollConfigsWithCompanySalaries(employee, createdByUserId);
}

/** Mirror payroll config base salary back to the employee record. */
export async function syncEmployeeSalaryFromPayrollConfig(
  config: typeof employeePayroll.$inferSelect
): Promise<void> {
  const monthlySalary = Number(config.baseSalary);
  if (!monthlySalary || Number.isNaN(monthlySalary)) return;

  await db
    .update(employees)
    .set({
      salary: String(monthlySalary),
      annualSalary: String(monthlySalary * 12),
    })
    .where(eq(employees.id, config.employeeId));
}

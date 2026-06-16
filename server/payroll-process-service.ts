import dayjs from "dayjs";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { employeePayroll, employees, payrollRecords } from "@shared/schema";
import {
  calculateAgeFromDob,
  mapEmployeeResidency,
} from "@shared/singapore-payroll";
import { calculateSingaporePayroll } from "./singapore-payroll-calculator";

export type PayrollProcessAction = "created" | "updated" | "skipped";

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
  payPeriodEnd: string
) {
  const start = normalizePayPeriodDate(payPeriodStart);
  const end = normalizePayPeriodDate(payPeriodEnd);
  const { year, month } = derivePayrollMonthYear(start);

  const [record] = await db
    .select()
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
        )`
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
        sql`${payrollRecords.payPeriodEnd}::date >= ${start}::date`
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

  if (normalizeJson(record.allowances) !== normalizeJson(config.allowances)) {
    return true;
  }

  if (normalizeJson(record.deductions) !== normalizeJson(config.deductions)) {
    return true;
  }

  if (Number(requestedOvertimeHours) !== Number(record.overtimeHours ?? 0)) {
    return true;
  }

  if (config.updatedAt && record.updatedAt) {
    return new Date(config.updatedAt).getTime() > new Date(record.updatedAt).getTime();
  }

  return false;
}

export function buildPayrollCalculationInput(
  config: typeof employeePayroll.$inferSelect,
  employee: typeof employees.$inferSelect,
  overtimeHours = 0
) {
  const age = calculateAgeFromDob(employee.dateOfBirth) ?? 25;
  const { residencyType, prYear } = mapEmployeeResidency(employee);

  return {
    grossSalary: Number(config.baseSalary),
    age,
    citizenshipStatus: residencyType,
    prYear: residencyType === "pr" ? prYear : null,
    monthlyAllowances: (config.allowances as Record<string, number>) || {},
    monthlyDeductions: (config.deductions as Record<string, number>) || {},
    overtimeHours: Number(overtimeHours) || 0,
    overtimeRate: Number(config.overtimeRate) || 0,
  };
}

export function buildPayrollRecordPayload(
  config: typeof employeePayroll.$inferSelect,
  employee: typeof employees.$inferSelect,
  payPeriodStart: string,
  payPeriodEnd: string,
  userId: number,
  tenantId: number,
  notes = "",
  overtimeHours = 0
) {
  const calculationInput = buildPayrollCalculationInput(config, employee, overtimeHours);
  const calculation = calculateSingaporePayroll(calculationInput);
  const breakdown = calculation.breakdown || {};
  const normalizedStart = normalizePayPeriodDate(payPeriodStart);
  const normalizedEnd = normalizePayPeriodDate(payPeriodEnd);
  const { month: payrollMonth, year: payrollYear } = derivePayrollMonthYear(normalizedStart);

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
  } = {}
): Promise<PayrollProcessResult> {
  const existing = await findPayrollRecordForPeriod(
    employee.id,
    normalizePayPeriodDate(payPeriodStart),
    normalizePayPeriodDate(payPeriodEnd)
  );
  const payload = buildPayrollRecordPayload(
    config,
    employee,
    normalizePayPeriodDate(payPeriodStart),
    normalizePayPeriodDate(payPeriodEnd),
    userId,
    tenantId,
    options.notes ?? "",
    options.overtimeHours ?? 0
  );

  if (!existing) {
    const [record] = await db.insert(payrollRecords).values(payload).returning();
    return { action: "created", record };
  }

  const configChanged = hasPayrollConfigChanged(
    config,
    existing,
    options.overtimeHours ?? 0
  );
  if (!configChanged && !options.forceUpdate) {
    return {
      action: "skipped",
      record: existing,
      reason: "already_processed",
    };
  }

  if (!options.allowReprocess && !configChanged) {
    return {
      action: "skipped",
      record: existing,
      reason: "already_processed",
    };
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

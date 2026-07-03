import dayjs from "dayjs";
import { and, desc, eq, isNull, or, gte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  companies,
  employeeCompanyHistory,
  employees,
  type EmployeeCompanyHistory,
} from "@shared/schema";

export type PayslipCompanyDetails = {
  id: number | null;
  companyName: string | null;
  address: string | null;
};

export function toDateOnly(value: Date | string | null | undefined): string {
  if (!value) return dayjs().format("YYYY-MM-DD");
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return dayjs(value).format("YYYY-MM-DD");
  }
  return String(value).slice(0, 10);
}

export function subtractOneDay(dateStr: string): string {
  return dayjs(dateStr).subtract(1, "day").format("YYYY-MM-DD");
}

export function getSalaryMonthReferenceDate(year: number, month: number): string {
  return dayjs(`${year}-${String(month).padStart(2, "0")}-01`).endOf("month").format("YYYY-MM-DD");
}

export function resolveReferenceDateFromPayPeriod(
  payPeriodStart: string,
  payPeriodEnd: string,
  payrollMonth?: number | null,
  payrollYear?: number | null
): string {
  if (payrollYear && payrollMonth) {
    return getSalaryMonthReferenceDate(payrollYear, payrollMonth);
  }
  const end = toDateOnly(payPeriodEnd);
  if (end) return end;
  return toDateOnly(payPeriodStart);
}

export function isPayslipMonthEligible(
  year: number,
  month: number,
  eligibilityStart: string,
  now = dayjs()
): boolean {
  const monthEnd = getSalaryMonthReferenceDate(year, month);
  if (monthEnd < toDateOnly(eligibilityStart)) {
    return false;
  }

  const capYear = now.year();
  const capMonth = now.month() + 1;
  if (year > capYear) return false;
  // Payslips are generated after the month ends — current month is not eligible.
  if (year === capYear && month >= capMonth) return false;
  return true;
}

export async function getEarliestPayslipEligibilityDate(
  employeeId: number
): Promise<string | null> {
  const [earliestHistory] = await db
    .select({
      effectiveFrom: employeeCompanyHistory.effectiveFrom,
      dateChanged: employeeCompanyHistory.dateChanged,
    })
    .from(employeeCompanyHistory)
    .where(eq(employeeCompanyHistory.employeeId, employeeId))
    .orderBy(
      sql`COALESCE(${employeeCompanyHistory.effectiveFrom}, ${employeeCompanyHistory.dateChanged}::date) ASC`
    )
    .limit(1);

  const [employee] = await db
    .select({ joinDate: employees.joinDate })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  const historyDate = earliestHistory
    ? toDateOnly(earliestHistory.effectiveFrom ?? earliestHistory.dateChanged)
    : null;
  const joinDate = employee?.joinDate ? toDateOnly(employee.joinDate) : null;

  if (historyDate && joinDate) {
    return historyDate < joinDate ? historyDate : joinDate;
  }
  return historyDate ?? joinDate;
}

/** Resolve company for a date using history only (no current employee.company_id fallback). */
export async function resolveCompanyIdForDateStrict(
  employeeId: number,
  referenceDate: string
): Promise<number | null> {
  const normalizedDate = toDateOnly(referenceDate);

  const [historyRow] = await db
    .select({
      companyId: employeeCompanyHistory.companyId,
    })
    .from(employeeCompanyHistory)
    .where(
      and(
        eq(employeeCompanyHistory.employeeId, employeeId),
        sql`COALESCE(${employeeCompanyHistory.effectiveFrom}, ${employeeCompanyHistory.dateChanged}::date) <= ${normalizedDate}::date`,
        or(
          isNull(employeeCompanyHistory.effectiveTo),
          gte(employeeCompanyHistory.effectiveTo, normalizedDate)
        )
      )
    )
    .orderBy(
      desc(employeeCompanyHistory.effectiveFrom),
      desc(employeeCompanyHistory.dateChanged),
      desc(employeeCompanyHistory.id)
    )
    .limit(1);

  return historyRow?.companyId ?? null;
}

/**
 * Find the company assignment active on a given salary reference date.
 * effective_from <= referenceDate AND (effective_to IS NULL OR effective_to >= referenceDate)
 */
export async function resolveCompanyIdForDate(
  employeeId: number,
  referenceDate: string
): Promise<number | null> {
  const normalizedDate = toDateOnly(referenceDate);

  const [historyRow] = await db
    .select({
      companyId: employeeCompanyHistory.companyId,
    })
    .from(employeeCompanyHistory)
    .where(
      and(
        eq(employeeCompanyHistory.employeeId, employeeId),
        sql`COALESCE(${employeeCompanyHistory.effectiveFrom}, ${employeeCompanyHistory.dateChanged}::date) <= ${normalizedDate}::date`,
        or(
          isNull(employeeCompanyHistory.effectiveTo),
          gte(employeeCompanyHistory.effectiveTo, normalizedDate)
        )
      )
    )
    .orderBy(
      desc(employeeCompanyHistory.effectiveFrom),
      desc(employeeCompanyHistory.dateChanged),
      desc(employeeCompanyHistory.id)
    )
    .limit(1);

  if (historyRow?.companyId) {
    return historyRow.companyId;
  }

  const [employee] = await db
    .select({ companyId: employees.companyId })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  return employee?.companyId ?? null;
}

export async function fetchCompanyDetails(
  companyId: number | null | undefined
): Promise<PayslipCompanyDetails | null> {
  if (!companyId) return null;

  const [company] = await db
    .select({
      id: companies.id,
      companyName: companies.companyName,
      address: companies.address,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  return company ?? null;
}

export async function resolveCompanyForPayrollDate(
  employeeId: number,
  referenceDate: string,
  storedCompanyId?: number | null
): Promise<PayslipCompanyDetails | null> {
  if (storedCompanyId) {
    const stored = await fetchCompanyDetails(storedCompanyId);
    if (stored) return stored;
  }

  const resolvedCompanyId = await resolveCompanyIdForDate(employeeId, referenceDate);
  return fetchCompanyDetails(resolvedCompanyId);
}

export interface AssignEmployeeCompanyInput {
  tenantId?: number | null;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  companyId: number;
  companyName: string;
  effectiveFrom: string | Date;
}

/**
 * Close the current open assignment and insert a new company history record.
 */
export async function assignEmployeeCompany(
  input: AssignEmployeeCompanyInput
): Promise<EmployeeCompanyHistory> {
  const effectiveFrom = toDateOnly(input.effectiveFrom);
  const previousEffectiveTo = effectiveFrom;

  const [activeRecord] = await db
    .select()
    .from(employeeCompanyHistory)
    .where(
      and(
        eq(employeeCompanyHistory.employeeId, input.employeeId),
        isNull(employeeCompanyHistory.effectiveTo)
      )
    )
    .orderBy(
      desc(employeeCompanyHistory.effectiveFrom),
      desc(employeeCompanyHistory.dateChanged),
      desc(employeeCompanyHistory.id)
    )
    .limit(1);

  if (activeRecord && Number(activeRecord.companyId) === Number(input.companyId)) {
    return activeRecord;
  }

  await db
    .update(employeeCompanyHistory)
    .set({
      effectiveTo: previousEffectiveTo,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(employeeCompanyHistory.employeeId, input.employeeId),
        isNull(employeeCompanyHistory.effectiveTo)
      )
    );

  const [created] = await db
    .insert(employeeCompanyHistory)
    .values({
      tenantId: input.tenantId ?? null,
      employeeId: input.employeeId,
      employeeCode: input.employeeCode,
      employeeName: input.employeeName,
      companyId: input.companyId,
      companyName: input.companyName,
      dateChanged: new Date(effectiveFrom),
      effectiveFrom,
      effectiveTo: null,
      updatedAt: new Date(),
    })
    .returning();

  return created;
}

export async function seedInitialEmployeeCompanyHistory(input: {
  tenantId?: number | null;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  companyId: number;
  companyName: string;
  joinDate: string | Date;
}): Promise<EmployeeCompanyHistory | null> {
  const [existing] = await db
    .select({ id: employeeCompanyHistory.id })
    .from(employeeCompanyHistory)
    .where(eq(employeeCompanyHistory.employeeId, input.employeeId))
    .limit(1);

  if (existing) return null;

  const effectiveFrom = toDateOnly(input.joinDate);

  const [created] = await db
    .insert(employeeCompanyHistory)
    .values({
      tenantId: input.tenantId ?? null,
      employeeId: input.employeeId,
      employeeCode: input.employeeCode,
      employeeName: input.employeeName,
      companyId: input.companyId,
      companyName: input.companyName,
      dateChanged: new Date(effectiveFrom),
      effectiveFrom,
      effectiveTo: null,
      updatedAt: new Date(),
    })
    .returning();

  return created;
}

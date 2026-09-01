import { and, desc, eq, inArray, isNull, or, gte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  companies,
  employeeCompanyHistory,
  employeeCompanySalaries,
  type EmployeeCompanySalary,
} from "@shared/schema";
import { toDateOnly } from "./employee-company-history-service";

export type CompanySalaryInput = {
  companyId: number;
  companyName: string;
  salary: string | number | null;
  annualSalary?: string | number | null;
};

export async function getEmployeeCompanySalaries(
  employeeId: number
): Promise<EmployeeCompanySalary[]> {
  return db
    .select()
    .from(employeeCompanySalaries)
    .where(eq(employeeCompanySalaries.employeeId, employeeId))
    .orderBy(employeeCompanySalaries.id);
}

/** Map of employeeId → ordered company names from employee_company_salaries. */
export async function getCompanyNamesByEmployeeIds(
  employeeIds: number[]
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (employeeIds.length === 0) return result;

  const rows = await db
    .select({
      employeeId: employeeCompanySalaries.employeeId,
      companyName: employeeCompanySalaries.companyName,
    })
    .from(employeeCompanySalaries)
    .where(inArray(employeeCompanySalaries.employeeId, employeeIds))
    .orderBy(employeeCompanySalaries.id);

  for (const row of rows) {
    const name = row.companyName?.trim();
    if (!name) continue;
    const list = result.get(row.employeeId) ?? [];
    if (!list.includes(name)) list.push(name);
    result.set(row.employeeId, list);
  }
  return result;
}

export async function saveEmployeeCompanySalaries(
  employeeId: number,
  tenantId: number | null,
  entries: CompanySalaryInput[]
): Promise<EmployeeCompanySalary[]> {
  const seenCompanyIds = new Set<number>();
  const normalized: Array<{
    companyId: number;
    companyName: string;
    salary: string | null;
    annualSalary: string | null;
  }> = [];

  for (const entry of entries) {
    if (!entry.companyId) continue;
    const companyId = Number(entry.companyId);
    if (!companyId || Number.isNaN(companyId) || seenCompanyIds.has(companyId)) continue;

    let companyName = entry.companyName?.trim() || "";
    if (!companyName) {
      const [company] = await db
        .select({ companyName: companies.companyName })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);
      companyName = company?.companyName || "";
    }
    if (!companyName) continue;

    seenCompanyIds.add(companyId);
    normalized.push({
      companyId,
      companyName,
      salary:
        entry.salary === "" || entry.salary == null
          ? null
          : String(Number(entry.salary)),
      annualSalary:
        entry.annualSalary === "" || entry.annualSalary == null
          ? entry.salary
            ? String(Number(entry.salary) * 12)
            : null
          : String(Number(entry.annualSalary)),
    });
  }

  await db
    .delete(employeeCompanySalaries)
    .where(eq(employeeCompanySalaries.employeeId, employeeId));

  if (normalized.length === 0) {
    return [];
  }

  const inserted = await db
    .insert(employeeCompanySalaries)
    .values(
      normalized.map((entry) => ({
        tenantId,
        employeeId,
        companyId: entry.companyId,
        companyName: entry.companyName,
        salary: entry.salary,
        annualSalary: entry.annualSalary,
        updatedAt: new Date(),
      }))
    )
    .returning();

  return inserted;
}

/**
 * Ensure each assigned company has an active history record without closing other companies.
 */
export async function syncEmployeeCompanyHistoryForSalaries(input: {
  tenantId?: number | null;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  companyIds: number[];
  effectiveFrom: string | Date;
}): Promise<void> {
  const effectiveFrom = toDateOnly(input.effectiveFrom);
  const targetCompanyIds = new Set(input.companyIds.map(Number));

  const existingHistory = await db
    .select()
    .from(employeeCompanyHistory)
    .where(eq(employeeCompanyHistory.employeeId, input.employeeId));

  const activeByCompany = new Map<number, (typeof existingHistory)[number]>();
  for (const row of existingHistory) {
    if (row.companyId != null && row.effectiveTo == null) {
      activeByCompany.set(Number(row.companyId), row);
    }
  }

  for (const companyId of targetCompanyIds) {
    if (activeByCompany.has(companyId)) continue;

    const [company] = await db
      .select({ companyName: companies.companyName })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) continue;

    await db.insert(employeeCompanyHistory).values({
      tenantId: input.tenantId ?? null,
      employeeId: input.employeeId,
      employeeCode: input.employeeCode,
      employeeName: input.employeeName,
      companyId,
      companyName: company.companyName,
      dateChanged: new Date(effectiveFrom),
      effectiveFrom,
      effectiveTo: null,
      updatedAt: new Date(),
    });
  }

  for (const [companyId, row] of activeByCompany) {
    if (!targetCompanyIds.has(companyId)) {
      await db
        .update(employeeCompanyHistory)
        .set({
          effectiveTo: effectiveFrom,
          updatedAt: new Date(),
        })
        .where(eq(employeeCompanyHistory.id, row.id));
    }
  }
}

export async function getActiveCompanySalariesForEmployee(
  employeeId: number
): Promise<EmployeeCompanySalary[]> {
  const salaries = await getEmployeeCompanySalaries(employeeId);
  if (salaries.length > 0) {
    return salaries;
  }

  const [historyRow] = await db
    .select({
      companyId: employeeCompanyHistory.companyId,
      companyName: employeeCompanyHistory.companyName,
    })
    .from(employeeCompanyHistory)
    .where(
      and(
        eq(employeeCompanyHistory.employeeId, employeeId),
        isNull(employeeCompanyHistory.effectiveTo)
      )
    )
    .orderBy(
      desc(employeeCompanyHistory.effectiveFrom),
      desc(employeeCompanyHistory.dateChanged),
      desc(employeeCompanyHistory.id)
    )
    .limit(1);

  if (!historyRow?.companyId) {
    return [];
  }

  return [];
}

export async function resolveCompanySalariesForPayslip(
  employeeId: number,
  referenceDate: string
): Promise<
  Array<{
    companyId: number;
    companyName: string;
    salary: string | null;
    annualSalary: string | null;
    address: string | null;
  }>
> {
  const salaries = await getEmployeeCompanySalaries(employeeId);
  if (salaries.length > 0) {
    const result = [];
    for (const entry of salaries) {
      const [company] = await db
        .select({
          companyName: companies.companyName,
          address: companies.address,
        })
        .from(companies)
        .where(eq(companies.id, entry.companyId))
        .limit(1);

      result.push({
        companyId: entry.companyId,
        companyName: company?.companyName || entry.companyName,
        salary: entry.salary,
        annualSalary: entry.annualSalary,
        address: company?.address ?? null,
      });
    }
    return result;
  }

  const normalizedDate = toDateOnly(referenceDate);
  const historyRows = await db
    .select({
      companyId: employeeCompanyHistory.companyId,
      companyName: employeeCompanyHistory.companyName,
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
    );

  const seen = new Set<number>();
  const result = [];
  for (const row of historyRows) {
    if (!row.companyId || seen.has(row.companyId)) continue;
    seen.add(row.companyId);

    const [company] = await db
      .select({
        companyName: companies.companyName,
        address: companies.address,
      })
      .from(companies)
      .where(eq(companies.id, row.companyId))
      .limit(1);

    result.push({
      companyId: row.companyId,
      companyName: company?.companyName || row.companyName,
      salary: null,
      annualSalary: null,
      address: company?.address ?? null,
    });
  }

  return result;
}

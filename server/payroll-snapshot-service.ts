import { and, desc, eq, sql } from "drizzle-orm";
import dayjs from "dayjs";
import { db } from "./db";
import {
  companies,
  employeeCompanySalaries,
  employeePayroll,
  employees,
  payrollRecords,
} from "@shared/schema";
import { resolveCompanyForPayrollDate } from "./employee-company-history-service";
import { DataEncryption } from "./utils/encryption";

export type PayrollEmployeeSnapshot = {
  employeeCode: string | null;
  employeeName: string | null;
  employeeEmail: string | null;
  designation: string | null;
  department: string | null;
  annualSalary: string | null;
  monthlySalary: string | null;
  companyName: string | null;
  companyAddress: string | null;
  icNo: string | null;
  employerCpfAmount: string | null;
  noOfWorkingDays: number | null;
};

export type PayrollRecordWithSnapshot = {
  payPeriodStart: string | Date;
  payPeriodEnd: string | Date;
  payrollMonth?: number | null;
  payrollYear?: number | null;
  baseSalary: string | number;
  overtimePay: string | number | null;
  overtimeHours?: string | number | null;
  allowances: Record<string, number> | null;
  deductions: Record<string, number> | null;
  grossPay: string | number;
  cpfDeduction: string | number | null;
  netPay: string | number;
  companyId?: number | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  employeeEmail?: string | null;
  designation?: string | null;
  department?: string | null;
  annualSalary?: string | number | null;
  monthlySalary?: string | number | null;
  companyName?: string | null;
  companyAddress?: string | null;
  icNo?: string | null;
  employerCpfAmount?: string | number | null;
  noOfWorkingDays?: number | null;
};

function resolveEmployeeIcNo(employee: {
  nricNumber: string | null;
  finNumber: string | null;
}): string {
  const nric = employee.nricNumber
    ? DataEncryption.decryptFully(employee.nricNumber)
    : "";
  const fin = employee.finNumber
    ? DataEncryption.decryptFully(employee.finNumber)
    : "";
  return nric || fin;
}

/** Build immutable employee/company snapshot at payroll generation time. */
export async function buildPayrollEmployeeSnapshot(
  employee: typeof employees.$inferSelect,
  config: typeof employeePayroll.$inferSelect,
  companyId: number | null,
  referenceDate: string
): Promise<PayrollEmployeeSnapshot> {
  let companyName: string | null = null;
  let companyAddress: string | null = null;
  let monthlySalary = Number(config.baseSalary) || 0;
  let annualSalary: number | null = null;

  if (companyId) {
    const [company] = await db
      .select({
        companyName: companies.companyName,
        address: companies.address,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    companyName = company?.companyName ?? null;
    companyAddress = company?.address ?? null;

    const [companySalary] = await db
      .select({
        salary: employeeCompanySalaries.salary,
        annualSalary: employeeCompanySalaries.annualSalary,
        companyName: employeeCompanySalaries.companyName,
      })
      .from(employeeCompanySalaries)
      .where(
        and(
          eq(employeeCompanySalaries.employeeId, employee.id),
          eq(employeeCompanySalaries.companyId, companyId)
        )
      )
      .limit(1);

    if (companySalary) {
      if (!companyName && companySalary.companyName) {
        companyName = companySalary.companyName;
      }
      if (companySalary.salary != null) {
        monthlySalary = Number(companySalary.salary);
      }
      if (companySalary.annualSalary != null) {
        annualSalary = Number(companySalary.annualSalary);
      }
    }
  }

  if (!companyName) {
    const resolved = await resolveCompanyForPayrollDate(
      employee.id,
      referenceDate,
      companyId
    );
    companyName = resolved?.companyName ?? null;
    companyAddress = companyAddress ?? resolved?.address ?? null;
  }

  if (annualSalary == null) {
    if (employee.annualSalary != null && String(employee.annualSalary).trim() !== "") {
      annualSalary = Number(employee.annualSalary);
    } else {
      annualSalary = monthlySalary * 12;
    }
  }

  return {
    employeeCode: employee.employeeId ?? null,
    employeeName: employee.name ?? null,
    employeeEmail: employee.email ?? null,
    designation: employee.designation ?? null,
    department: employee.department ?? null,
    annualSalary: annualSalary.toFixed(2),
    monthlySalary: monthlySalary.toFixed(2),
    companyName,
    companyAddress,
    icNo: resolveEmployeeIcNo(employee) || null,
    employerCpfAmount:
      config.employerCpfAmount != null ? String(config.employerCpfAmount) : null,
    noOfWorkingDays: config.noOfWorkingDays ?? null,
  };
}

/** True when this payroll row was already generated — must not use live employee data. */
export function isHistoricalPayrollRecord(
  record: PayrollRecordWithSnapshot | null | undefined
): boolean {
  if (!record) return false;
  const gross = Number(record.grossPay);
  const net = Number(record.netPay);
  return Number.isFinite(gross) && Number.isFinite(net);
}

/** @deprecated Use isHistoricalPayrollRecord */
export function payrollRecordHasSnapshot(
  record: PayrollRecordWithSnapshot | null | undefined
): boolean {
  return isHistoricalPayrollRecord(record);
}

/** Drizzle select projection for payslip/historical reads. */
export const payrollRecordSnapshotSelect = {
  payPeriodStart: payrollRecords.payPeriodStart,
  payPeriodEnd: payrollRecords.payPeriodEnd,
  payrollMonth: payrollRecords.payrollMonth,
  payrollYear: payrollRecords.payrollYear,
  baseSalary: payrollRecords.baseSalary,
  overtimePay: payrollRecords.overtimePay,
  overtimeHours: payrollRecords.overtimeHours,
  allowances: payrollRecords.allowances,
  deductions: payrollRecords.deductions,
  grossPay: payrollRecords.grossPay,
  cpfDeduction: payrollRecords.cpfDeduction,
  netPay: payrollRecords.netPay,
  companyId: payrollRecords.companyId,
  employeeCode: payrollRecords.employeeCode,
  employeeName: payrollRecords.employeeName,
  employeeEmail: payrollRecords.employeeEmail,
  designation: payrollRecords.designation,
  department: payrollRecords.department,
  annualSalary: payrollRecords.annualSalary,
  monthlySalary: payrollRecords.monthlySalary,
  companyName: payrollRecords.companyName,
  companyAddress: payrollRecords.companyAddress,
  icNo: payrollRecords.icNo,
  employerCpfAmount: payrollRecords.employerCpfAmount,
  noOfWorkingDays: payrollRecords.noOfWorkingDays,
};

/** All payroll records for an employee in a given month (one per company). */
export async function findPayrollRecordsForMonth(
  employeeId: number,
  yearNum: number,
  month: number
): Promise<PayrollRecordWithSnapshot[]> {
  const monthStart = `${yearNum}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = dayjs(monthStart).endOf("month").format("YYYY-MM-DD");

  const rows = await db
    .select(payrollRecordSnapshotSelect)
    .from(payrollRecords)
    .where(
      and(
        eq(payrollRecords.employeeId, employeeId),
        sql`(
          (${payrollRecords.payrollYear} = ${yearNum} AND ${payrollRecords.payrollMonth} = ${month})
          OR (
            (${payrollRecords.payrollYear} IS NULL OR ${payrollRecords.payrollMonth} IS NULL)
            AND EXTRACT(YEAR FROM ${payrollRecords.payPeriodStart}::date) = ${yearNum}
            AND EXTRACT(MONTH FROM ${payrollRecords.payPeriodStart}::date) = ${month}
          )
        )`,
        sql`${payrollRecords.payPeriodStart}::date <= ${monthEnd}::date`,
        sql`${payrollRecords.payPeriodEnd}::date >= ${monthStart}::date`
      )
    )
    .orderBy(payrollRecords.companyId, desc(payrollRecords.updatedAt), desc(payrollRecords.id));

  const seen = new Set<string>();
  const deduped: PayrollRecordWithSnapshot[] = [];
  for (const row of rows) {
    const key = row.companyId != null ? String(row.companyId) : "default";
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

import { apiRequest } from "@/lib/queryClient";
import { calculateAgeFromDob, mapEmployeeResidency } from "@shared/singapore-payroll";

export function getCurrentPayPeriod() {
  const now = new Date();
  const payPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const payPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
  return { payPeriodStart, payPeriodEnd };
}

export function toDateOnly(value: string | Date | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function payPeriodOverlapsMonth(
  payPeriodStart: string,
  payPeriodEnd: string,
  year: number,
  month: number
): boolean {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const start = toDateOnly(payPeriodStart);
  const end = toDateOnly(payPeriodEnd);
  return start <= monthEnd && end >= monthStart;
}

export function getProcessedMonthsForEmployee(
  employeeDbId: number,
  year: number,
  records: any[]
): number[] {
  const months: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const hasRecord = records.some(
      (record) =>
        record.employeeId === employeeDbId &&
        payPeriodOverlapsMonth(record.payPeriodStart, record.payPeriodEnd, year, m)
    );
    if (hasRecord) months.push(m);
  }
  return months;
}

export function isPayrollProcessedForPeriod(
  employeeDbId: number,
  records: any[],
  payPeriodStart: string,
  payPeriodEnd: string
) {
  const start = toDateOnly(payPeriodStart);
  const year = parseInt(start.slice(0, 4), 10);
  const month = parseInt(start.slice(5, 7), 10);
  if (!year || !month) return false;

  return records.some(
    (record) =>
      record.employeeId === employeeDbId &&
      payPeriodOverlapsMonth(record.payPeriodStart, record.payPeriodEnd, year, month)
  );
}

export async function processPayrollForConfig(
  config: any,
  employee: any,
  payPeriodStart: string,
  payPeriodEnd: string
) {
  const age = calculateAgeFromDob(employee.dateOfBirth);
  const { residencyType, prYear } = mapEmployeeResidency(employee);

  const calcRes = await apiRequest("POST", "/api/payroll/calculate", {
    grossSalary: Number(config.baseSalary),
    age,
    citizenshipStatus: residencyType,
    prYear: residencyType === "pr" ? prYear : null,
    monthlyAllowances: config.allowances || {},
    monthlyDeductions: config.deductions || {},
    overtimeHours: 0,
    overtimeRate: Number(config.overtimeRate) || 0,
  });

  if (!calcRes.ok) {
    const text = await calcRes.text();
    throw new Error(text || "Failed to calculate payroll");
  }

  const calculation = await calcRes.json();
  const breakdown = calculation.breakdown || {};
  const allowances = breakdown.allowances
    ? Object.fromEntries(
        Object.entries(breakdown.allowances).map(([k, v]) => [k, Number(v)])
      )
    : {};
  const deductions = breakdown.deductions
    ? Object.fromEntries(
        Object.entries(breakdown.deductions).map(([k, v]) => [k, Number(v)])
      )
    : {};

  const payload = {
    employeeId: Number(config.employeeId),
    payrollConfigId: Number(config.id),
    payPeriodStart,
    payPeriodEnd,
    baseSalary: Number(breakdown.baseSalary || 0),
    overtimeHours: 0,
    overtimePay: Number(breakdown.overtimePay || 0),
    allowances,
    deductions,
    grossPay: Number(calculation.grossPay || 0),
    taxDeduction: 0,
    cpfDeduction: Number(calculation.employeeCpf || 0),
    netPay: Number(calculation.netPay || 0),
    status: "pending",
    notes: "Batch processed payroll",
  };

  const res = await apiRequest("POST", "/api/payroll/records", payload);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: "Failed to process payroll" }));
    throw new Error(errorData.message || "Failed to process payroll");
  }

  return res.json();
}

import { apiRequest } from "@/lib/queryClient";
import { calculateAgeFromDob, mapEmployeeResidency } from "@shared/singapore-payroll";

export function formatLocalDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getCurrentPayPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    payPeriodStart: formatLocalDate(year, month, 1),
    payPeriodEnd: formatLocalDate(year, month, lastDay),
  };
}

export function getPayPeriodForMonth(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    payPeriodStart: formatLocalDate(year, month, 1),
    payPeriodEnd: formatLocalDate(year, month, lastDay),
  };
}

export function derivePayrollMonthYear(payPeriodStart: string) {
  const normalized = payPeriodStart.slice(0, 10);
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

export function formatPayrollMonthLabel(year: number, month: number) {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${monthNames[month - 1]} ${year}`;
}

export function toDateOnly(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalDate(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate()
    );
  }
  return String(value).slice(0, 10);
}

export function payPeriodOverlapsMonth(
  payPeriodStart: string,
  payPeriodEnd: string,
  year: number,
  month: number
): boolean {
  const { payPeriodStart: monthStart, payPeriodEnd: monthEnd } = getPayPeriodForMonth(year, month);
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

export function areAllConfigsProcessedForPeriod(
  configs: { employeeId: number }[],
  records: any[],
  payPeriodStart: string,
  payPeriodEnd: string
): boolean {
  if (configs.length === 0) return false;
  return configs.every((config) =>
    isPayrollProcessedForPeriod(config.employeeId, records, payPeriodStart, payPeriodEnd)
  );
}

export function hasProcessedPayrollForEmployee(employeeDbId: number, records: any[]): boolean {
  return records.some((record) => record.employeeId === employeeDbId);
}

export interface BatchPayrollSummary {
  totalEmployees: number;
  processedNew: number;
  updated: number;
  skipped: number;
  failures: { employeeName: string; message: string }[];
}

function parseFilenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  return match?.[1]?.replace(/"/g, "") || fallback;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  anchor.remove();
}

function isPdfArrayBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer, 0, 4);
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function isZipArrayBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 2) return false;
  const bytes = new Uint8Array(buffer, 0, 2);
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export async function downloadPayrollFileResponse(
  res: Response,
  fallbackFilename: string
): Promise<{ ok: true; action?: string } | { ok: false; message: string; summary?: BatchPayrollSummary }> {
  const summaryHeader = res.headers.get("X-Payroll-Summary");
  const summary = summaryHeader ? (JSON.parse(summaryHeader) as BatchPayrollSummary) : undefined;

  if (!res.ok) {
    try {
      const data = await res.json();
      return { ok: false, message: data.message || "Processing failed", summary: data.summary };
    } catch {
      return { ok: false, message: "Processing failed", summary };
    }
  }

  const arrayBuffer = await res.arrayBuffer();

  if (isPdfArrayBuffer(arrayBuffer)) {
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
    const filename = parseFilenameFromDisposition(
      res.headers.get("Content-Disposition"),
      fallbackFilename
    );
    triggerBrowserDownload(blob, filename);
    return { ok: true, action: res.headers.get("X-Payroll-Action") || undefined };
  }

  if (isZipArrayBuffer(arrayBuffer)) {
    const blob = new Blob([arrayBuffer], { type: "application/zip" });
    const filename = parseFilenameFromDisposition(
      res.headers.get("Content-Disposition"),
      fallbackFilename.endsWith(".zip") ? fallbackFilename : `${fallbackFilename}.zip`
    );
    triggerBrowserDownload(blob, filename);
    return { ok: true };
  }

  try {
    const data = JSON.parse(new TextDecoder().decode(arrayBuffer));
    return { ok: false, message: data.message || "Processing failed", summary: data.summary };
  } catch {
    return { ok: false, message: "Server did not return a valid payslip file", summary };
  }
}

export async function processIndividualPayrollForConfig(
  config: any,
  payPeriodStart: string,
  payPeriodEnd: string,
  overtimeHours = 0,
  notes = ""
) {
  const res = await fetch("/api/payroll/process/individual", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payrollConfigId: config.id,
      payPeriodStart,
      payPeriodEnd,
      overtimeHours,
      notes,
    }),
  });

  const month = parseInt(payPeriodStart.slice(5, 7), 10);
  const year = parseInt(payPeriodStart.slice(0, 4), 10);
  const fallbackFilename = `Payslip_${config.employeeName?.replace(/[^a-zA-Z0-9]+/g, "_") || "Employee"}_${formatPayrollMonthLabel(year, month).replace(" ", "_")}.pdf`;

  const result = await downloadPayrollFileResponse(res, fallbackFilename);
  return result;
}

export async function batchProcessPayrollForPeriod(
  payPeriodStart: string,
  payPeriodEnd: string,
  payrollConfigIds?: number[]
) {
  const res = await fetch("/api/payroll/process/batch", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payPeriodStart,
      payPeriodEnd,
      payrollConfigIds,
    }),
  });

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    return {
      ok: false as const,
      message: data.message || "Processing failed",
      summary: data.summary as BatchPayrollSummary | undefined,
      alreadyProcessed: false as const,
    };
  }

  const summaryHeader = res.headers.get("X-Payroll-Summary");
  const summary = summaryHeader ? (JSON.parse(summaryHeader) as BatchPayrollSummary) : undefined;
  const alreadyProcessed = res.headers.get("X-Payroll-Already-Processed") === "true";
  const { monthLabel } = derivePayrollMonthYear(payPeriodStart);
  const fallbackFilename = `Payslips_${monthLabel.replace(" ", "_")}.zip`;

  const result = await downloadPayrollFileResponse(res, fallbackFilename);
  return { ...result, summary, alreadyProcessed };
}

/** @deprecated Use batchProcessPayrollForPeriod with explicit pay period dates */
export async function batchProcessPayrollForMonth(
  year: number,
  month: number,
  payrollConfigIds?: number[]
) {
  const { payPeriodStart, payPeriodEnd } = getPayPeriodForMonth(year, month);
  return batchProcessPayrollForPeriod(payPeriodStart, payPeriodEnd, payrollConfigIds);
}

/** @deprecated Use processIndividualPayrollForConfig for auto-download and duplicate handling */
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

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pdfmake from "pdfmake";
import {
  formatPayrollMonthLabel,
  normalizePayPeriodDate,
} from "./payroll-process-service";

pdfmake.fonts = {
  Times: {
    normal: "Times-Roman",
    bold: "Times-Bold",
    italics: "Times-Italic",
    bolditalics: "Times-BoldItalic",
  },
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => true);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const payslipsRoot = path.join(__dirname, "..", "uploads", "payslips");

export function ensurePayslipsDirectory(): void {
  if (!fs.existsSync(payslipsRoot)) {
    fs.mkdirSync(payslipsRoot, { recursive: true });
  }
}

export function getEmployeeNamePart(employeeName: string): string {
  const first = employeeName.trim().split(/\s+/)[0] || "Employee";
  return first.replace(/[^a-zA-Z0-9]/g, "") || "Employee";
}

export function getEmployeeFolderName(employeeName: string, employeeId: number): string {
  return `${getEmployeeNamePart(employeeName)}_${employeeId}`;
}

export function getPayslipFileName(
  employeeName: string,
  employeeId: number,
  month: number,
  year: number
): string {
  const monthName = formatPayrollMonthLabel(year, month).split(" ")[0];
  return `${getEmployeeNamePart(employeeName)}_${employeeId}_${monthName}${year}.pdf`;
}

/** User-facing download filename: Payslip_EMPLOYEE_NAME_IDENTIFIER_COMPANY_MONTH_YEAR.pdf */
export function getPayslipDownloadFileName(
  employeeName: string,
  month: number,
  year: number,
  companyName?: string,
  identifier?: string | number | null
): string {
  const safeName =
    employeeName
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "Employee";
  const safeId =
    identifier != null && String(identifier).trim() !== ""
      ? `_${String(identifier).trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`
      : "";
  const companyPart = companyName
    ? `_${companyName
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")}`
    : "";
  const monthName = formatPayrollMonthLabel(year, month).split(" ")[0];
  return `Payslip_${safeName}${safeId}${companyPart}_${monthName}_${year}.pdf`;
}

function formatAmount(value: string | number | null | undefined): string {
  const num = parseFloat(String(value ?? 0));
  return (Number.isFinite(num) ? num : 0).toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface PayslipData {
  companyName: string;
  companyAddress: string;
  employeeName: string;
  employeeDbId: number;
  employeeCode: string;
  icNo: string;
  department: string;
  jobTitle: string;
  month: number;
  year: number;
  payPeriodStart: string;
  payPeriodEnd: string;
  basicRate: number;
  workingDays: number | null;
  basicPay: number;
  overtime: number;
  allowance: number;
  grossPay: number;
  employeeCpf: number;
  netPay: number;
  employerCpf: number;
  otherDeductions: number;
}

function formatPayslipMonthShort(month: number, year: number): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const safeMonth = month >= 1 && month <= 12 ? month : 1;
  return `${months[safeMonth - 1]}-${String(year).slice(-2)}`;
}

function formatPayslipShortDate(isoDate: string): string {
  const normalized = normalizePayPeriodDate(isoDate);
  const [yearStr, monthStr, dayStr] = normalized.split("-");
  if (!yearStr || !monthStr || !dayStr) return normalized;
  return `${dayStr}.${monthStr}.${yearStr.slice(-2)}`;
}

function formatWorkingDays(value: number | null | undefined): string {
  if (value == null) return "";
  const num = parseFloat(String(value));
  return (Number.isFinite(num) ? num : 0).toFixed(2);
}

/** Scale down long text so payslip cells stay within borders. */
function longTextSizeClass(
  value: string,
  options?: { medium?: number; long?: number; veryLong?: number }
): string {
  const len = (value || "").trim().length;
  const medium = options?.medium ?? 28;
  const long = options?.long ?? 40;
  const veryLong = options?.veryLong ?? 55;
  if (len >= veryLong) return "text-very-long";
  if (len >= long) return "text-long";
  if (len >= medium) return "text-medium";
  return "";
}

function isLongIcNo(value: string): boolean {
  return (value || "").trim().length > 18;
}

export interface CanonicalPayslipTemplate {
  header: {
    companyName: string;
    companyAddress: string;
    payrollMonthShort: string;
    periodRange: string;
  };
  employeeDetails: {
    name: string;
    icNo: string;
    employeeCode: string;
    department: string;
    jobTitle: string;
  };
  payments: {
    basicRate: string;
    workingDays: string;
    basicPay: string;
    overtime: string;
    allowance: string;
    grossPay: string;
    employeeCpf: string;
    netPay: string;
  };
  deductions: {
    employeeAmount: string;
    employerAmount: string;
    otherDeductions: string;
    monthlyGross: string;
  };
  footerNote: string;
}

export function buildCanonicalPayslipTemplate(data: PayslipData): CanonicalPayslipTemplate {
  const payPeriodStart = normalizePayPeriodDate(data.payPeriodStart);
  const payPeriodEnd = normalizePayPeriodDate(data.payPeriodEnd);
  const payrollMonthShort = formatPayslipMonthShort(data.month, data.year);
  const periodRange = `${formatPayslipShortDate(payPeriodStart)} - ${formatPayslipShortDate(payPeriodEnd)}`;

  return {
    header: {
      companyName: data.companyName || "",
      companyAddress: data.companyAddress || "",
      payrollMonthShort,
      periodRange,
    },
    employeeDetails: {
      name: data.employeeName || "",
      icNo: data.icNo || "",
      employeeCode: data.employeeCode || "",
      department: data.department || "",
      jobTitle: data.jobTitle || "",
    },
    payments: {
      basicRate: formatAmount(data.basicRate),
      workingDays: formatWorkingDays(data.workingDays),
      basicPay: formatAmount(data.basicPay),
      overtime: formatAmount(data.overtime),
      allowance: formatAmount(data.allowance),
      grossPay: formatAmount(data.grossPay),
      employeeCpf: formatAmount(data.employeeCpf),
      netPay: formatAmount(data.netPay),
    },
    deductions: {
      employeeAmount: formatAmount(data.employeeCpf),
      employerAmount: formatAmount(data.employerCpf),
      otherDeductions: formatAmount(data.otherDeductions),
      monthlyGross: formatAmount(data.grossPay),
    },
    footerNote: "***Computer Generated Payslip, No Signature Required***",
  };
}

export function buildPayslipHtml(data: PayslipData): string {
  const tpl = buildCanonicalPayslipTemplate(data);

  const companyName = escapeHtml(tpl.header.companyName);
  const companyAddress = escapeHtml(tpl.header.companyAddress);
  const payrollMonthShort = escapeHtml(tpl.header.payrollMonthShort);
  const periodRange = escapeHtml(tpl.header.periodRange);

  const employeeName = escapeHtml(tpl.employeeDetails.name);
  const employeeNameClass = longTextSizeClass(tpl.employeeDetails.name);
  const icNo = escapeHtml(tpl.employeeDetails.icNo);
  const icNoClass = isLongIcNo(tpl.employeeDetails.icNo) ? "ic-value" : "";
  const employeeCode = escapeHtml(tpl.employeeDetails.employeeCode);
  const department = escapeHtml(tpl.employeeDetails.department);
  const jobTitle = escapeHtml(tpl.employeeDetails.jobTitle);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
:root {
  --payslip-border: 2.25pt solid #000;
}

@page {
  size: A4 portrait;
  margin: 0;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: "Times New Roman", Times, serif;
  font-size: 14px;
  color: #000;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.page {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  padding: 25px;
  background: #fff;
}

.page-break {
  page-break-before: always;
  break-before: page;
}

.company-name {
  text-align: center;
  font-size: 22px;
  font-weight: bold;
  color: #3E67C5;
  line-height: 1.25;
}

.company-address {
  text-align: center;
  font-size: 15px;
  font-weight: normal;
  color: #000;
  line-height: 1.4;
  margin-top: 4px;
  margin-bottom: 60px;
}

.payslip-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.payslip-table td {
  font-size: 14px;
  color: #000;
  padding: 4px 8px;
  vertical-align: middle;
  word-break: break-word;
}

.border-t { border-top: var(--payslip-border); }
.border-b { border-bottom: var(--payslip-border); }
.border-l { border-left: var(--payslip-border); }
.border-r { border-right: var(--payslip-border); }

.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }

.font-bold { font-weight: bold; }
.font-normal { font-weight: normal; }

.footer-note {
  text-align: center;
  font-size: 14px;
  font-weight: bold;
  margin-top: 18px;
  color: #000;
}
</style>
</head>
<body>
<div class="page">

<div class="company-name">${companyName}</div>
<div class="company-address">${companyAddress}</div>

<table class="payslip-table">
<colgroup>
  <col style="width:20%">
  <col style="width:40%">
  <col style="width:40%">
</colgroup>

<!-- Row 1: PAYSLIP Header -->
<tr>
  <td class="border-t border-b border-l border-r font-bold text-left" style="font-size:16px;">PAYSLIP</td>
  <td class="border-t border-b border-l font-bold text-left" style="font-size:16px;">${payrollMonthShort}</td>
  <td class="border-t border-b border-r font-bold text-left" style="font-size:16px;">${periodRange}</td>
</tr>

<!-- Row 2: Name & Deduction Title -->
<tr>
  <td class="border-t border-l border-r font-bold text-left">Name :</td>
  <td class="border-t border-b border-l border-r font-bold text-left ${employeeNameClass}">${employeeName}</td>
  <td class="border-t border-b border-l border-r text-left">Deduction</td>
</tr>

<!-- Row 3: IC NO (horizontal border at bottom of Col 2 only) -->
<tr>
  <td class="border-l border-r font-bold text-left">IC NO :</td>
  <td class="border-b border-l border-r font-bold text-left ${icNoClass}">${icNo}</td>
  <td class="border-l border-r text-left"></td>
</tr>

<!-- Row 4: Employee Code -->
<tr>
  <td class="border-l border-r font-bold text-left">Employee Code :</td>
  <td class="border-l border-r text-left">${employeeCode}</td>
  <td class="border-l border-r text-left"></td>
</tr>

<!-- Row 5: Department -->
<tr>
  <td class="border-l border-r font-bold text-left">Department :</td>
  <td class="border-l border-r text-left">${department}</td>
  <td class="border-l border-r text-left"></td>
</tr>

<!-- Row 6: Job Title -->
<tr>
  <td class="border-b border-l border-r font-bold text-left">Job Title :</td>
  <td class="border-b border-l border-r text-left">${jobTitle}</td>
  <td class="border-l border-r text-left"></td>
</tr>

<!-- Row 6.5: Empty Space Row BEFORE Payment : -->
<tr style="height: 18px;">
  <td class="border-l text-left"></td>
  <td class="border-r text-left"></td>
  <td class="border-l border-r text-left"></td>
</tr>

<!-- Row 7: Payment Header (no line above Payment :) -->
<tr>
  <td class="border-l font-bold text-left" style="padding-bottom:2px;">Payment :</td>
  <td class="border-r text-left"></td>
  <td class="border-l border-r text-left"></td>
</tr>

<!-- Row 7.5: Empty Space Row AFTER Payment : -->
<tr style="height: 18px;">
  <td class="border-l text-left"></td>
  <td class="border-r text-left"></td>
  <td class="border-l border-r text-left"></td>
</tr>

<!-- Row 8: Basic Rate & Employee Share -->
<tr>
  <td class="border-l text-left">Basic Rate</td>
  <td class="border-r text-right">${tpl.payments.basicRate}</td>
  <td class="border-l border-r text-left">Employee Share = SGD ${tpl.deductions.employeeAmount}</td>
</tr>

<!-- Row 9: Working Days & Employer Share -->
<tr>
  <td class="border-l text-left">Working Days</td>
  <td class="border-r text-right">${tpl.payments.workingDays}</td>
  <td class="border-l border-r text-left">Employer Share = SGD ${tpl.deductions.employerAmount}</td>
</tr>

<!-- Row 10: Basic Pay -->
<tr>
  <td class="border-l text-left">Basic Pay</td>
  <td class="border-r text-right">${tpl.payments.basicPay}</td>
  <td class="border-l border-r text-left"></td>
</tr>

<!-- Row 11: Payment Spacer Row (EMPTY ROW AFTER BASIC PAY) -->
<tr style="height: 110px;">
  <td class="border-l text-left"></td>
  <td class="border-r text-right"></td>
  <td class="border-l border-r text-left"></td>
</tr>

<!-- Row 12: Overtime -->
<tr>
  <td class="border-l text-left">Overtime</td>
  <td class="border-r text-right">${tpl.payments.overtime}</td>
  <td class="border-l border-r text-left"></td>
</tr>

<!-- Row 13: Allowance & Other -->
<tr>
  <td class="border-b border-l text-left">Allowance</td>
  <td class="border-b border-r text-right">${tpl.payments.allowance}</td>
  <td class="border-t border-b border-l border-r text-left">Other : ${tpl.deductions.otherDeductions}</td>
</tr>

<!-- Row 14: Gross Pay & Monthly Gross -->
<tr>
  <td class="border-l text-left">Gross pay</td>
  <td class="border-r text-right">${tpl.payments.grossPay}</td>
  <td class="border-l border-r font-bold text-left">Monthly Gross : SGD ${tpl.deductions.monthlyGross}</td>
</tr>

<!-- Row 15: Employee CPF -->
<tr>
  <td class="border-l text-left">Employee CPF</td>
  <td class="border-r text-right">${tpl.payments.employeeCpf}</td>
  <td class="border-l border-r text-left"></td>
</tr>

<!-- Row 16: Summary Spacer Row -->
<tr style="height: 18px;">
  <td class="border-l text-left"></td>
  <td class="border-r text-right"></td>
  <td class="border-l border-r text-left"></td>
</tr>

<!-- Row 17: Net Pay -->
<tr>
  <td class="border-b border-l font-bold text-left">Net Pay</td>
  <td class="border-b border-r font-bold text-right">${tpl.payments.netPay}</td>
  <td class="border-b border-l border-r text-left"></td>
</tr>

<!-- Row 18: Signature Space (Upper box for Col 2 & Col 3, Rowspan 2 for Col 1) -->
<tr style="height: 60px;">
  <td rowspan="2" class="border-b border-l border-r text-center font-normal" style="padding-top: 54px; padding-bottom: 6px; vertical-align: bottom;">Employee</td>
  <td class="border-b border-l border-r text-center"></td>
  <td class="border-b border-l border-r text-center"></td>
</tr>

<!-- Row 19: Signature Names (Col 2 & Col 3 lower boxes) -->
<tr>
  <td class="border-b border-l border-r font-bold text-left ${employeeNameClass}" style="padding-top: 6px; padding-bottom: 6px; vertical-align: middle;">${employeeName}</td>
  <td class="border-b border-l border-r font-bold text-center" style="padding-top: 6px; padding-bottom: 6px; vertical-align: middle;">${companyName}</td>
</tr>

</table>

<div class="footer-note">${tpl.footerNote}</div>

</div>
</body>
</html>`;
}

function extractPayslipPageContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1].trim() : html;
}

function extractPayslipHead(html: string): string {
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
  return headMatch ? headMatch[0] : "";
}

/** Combine multiple payslips into one HTML document (one page per company). */
export function buildCombinedPayslipHtml(dataList: PayslipData[]): string {
  if (dataList.length === 0) return "";
  if (dataList.length === 1) return buildPayslipHtml(dataList[0]);

  const firstHtml = buildPayslipHtml(dataList[0]);
  const head = extractPayslipHead(firstHtml);
  const pages = dataList.map((data, index) => {
    const html = buildPayslipHtml(data);
    const body = extractPayslipPageContent(html);
    return index === 0 ? body : `<div class="page-break"></div>${body}`;
  });

  return `<!DOCTYPE html>
<html lang="en">
${head}
<body>
${pages.join("\n")}
</body>
</html>`;
}

export function buildPayslipPdfMakeContent(data: PayslipData, pageBreakBefore = false): any[] {
  const tpl = buildCanonicalPayslipTemplate(data);

  const companyName = tpl.header.companyName;
  const companyAddress = tpl.header.companyAddress;
  const payrollMonthShort = tpl.header.payrollMonthShort;
  const periodRange = tpl.header.periodRange;

  const employeeName = tpl.employeeDetails.name;
  const icNo = tpl.employeeDetails.icNo;
  const employeeCode = tpl.employeeDetails.employeeCode;
  const department = tpl.employeeDetails.department;
  const jobTitle = tpl.employeeDetails.jobTitle;

  const elements: any[] = [];

  // Header: Company Name & Address (matches .company-name and .company-address CSS)
  elements.push({
    text: companyName,
    fontSize: 16.5,
    bold: true,
    color: "#3E67C5",
    alignment: "center",
    pageBreak: pageBreakBefore ? "before" : undefined,
    margin: [0, 0, 0, 3],
  });

  elements.push({
    text: companyAddress,
    fontSize: 11.25,
    alignment: "center",
    noWrap: true,
    margin: [0, 0, 0, 45],
  });

  // Main Payslip Table — Column Widths match HTML preview colgroup (20%, 40%, 40%)
  elements.push({
    table: {
      widths: ["20%", "40%", "40%"],
      body: [
        // Row 1: Table Header (PAYSLIP | Month | Pay Period) — Removed vertical border before date range
        [
          { text: "PAYSLIP", bold: true, fontSize: 12, alignment: "left", border: [true, true, true, true] },
          { text: payrollMonthShort, bold: true, fontSize: 12, alignment: "left", border: [true, true, false, true] },
          { text: periodRange, bold: true, fontSize: 12, alignment: "left", border: [false, true, true, true] },
        ],
        // Row 2: Name + Deduction Title
        [
          { text: "Name :", bold: true, fontSize: 10.5, border: [true, true, true, false] },
          { text: employeeName, bold: true, fontSize: 10.5, border: [true, true, true, true] },
          { text: "Deduction", fontSize: 10.5, border: [true, true, true, true] },
        ],
        // Row 3: IC NO (horizontal border at bottom of Col 2 only)
        [
          { text: "IC NO :", bold: true, fontSize: 10.5, border: [true, false, true, false] },
          { text: icNo, bold: true, fontSize: 10.5, border: [true, false, true, true] },
          { text: "", border: [true, false, true, false] },
        ],
        // Row 4: Employee Code
        [
          { text: "Employee Code :", bold: true, fontSize: 10.5, border: [true, false, true, false] },
          { text: employeeCode, fontSize: 10.5, border: [true, false, true, false] },
          { text: "", border: [true, false, true, false] },
        ],
        // Row 5: Department
        [
          { text: "Department :", bold: true, fontSize: 10.5, border: [true, false, true, false] },
          { text: department, fontSize: 10.5, border: [true, false, true, false] },
          { text: "", border: [true, false, true, false] },
        ],
        // Row 6: Job Title (matches HTML border-b under Job Title)
        [
          { text: "Job Title :", bold: true, fontSize: 10.5, border: [true, false, true, true] },
          { text: jobTitle, fontSize: 10.5, border: [true, false, true, true] },
          { text: "", border: [true, false, true, false] },
        ],
        // Row 6.5: Empty Space Row BEFORE Payment :
        [
          { text: "", margin: [0, 4, 0, 4], border: [true, false, false, false] },
          { text: "", margin: [0, 4, 0, 4], border: [false, false, true, false] },
          { text: "", border: [true, false, true, false] },
        ],
        // Row 7: Payment Header (no line above Payment :)
        [
          { text: "Payment :", bold: true, fontSize: 10.5, border: [true, false, false, false], margin: [0, 0, 0, 4] },
          { text: "", border: [false, false, true, false] },
          { text: "", border: [true, false, true, false] },
        ],
        // Row 7.5: Empty Space Row AFTER Payment :
        [
          { text: "", margin: [0, 4, 0, 4], border: [true, false, false, false] },
          { text: "", margin: [0, 4, 0, 4], border: [false, false, true, false] },
          { text: "", border: [true, false, true, false] },
        ],
        // Row 8: Basic Rate & Employee Share
        [
          { text: "Basic Rate", fontSize: 10.5, border: [true, false, false, false] },
          { text: formatAmount(data.basicRate), fontSize: 10.5, alignment: "right", border: [false, false, true, false] },
          { text: `Employee Share = SGD ${formatAmount(data.employeeCpf)}`, fontSize: 10.5, border: [true, false, true, false] },
        ],
        // Row 9: Working Days & Employer Share
        [
          { text: "Working Days", fontSize: 10.5, border: [true, false, false, false] },
          { text: formatWorkingDays(data.workingDays), fontSize: 10.5, alignment: "right", border: [false, false, true, false] },
          { text: `Employer Share = SGD ${formatAmount(data.employerCpf)}`, fontSize: 10.5, border: [true, false, true, false] },
        ],
        // Row 10: Basic Pay
        [
          { text: "Basic Pay", fontSize: 10.5, border: [true, false, false, false] },
          { text: formatAmount(data.basicPay), fontSize: 10.5, alignment: "right", border: [false, false, true, false] },
          { text: "", border: [true, false, true, false] },
        ],
        // Row 11: Payment Spacer Row (EMPTY ROW AFTER BASIC PAY)
        [
          { text: "", margin: [0, 35, 0, 35], border: [true, false, false, false] },
          { text: "", margin: [0, 35, 0, 35], border: [false, false, true, false] },
          { text: "", border: [true, false, true, false] },
        ],
        // Row 12: Overtime
        [
          { text: "Overtime", fontSize: 10.5, border: [true, false, false, false] },
          { text: formatAmount(data.overtime), fontSize: 10.5, alignment: "right", border: [false, false, true, false] },
          { text: "", border: [true, false, true, false] },
        ],
        // Row 13: Allowance & Other
        [
          { text: "Allowance", fontSize: 10.5, border: [true, false, false, true] },
          { text: formatAmount(data.allowance), fontSize: 10.5, alignment: "right", border: [false, false, true, true] },
          { text: `Other : ${formatAmount(data.otherDeductions)}`, fontSize: 10.5, border: [true, true, true, true] },
        ],
        // Row 14: Gross Pay / Monthly Gross
        [
          { text: "Gross pay", fontSize: 10.5, border: [true, false, false, false] },
          { text: formatAmount(data.grossPay), fontSize: 10.5, alignment: "right", border: [false, false, true, false] },
          { text: `Monthly Gross : SGD ${formatAmount(data.grossPay)}`, bold: true, fontSize: 10.5, border: [true, false, true, false] },
        ],
        // Row 15: Employee CPF
        [
          { text: "Employee CPF", fontSize: 10.5, border: [true, false, false, false] },
          { text: formatAmount(data.employeeCpf), fontSize: 10.5, alignment: "right", border: [false, false, true, false] },
          { text: "", border: [true, false, true, false] },
        ],
        // Row 16: Summary Spacer Row
        [
          { text: "", margin: [0, 8, 0, 8], border: [true, false, false, false] },
          { text: "", margin: [0, 8, 0, 8], border: [false, false, true, false] },
          { text: "", border: [true, false, true, false] },
        ],
        // Row 17: Net Pay
        [
          { text: "Net Pay", bold: true, fontSize: 11, border: [true, false, false, true] },
          { text: formatAmount(data.netPay), bold: true, fontSize: 11, alignment: "right", border: [false, false, true, true] },
          { text: "", border: [true, false, true, true] },
        ],
        // Row 18: Signature Space (Upper box for Col 2 & Col 3, rowSpan: 2 for Col 1)
        [
          { text: "", border: [true, false, true, false] },
          { text: "", margin: [0, 25, 0, 25], border: [true, true, true, false] },
          { text: "", margin: [0, 25, 0, 25], border: [true, true, true, false] },
        ],
        // Row 19: Signature Names (Col 2 & Col 3 lower boxes)
        [
          { text: "Employee", fontSize: 11, alignment: "center", margin: [0, 4, 0, 4], border: [true, false, true, true] },
          { text: employeeName, bold: true, fontSize: 10.5, alignment: "left", margin: [0, 4, 0, 4], border: [true, true, true, true] },
          { text: companyName, bold: true, fontSize: 10.5, alignment: "center", margin: [0, 4, 0, 4], border: [true, true, true, true] },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 2.25,
      vLineWidth: () => 2.25,
      hLineColor: () => "#000000",
      vLineColor: () => "#000000",
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  });

  // Footer Note (matches HTML .footer-note CSS)
  elements.push({
    text: "***Computer Generated Payslip, No Signature Required***",
    bold: true,
    fontSize: 10.5,
    alignment: "center",
    margin: [0, 18, 0, 0],
  });

  return elements;
}

export function isPdfBuffer(buffer: Buffer): boolean {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

export async function generatePayslipPdf(data: PayslipData): Promise<Buffer> {
  const content = buildPayslipPdfMakeContent(data, false);
  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [28, 28, 28, 28],
    defaultStyle: {
      font: "Times",
      fontSize: 10.5,
      color: "#000000",
    },
    content,
  };

  const doc = pdfmake.createPdf(docDefinition);
  const pdfBuffer = await doc.getBuffer();
  if (!isPdfBuffer(pdfBuffer)) {
    throw new Error("pdfmake did not return a valid PDF buffer");
  }
  return pdfBuffer;
}

export async function generateCombinedPayslipPdf(dataList: PayslipData[]): Promise<Buffer> {
  if (dataList.length === 0) {
    throw new Error("No payslip data provided");
  }
  if (dataList.length === 1) {
    return generatePayslipPdf(dataList[0]);
  }

  const content: any[] = [];
  dataList.forEach((data, index) => {
    const pageBreakBefore = index > 0;
    const payslipContent = buildPayslipPdfMakeContent(data, pageBreakBefore);
    content.push(...payslipContent);
  });

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [28, 28, 28, 28],
    defaultStyle: {
      font: "Times",
      fontSize: 10.5,
      color: "#000000",
    },
    content,
  };

  const doc = pdfmake.createPdf(docDefinition);
  const pdfBuffer = await doc.getBuffer();
  if (!isPdfBuffer(pdfBuffer)) {
    throw new Error("pdfmake did not return a valid PDF buffer");
  }
  return pdfBuffer;
}

export async function savePayslipPdf(
  data: PayslipData,
  pdfBuffer: Buffer
): Promise<{ filename: string; relativePath: string; absolutePath: string }> {
  ensurePayslipsDirectory();
  const folderName = getEmployeeFolderName(data.employeeName, data.employeeDbId);
  const employeeDir = path.join(payslipsRoot, folderName);
  if (!fs.existsSync(employeeDir)) {
    fs.mkdirSync(employeeDir, { recursive: true });
  }

  const filename = getPayslipFileName(
    data.employeeName,
    data.employeeDbId,
    data.month,
    data.year
  );
  const absolutePath = path.join(employeeDir, filename);
  if (!isPdfBuffer(pdfBuffer)) {
    throw new Error("Cannot save payslip: invalid PDF buffer");
  }
  await fs.promises.writeFile(absolutePath, pdfBuffer, { encoding: undefined });

  const relativePath = path.posix.join("uploads", "payslips", folderName, filename);
  return { filename, relativePath, absolutePath };
}

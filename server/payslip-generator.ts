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

export function buildPayslipHtml(data: PayslipData): string {
  const payPeriodStart = normalizePayPeriodDate(data.payPeriodStart);
  const payPeriodEnd = normalizePayPeriodDate(data.payPeriodEnd);
  const payrollMonthShort = formatPayslipMonthShort(data.month, data.year);
  const periodRange = `${formatPayslipShortDate(payPeriodStart)} - ${formatPayslipShortDate(payPeriodEnd)}`;

  const companyName = escapeHtml(data.companyName || "");
  const companyAddress = escapeHtml(data.companyAddress || "");
  const employeeName = escapeHtml(data.employeeName || "");
  const employeeNameClass = longTextSizeClass(data.employeeName || "");
  const icNo = escapeHtml(data.icNo || "");
  const icNoClass = isLongIcNo(data.icNo || "") ? "ic-value" : "";
  const employeeCode = escapeHtml(data.employeeCode || "");
  const department = escapeHtml(data.department || "");
  const jobTitle = escapeHtml(data.jobTitle || "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
:root {
  --payslip-border: 3px solid #000;
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

.payslip {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  border: var(--payslip-border);
}

.payslip td {
  border: var(--payslip-border);
  vertical-align: top;
  font-size: 14px;
  color: #000;
  background: #fff;
}

.row-payslip-header td {
  font-weight: 600;
  font-size: 16px;
  padding: 8px 10px;
  vertical-align: middle;
  height: 36px;
  border-top: var(--payslip-border);
  border-bottom: var(--payslip-border);
  border-left: none;
  border-right: none;
}

.row-payslip-header td:first-child {
  border-left: var(--payslip-border);
  text-align: left;
  text-transform: uppercase;
  padding-left: 10px;
}

.row-payslip-header td:nth-child(2) {
  text-align: center;
}

.row-payslip-header td:last-child {
  border-right: var(--payslip-border);
  text-align: center;
}

.cell-employee {
  padding: 0;
  vertical-align: top;
}

.emp-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.emp-table td {
  border: none;
  padding: 3px 10px;
  font-size: 14px;
  vertical-align: middle;
  text-align: left;
}

.emp-table td.label {
  width: 130px;
  border-right: var(--payslip-border);
  white-space: nowrap;
  font-weight: normal;
}

.emp-table td.value {
  font-weight: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.35;
  padding-top: 4px;
  padding-bottom: 4px;
}

.emp-table td.value.text-medium {
  font-size: 13px;
  line-height: 1.3;
}

.emp-table td.value.text-long {
  font-size: 12px;
  line-height: 1.28;
}

.emp-table td.value.text-very-long {
  font-size: 11px;
  line-height: 1.22;
}

.emp-table td.value.ic-value {
  font-size: 11px;
  line-height: 1.25;
  word-break: break-all;
}

.emp-table .value-semibold {
  font-weight: 600;
}

.emp-row-name td.label,
.emp-row-ic td.label {
  border-top: none;
  border-bottom: none;
}

.emp-row-name td.value {
  border-bottom: var(--payslip-border);
}

.cell-deduction-title {
  padding: 8px 10px;
  font-size: 14px;
  font-weight: normal;
}

.cell-payment {
  padding: 8px 10px 10px;
}

.payslip td.cell-summary-gross {
  padding: 8px 10px 2px;
  border-bottom: none;
}

.payslip td.cell-monthly-gross {
  padding: 2px 10px;
  font-size: 14px;
  font-weight: bold;
  vertical-align: middle;
  border-bottom: none;
}

.payslip td.cell-summary-left {
  padding: 8px 10px 12px;
  border-top: none;
}

.payslip td.cell-summary-right-empty {
  padding: 0;
  vertical-align: top;
  border-top: none;
}

.payment-table,
.summary-table {
  width: 100%;
  border-collapse: collapse;
}

.payment-table td,
.summary-table td {
  border: none;
  padding: 2px 0;
  font-size: 14px;
  vertical-align: top;
}

.payment-table .label-cell,
.summary-table .label-cell {
  text-align: left;
}

.payment-table .amount-cell,
.summary-table .amount-cell {
  text-align: right;
  width: 90px;
  white-space: nowrap;
  padding-right: 2px;
}

.payment-title td {
  padding-bottom: 16px;
}

.payment-spacer td {
  height: 110px;
  padding: 0;
  border: none;
}

.cell-cpf {
  padding: 8px 10px;
  font-size: 14px;
  line-height: 1.6;
  vertical-align: top;
}

.cpf-block {
  padding-top: 72px;
}

.cell-other-inline {
  padding: 2px 10px;
  font-size: 14px;
  vertical-align: middle;
}

.summary-spacer td {
  height: 18px;
  padding: 0;
  border: none;
}

.summary-net .label-cell,
.summary-net .amount-cell {
  font-weight: bold;
}

.row-signature td {
  padding: 0 0 6px;
  height: auto;
  min-height: 88px;
  vertical-align: bottom;
}

.row-signature td:first-child {
  font-size: 14px;
  font-weight: normal;
  text-align: right;
  padding: 0 10px 10px;
  vertical-align: bottom;
}

.signature-line-block {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 88px;
  height: 100%;
  padding: 0 0 10px;
  box-sizing: border-box;
}

.signature-space {
  flex: 1 1 auto;
  min-height: 20px;
}

.signature-line {
  display: block;
  width: 100%;
  height: 3px;
  margin: 0;
  padding: 0;
  background: #000;
  border: none;
}

.signature-text {
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  line-height: 1.2;
  margin-top: 6px;
  padding: 0 10px;
  word-break: break-word;
  overflow-wrap: anywhere;
  max-width: 100%;
}

.signature-text.text-medium {
  font-size: 13px;
  line-height: 1.18;
}

.signature-text.text-long {
  font-size: 11px;
  line-height: 1.15;
}

.signature-text.text-very-long {
  font-size: 9px;
  line-height: 1.12;
}

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

<table class="payslip">
<colgroup>
  <col style="width:30%">
  <col style="width:30%">
  <col style="width:40%">
</colgroup>
<tr class="row-payslip-header">
  <td>PAYSLIP</td>
  <td>${escapeHtml(payrollMonthShort)}</td>
  <td>${escapeHtml(periodRange)}</td>
</tr>

<tr>
  <td colspan="2" class="cell-employee">
    <table class="emp-table">
      <tr class="emp-row-name">
        <td class="label">Name :</td>
        <td class="value value-semibold ${employeeNameClass}">${employeeName}</td>
      </tr>
      <tr class="emp-row-ic">
        <td class="label">IC NO :</td>
        <td class="value value-semibold ${icNoClass}">${icNo}</td>
      </tr>
      <tr>
        <td class="label">Employee Code :</td>
        <td class="value">${employeeCode}</td>
      </tr>
      <tr>
        <td class="label">Department :</td>
        <td class="value">${department}</td>
      </tr>
      <tr>
        <td class="label">Job Title :</td>
        <td class="value">${jobTitle}</td>
      </tr>
    </table>
  </td>
  <td class="cell-deduction-title">Deduction</td>
</tr>

<tr>
  <td colspan="2" rowspan="2" class="cell-payment">
    <table class="payment-table">
      <tr class="payment-title">
        <td colspan="2">Payment :</td>
      </tr>
      <tr>
        <td class="label-cell">Basic Rate</td>
        <td class="amount-cell">${formatAmount(data.basicRate)}</td>
      </tr>
      <tr>
        <td class="label-cell">Working Days</td>
        <td class="amount-cell">${formatWorkingDays(data.workingDays)}</td>
      </tr>
      <tr>
        <td class="label-cell">Basic Pay</td>
        <td class="amount-cell">${formatAmount(data.basicPay)}</td>
      </tr>
      <tr class="payment-spacer">
        <td colspan="2"></td>
      </tr>
      <tr>
        <td class="label-cell">Overtime</td>
        <td class="amount-cell">${formatAmount(data.overtime)}</td>
      </tr>
      <tr>
        <td class="label-cell">Allowance</td>
        <td class="amount-cell">${formatAmount(data.allowance)}</td>
      </tr>
    </table>
  </td>
  <td class="cell-cpf">
    <div class="cpf-block">
      Employee Amount = SGD ${formatAmount(data.employeeCpf)}<br>
      Employer Amount = SGD ${formatAmount(data.employerCpf)}
    </div>
  </td>
</tr>

<tr class="row-allowance-other">
  <td class="cell-other-inline">Other : ${formatAmount(data.otherDeductions)}</td>
</tr>

<tr class="row-gross-monthly">
  <td colspan="2" class="cell-summary-gross">
    <table class="summary-table">
      <tr>
        <td class="label-cell">Gross pay</td>
        <td class="amount-cell">${formatAmount(data.grossPay)}</td>
      </tr>
    </table>
  </td>
  <td class="cell-monthly-gross">Monthly Gross : SGD ${formatAmount(data.grossPay)}</td>
</tr>

<tr>
  <td colspan="2" class="cell-summary-left">
    <table class="summary-table">
      <tr>
        <td class="label-cell">Employee CPF</td>
        <td class="amount-cell">${formatAmount(data.employeeCpf)}</td>
      </tr>
      <tr class="summary-spacer">
        <td colspan="2"></td>
      </tr>
      <tr class="summary-net">
        <td class="label-cell">Net Pay</td>
        <td class="amount-cell">${formatAmount(data.netPay)}</td>
      </tr>
    </table>
  </td>
  <td class="cell-summary-right-empty"></td>
</tr>

<tr class="row-signature">
  <td>Employee</td>
  <td>
    <div class="signature-line-block">
      <div class="signature-space"></div>
      <div class="signature-line"></div>
      <div class="signature-text ${employeeNameClass}">${employeeName}</div>
    </div>
  </td>
  <td>
    <div class="signature-line-block">
      <div class="signature-space"></div>
      <div class="signature-line"></div>
      <div class="signature-text ${longTextSizeClass(data.companyName || "", { medium: 30, long: 45, veryLong: 60 })}">${companyName}</div>
    </div>
  </td>
</tr>
</table>

<div class="footer-note">***Computer Generated Payslip, No Signature Required***</div>

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
  const payPeriodStart = normalizePayPeriodDate(data.payPeriodStart);
  const payPeriodEnd = normalizePayPeriodDate(data.payPeriodEnd);
  const payrollMonthShort = formatPayslipMonthShort(data.month, data.year);
  const periodRange = `${formatPayslipShortDate(payPeriodStart)} - ${formatPayslipShortDate(payPeriodEnd)}`;

  const companyName = data.companyName || "";
  const companyAddress = data.companyAddress || "";
  const employeeName = data.employeeName || "";
  const icNo = data.icNo || "";
  const employeeCode = data.employeeCode || "";
  const department = data.department || "";
  const jobTitle = data.jobTitle || "";

  const elements: any[] = [];

  // Header: Company Name & Address
  elements.push({
    text: companyName,
    fontSize: 18,
    bold: true,
    color: "#3E67C5",
    alignment: "center",
    pageBreak: pageBreakBefore ? "before" : undefined,
    margin: [0, 0, 0, 4],
  });

  elements.push({
    text: companyAddress,
    fontSize: 11,
    alignment: "center",
    margin: [0, 0, 0, 22],
  });

  // Main Payslip Table
  elements.push({
    table: {
      widths: ["30%", "30%", "40%"],
      body: [
        // Row 1: Header
        [
          { text: "PAYSLIP", bold: true, fontSize: 13, alignment: "left", margin: [2, 4, 2, 4] },
          { text: payrollMonthShort, bold: true, fontSize: 13, alignment: "center", margin: [2, 4, 2, 4] },
          { text: periodRange, bold: true, fontSize: 13, alignment: "center", margin: [2, 4, 2, 4] },
        ],
        // Row 2: Employee info + Deduction Title
        [
          {
            colSpan: 2,
            table: {
              widths: [105, "*"],
              body: [
                [
                  { text: "Name :", fontSize: 10.5, border: [false, false, true, true] },
                  { text: employeeName, fontSize: 10.5, bold: true, border: [false, false, false, true] },
                ],
                [
                  { text: "IC NO :", fontSize: 10.5, border: [false, false, true, false] },
                  { text: icNo, fontSize: 10.5, bold: true, border: [false, false, false, false] },
                ],
                [
                  { text: "Employee Code :", fontSize: 10.5, border: [false, false, true, false] },
                  { text: employeeCode, fontSize: 10.5, border: [false, false, false, false] },
                ],
                [
                  { text: "Department :", fontSize: 10.5, border: [false, false, true, false] },
                  { text: department, fontSize: 10.5, border: [false, false, false, false] },
                ],
                [
                  { text: "Job Title :", fontSize: 10.5, border: [false, false, true, false] },
                  { text: jobTitle, fontSize: 10.5, border: [false, false, false, false] },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 1.5,
              vLineWidth: () => 1.5,
              hLineColor: () => "#000000",
              vLineColor: () => "#000000",
              paddingLeft: () => 4,
              paddingRight: () => 4,
              paddingTop: () => 3,
              paddingBottom: () => 3,
            },
          },
          {},
          { text: "Deduction", fontSize: 11, margin: [4, 4, 4, 4] },
        ],
        // Row 3: Payments + CPF block
        [
          {
            colSpan: 2,
            table: {
              widths: ["*", 70],
              body: [
                [{ text: "Payment :", colSpan: 2, bold: true, fontSize: 10.5, margin: [0, 0, 0, 4] }, {}],
                [{ text: "Basic Rate", fontSize: 10.5 }, { text: formatAmount(data.basicRate), fontSize: 10.5, alignment: "right" }],
                [{ text: "Working Days", fontSize: 10.5 }, { text: formatWorkingDays(data.workingDays), fontSize: 10.5, alignment: "right" }],
                [{ text: "Basic Pay", fontSize: 10.5 }, { text: formatAmount(data.basicPay), fontSize: 10.5, alignment: "right" }],
                [{ text: "", colSpan: 2, margin: [0, 22, 0, 22] }, {}],
                [{ text: "Overtime", fontSize: 10.5 }, { text: formatAmount(data.overtime), fontSize: 10.5, alignment: "right" }],
                [{ text: "Allowance", fontSize: 10.5 }, { text: formatAmount(data.allowance), fontSize: 10.5, alignment: "right" }],
              ],
            },
            layout: "noBorders",
          },
          {},
          {
            stack: [
              { text: "", margin: [0, 48, 0, 0] },
              { text: `Employee Amount = SGD ${formatAmount(data.employeeCpf)}`, fontSize: 10.5, lineHeight: 1.5 },
              { text: `Employer Amount = SGD ${formatAmount(data.employerCpf)}`, fontSize: 10.5, lineHeight: 1.5 },
            ],
            margin: [4, 4, 4, 4],
          },
        ],
        // Row 4: Other deductions
        [
          { text: "", colSpan: 2 },
          {},
          { text: `Other : ${formatAmount(data.otherDeductions)}`, fontSize: 10.5, margin: [4, 2, 4, 2] },
        ],
        // Row 5: Gross Monthly Row
        [
          {
            colSpan: 2,
            table: {
              widths: ["*", 70],
              body: [
                [{ text: "Gross pay", fontSize: 10.5 }, { text: formatAmount(data.grossPay), fontSize: 10.5, alignment: "right" }],
              ],
            },
            layout: "noBorders",
          },
          {},
          { text: `Monthly Gross : SGD ${formatAmount(data.grossPay)}`, bold: true, fontSize: 10.5, margin: [4, 2, 4, 2] },
        ],
        // Row 6: Summary Row (CPF, Net Pay)
        [
          {
            colSpan: 2,
            table: {
              widths: ["*", 70],
              body: [
                [{ text: "Employee CPF", fontSize: 10.5 }, { text: formatAmount(data.employeeCpf), fontSize: 10.5, alignment: "right" }],
                [{ text: "", colSpan: 2, margin: [0, 8, 0, 8] }, {}],
                [{ text: "Net Pay", bold: true, fontSize: 11 }, { text: formatAmount(data.netPay), bold: true, fontSize: 11, alignment: "right" }],
              ],
            },
            layout: "noBorders",
          },
          {},
          { text: "" },
        ],
        // Row 7: Signature Row
        [
          { text: "Employee", fontSize: 10.5, alignment: "right", margin: [0, 40, 6, 2] },
          {
            stack: [
              { text: "", margin: [0, 32, 0, 0] },
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 145, y2: 0, lineWidth: 1.5 }] },
              { text: employeeName, bold: true, fontSize: 10.5, margin: [0, 4, 0, 2] },
            ],
          },
          {
            stack: [
              { text: "", margin: [0, 32, 0, 0] },
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 195, y2: 0, lineWidth: 1.5 }] },
              { text: companyName, bold: true, fontSize: 10.5, margin: [0, 4, 0, 2] },
            ],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 1.5,
      vLineWidth: () => 1.5,
      hLineColor: () => "#000000",
      vLineColor: () => "#000000",
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  });

  // Footer Note
  elements.push({
    text: "***Computer Generated Payslip, No Signature Required***",
    bold: true,
    fontSize: 10.5,
    alignment: "center",
    margin: [0, 16, 0, 0],
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

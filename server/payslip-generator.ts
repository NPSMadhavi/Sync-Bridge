import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";
import dayjs from "dayjs";

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
  const monthName = dayjs().month(month - 1).format("MMMM");
  return `${getEmployeeNamePart(employeeName)}_${employeeId}_${monthName}${year}.pdf`;
}

/** User-facing download filename: Payslip_EMPLOYEE_NAME_MONTH_YEAR.pdf */
export function getPayslipDownloadFileName(
  employeeName: string,
  month: number,
  year: number
): string {
  const safeName =
    employeeName
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "Employee";
  const monthName = dayjs().month(month - 1).format("MMMM");
  return `Payslip_${safeName}_${monthName}_${year}.pdf`;
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

function buildPayslipHtml(data: PayslipData): string {
  const monthShort = dayjs()
    .year(data.year)
    .month(data.month - 1)
    .format("MMM-YY");

  const periodStart = dayjs(data.payPeriodStart).format("DD.MM.YY");
  const periodEnd = dayjs(data.payPeriodEnd).format("DD.MM.YY");
  const periodRange = `${periodStart} - ${periodEnd}`;

  const companyName = escapeHtml(data.companyName || "");
  const companyAddress = escapeHtml(data.companyAddress || "");
  const employeeName = escapeHtml(data.employeeName || "");
  const icNo = escapeHtml(data.icNo || "");
  const employeeCode = escapeHtml(data.employeeCode || "");
  const department = escapeHtml(data.department || "");
  const jobTitle = escapeHtml(data.jobTitle || "");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<style>

@page{
  size:A4;
  margin:10mm;
}

body{
  font-family:"Times New Roman", serif;
  color:#000;
  background:#fff;
}

.page{
  width:720px;
  margin:0 auto;
}

.company-name{
  text-align:center;
  font-size:24px;
  font-weight:bold;
  color:#4d73c9;
  margin-top:40px;
}

.company-address{
  text-align:center;
  font-size:14px;
  margin-top:8px;
  margin-bottom:100px;
}

.payslip{
  width:100%;
  border-collapse:collapse;
  border:3px solid #000;
  table-layout:fixed;
}

.payslip td{
  border:1px solid #000;
  padding:2px;
  vertical-align:top;
}

.header td{
  font-size:18px;
  font-weight:bold;
  border-bottom:3px solid #000;
}

.header td:nth-child(1){
  width:25%;
  padding-left:10px;
}

.header td:nth-child(2){
  width:35%;
  text-align:center;
}

.header td:nth-child(3){
  width:40%;
  text-align:center;
}

.emp-section{
  width:65%;
}

.emp-table{
  width:100%;
  border-collapse:collapse;
}

.emp-table td{
  border:none;
  padding:2px;
  font-size:14px;
}

.label{
  width:160px;
  font-weight:bold;
}

.deduction-title{
  font-size:14px;
  height:25px;
}

.payment-section{
  height:240px;
}

.payment-table{
  width:100%;
  border-collapse:collapse;
}

.payment-table td{
  border:none;
  padding:2px 0;
  font-size:16px;
}

.amount{
  text-align:right;
}

.deduction-section{
  font-size:16px;
  padding-top:60px !important;
}

.gross-row td{
  border-top:3px solid #000;
  font-size:16px;
}

.net-row td{
  border-top:1px solid #000;
  font-size:16px;
}

.signature-row td{
  height:60px;
  vertical-align:bottom;
  font-weight:bold;
  border-top:3px solid #000;
}

.employee-sign{
  width:25%;
  text-align:center;
}

.employee-name{
  width:40%;
}

.company-sign{
  width:35%;
  text-align:center;
}

.note{
  text-align:center;
  font-size:18px;
  font-weight:bold;
  margin-top:20px;
}

</style>

</head>

<body>

<div class="page">

<div class="company-name">
${companyName}
</div>

<div class="company-address">
${companyAddress}
</div>

<table class="payslip">

<tr class="header">
<td>PAYSLIP</td>
<td>${monthShort}</td>
<td>${periodRange}</td>
</tr>

<tr>

<td colspan="2" class="emp-section">

<table class="emp-table">

<tr>
<td class="label">Name :</td>
<td><b>${employeeName}</b></td>
</tr>

<tr>
<td class="label">IC NO :</td>
<td><b>${icNo}</b></td>
</tr>

<tr>
<td class="label">Employee Code :</td>
<td>${employeeCode}</td>
</tr>

<tr>
<td class="label">Department</td>
<td>${department}</td>
</tr>

<tr>
<td class="label">Job Title :</td>
<td>${jobTitle}</td>
</tr>

</table>

</td>

<td class="deduction-title">
Deduction
</td>

</tr>

<tr>

<td colspan="2" class="payment-section">

<table class="payment-table">

<tr>
<td>Payment :</td>
<td></td>
</tr>

<tr>
<td colspan="2" style="height:20px"></td>
</tr>

<tr>
<td>Basic Rate</td>
<td class="amount">${formatAmount(data.basicRate)}</td>
</tr>

<tr>
<td>Working Days</td>
<td class="amount">${data.workingDays ?? ""}</td>
</tr>

<tr>
<td>Basic Pay</td>
<td class="amount">${formatAmount(data.basicPay)}</td>
</tr>

<tr>
<td colspan="2" style="height:110px"></td>
</tr>

<tr>
<td>Overtime</td>
<td class="amount">${formatAmount(data.overtime)}</td>
</tr>

<tr>
<td>Allowance</td>
<td class="amount">${formatAmount(data.allowance)}</td>
</tr>

</table>

</td>

<td class="deduction-section">

Employee Share = SGD ${formatAmount(data.employeeCpf)}

<br><br>

Employer Share = SGD ${formatAmount(data.employerCpf)}

</td>

</tr>

<tr class="gross-row">
<td>Gross pay</td>
<td align="right">${formatAmount(data.grossPay)}</td>
<td>Other : ${formatAmount(data.otherDeductions)}</td>
</tr>

<tr>
<td>Employee CPF</td>
<td align="right">${formatAmount(data.employeeCpf)}</td>
<td>
Monthly Gross : SGD ${formatAmount(data.basicPay)}
</td>
</tr>

<tr class="net-row">
<td>Net Pay</td>
<td align="right">${formatAmount(data.netPay)}</td>
<td></td>
</tr>

<tr class="signature-row">

<td class="employee-sign">
Employee
</td>

<td class="employee-name">
${employeeName}
</td>

<td class="company-sign">
${companyName}
</td>

</tr>

</table>

<div class="note">
***Computer Generated Payslip, No Signature Required***
</div>

</div>

</body>
</html>
`;
}

function isPdfBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

export async function generatePayslipPdf(data: PayslipData): Promise<Buffer> {
  const html = buildPayslipHtml(data);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });
    const pdfBuffer = Buffer.from(pdfBytes);
    if (!isPdfBuffer(pdfBuffer)) {
      throw new Error("Puppeteer did not return a valid PDF buffer");
    }
    return pdfBuffer;
  } finally {
    if (browser) await browser.close();
  }
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

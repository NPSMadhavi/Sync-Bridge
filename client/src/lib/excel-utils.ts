import * as XLSX from "xlsx";
import type { License } from "@shared/schema";

function toLocalYmd(year: number, monthIndex: number, day: number): string {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    !Number.isInteger(day) ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > 31
  ) {
    return "";
  }
  const d = new Date(year, monthIndex, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== monthIndex ||
    d.getDate() !== day
  ) {
    return "";
  }
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse Excel/CSV date values into YYYY-MM-DD. Prefers DD/MM/YYYY (SG). Returns "" if empty/invalid. */
function parseExcelDate(value: unknown): string {
  if (value == null || value === "") return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return toLocalYmd(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return toLocalYmd(parsed.y, parsed.m - 1, parsed.d);
    }
  }

  let str = String(value).trim();
  if (!str) return "";

  // Strip time portion if present
  str = str.replace(/T.*/, "").replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[AaPp][Mm])?$/, "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-").map(Number);
    return toLocalYmd(y, m - 1, d);
  }

  // Excel serial stored as string
  if (/^\d{4,6}(\.\d+)?$/.test(str)) {
    const serial = Number(str);
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (parsed) {
      return toLocalYmd(parsed.y, parsed.m - 1, parsed.d);
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (Singapore / common Excel export)
  const dmy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (dmy) {
    let [, day, month, year] = dmy;
    let y = Number(year);
    if (year.length === 2) {
      y += y >= 50 ? 1900 : 2000;
    }
    return toLocalYmd(y, Number(month) - 1, Number(day));
  }

  // YYYY/MM/DD or YYYY.MM.DD
  const ymd = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymd) {
    const [, year, month, day] = ymd;
    return toLocalYmd(Number(year), Number(month) - 1, Number(day));
  }

  // 15-Mar-1990 / 15 Mar 1990 / Mar 15, 1990
  const named = Date.parse(str);
  if (!Number.isNaN(named)) {
    const d = new Date(named);
    return toLocalYmd(d.getFullYear(), d.getMonth(), d.getDate());
  }

  return "";
}

function isValidYmd(value: string | null | undefined): boolean {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function formatLicenseTableDate(
  date: string | Date | null | undefined,
  fallback: string
): string {
  if (!date) return fallback;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLicenseKeyForTable(key: string): string {
  return key.length > 12 ? `${key.substring(0, 12)}...` : key;
}

function getLicenseStatusLabel(license: License): string {
  if (!license.expiryDate) return "";
  const expiryDate = new Date(license.expiryDate);
  const now = new Date();
  if (expiryDate < now) return "Expired";
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() + 30);
  if (expiryDate < threshold) return "Expiring Soon";
  return "Valid";
}

export function exportLicensesToExcel(licenses: License[]) {
  const rows = licenses.map((license) => ({
    Name: license.name || "",
    Type: license.type
      ? license.type.charAt(0).toUpperCase() + license.type.slice(1)
      : "",
    Key: formatLicenseKeyForTable(license.licenseKey || ""),
    "Purchase Date": formatLicenseTableDate(license.purchaseDate, "-"),
    "Expiry Date": formatLicenseTableDate(license.expiryDate, "Never"),
    Status: getLicenseStatusLabel(license),
    Asset: license.assetId != null ? `#${license.assetId}` : "-",
    Seats: license.seats != null ? license.seats : "-",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Licenses");
  downloadWorkbook(wb, `licenses-${new Date().toISOString().split("T")[0]}.xlsx`);
}

function nationalityLabel(n?: string | null): string {
  if (n === "foreigner") return "Foreigner";
  if (n === "pr") return "PR";
  if (n === "singaporean_pr") return "Singapore Citizen";
  return "Singapore Citizen";
}

function prStatusLabel(s?: string | null): string {
  if (s === "year_1") return "1 Year PR";
  if (s === "year_2") return "2 Year PR";
  if (s === "year_3_plus") return "3 Year PR and Above";
  return "";
}

function parseNationality(value: string): "citizen" | "pr" | "foreigner" {
  const v = value.trim().toLowerCase();
  if (v === "foreigner" || v === "foreign") return "foreigner";
  if (v === "pr" || v.includes("permanent resident")) return "pr";
  return "citizen";
}

function parseEmployeeStatus(value: string): "active" | "resigned" | "on_hold" | "terminated" {
  const v = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (v === "resigned" || v === "resign") return "resigned";
  if (v === "on_hold" || v === "onhold" || v === "hold") return "on_hold";
  if (v === "terminated" || v === "terminate" || v === "inactive") return "terminated";
  return "active";
}

function parseVisaType(
  value: string
): "s_pass" | "work_permit" | "employment_pass" | "pr" | "dependent_pass" | "ltvp" | "student_pass" | "other" {
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!v) return "other";
  if (v.includes("s_pass") || v === "spass" || v === "s_pass") return "s_pass";
  if (v.includes("work_permit") || v === "wp") return "work_permit";
  if (v.includes("employment_pass") || v === "ep") return "employment_pass";
  if (v === "pr" || v.includes("permanent")) return "pr";
  if (v.includes("dependent")) return "dependent_pass";
  if (v.includes("ltvp")) return "ltvp";
  if (v.includes("student")) return "student_pass";
  return "other";
}

function parsePrStatus(value: string): "year_1" | "year_2" | "year_3_plus" | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v.includes("1 year")) return "year_1";
  if (v.includes("2 year")) return "year_2";
  if (v.includes("3 year") || v.includes("above")) return "year_3_plus";
  return "year_3_plus";
}

export function exportPayrollConfigsToExcel(configs: any[]) {
  const rows = configs.map((c) => {
    const allowances = c.allowances || {};
    const deductions = c.deductions || {};
    const baseSalary = parseFloat(c.baseSalary || 0);
    return {
      "Employee Name": c.employeeName || "",
      "Employee ID": c.employeeId || "",
      Department: c.department || "",
      Designation: c.designation || "",
      Nationality: nationalityLabel(c.nationality),
      "PR Status": prStatusLabel(c.prStatus),
      "Date of Birth": c.dateOfBirth ? parseExcelDate(c.dateOfBirth) : "",
      "Base Salary (Monthly)": baseSalary,
      "Annual Salary": baseSalary * 12,
      "Payroll Period": c.payrollPeriod || "",
      "No of Working Days": c.noOfWorkingDays ?? "",
      "Hourly Rate": c.hourlyRate ?? "",
      "Overtime Rate": c.overtimeRate ?? "",
      "Allowance Transport": allowances.transport ?? 0,
      "Allowance Meal": allowances.meal ?? 0,
      "Allowance Phone": allowances.phone ?? 0,
      "Allowance Others": allowances.others ?? 0,
      "Deduction Medical": deductions.medical ?? 0,
      "Deduction Advance": deductions.advance ?? 0,
      "Deduction Others": deductions.others ?? 0,
      "CPF Rate (Employee)": c.cpfRate ?? "",
      "CPF Amount (Employee)": c.cpfAmount ?? "",
      "CPF Rate (Employer)": c.employerCpfRate ?? "",
      "CPF Amount (Employer)": c.employerCpfAmount ?? "",
      "Net Salary": c.netSalary ?? "",
      Active: c.isActive ? "Yes" : "No",
      "Effective From": c.effectiveFrom ? parseExcelDate(c.effectiveFrom) : "",
      "Effective To": c.effectiveTo ? parseExcelDate(c.effectiveTo) : "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payroll Configurations");
  downloadWorkbook(wb, `payroll-configurations-${new Date().toISOString().split("T")[0]}.xlsx`);
}

export function exportEmployeesToExcel(employees: any[]) {
  const rows = employees.map((e) => ({
    "Employee ID": e.employeeId || "",
    Name: e.name || "",
    Email: e.email || "",
    Department: e.department || "",
    Designation: e.designation || "",
    Company: e.companyName || "",
    "Join Date": e.joinDate ? parseExcelDate(e.joinDate) : "",
    "Date of Birth": e.dateOfBirth ? parseExcelDate(e.dateOfBirth) : "",
    "Salary (Monthly)": e.salary ?? "",
    "Annual Salary": e.annualSalary ?? "",
    Status: e.status || "active",
    Nationality: nationalityLabel(e.nationality),
    "PR Status": prStatusLabel(e.prStatus),
    "NRIC Number": e.nricNumber || "",
    "NRIC Expiry": e.nricExpiry ? parseExcelDate(e.nricExpiry) : "",
    "FIN Number": e.finNumber || "",
    "Passport Number": e.passportNumber || "",
    "Passport Expiry": e.passportExpiry ? parseExcelDate(e.passportExpiry) : "",
    "Visa Number": e.visaNumber || "",
    "Visa Expiry": e.visaExpiry ? parseExcelDate(e.visaExpiry) : "",
    "Visa Type": e.visaType || "",
    "Visa Remarks": e.visaRemarks || "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employees");
  downloadWorkbook(wb, `employees-${new Date().toISOString().split("T")[0]}.xlsx`);
}

export interface EmployeeImportRow {
  rowNumber: number;
  data: Record<string, unknown>;
  errors: string[];
}

function normalizeImportHeader(header: string): string {
  return header.replace(/^\ufeff/, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeImportRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeImportHeader(key)] = value;
  }
  return normalized;
}

const EMPLOYEE_IMPORT_COLUMN_ALIASES: Record<string, string[]> = {
  employeeId: [
    "employee id",
    "employeeid",
    "emp id",
    "emp code",
    "employee code",
    "staff id",
    "staff no",
    "staff number",
    "employee no",
    "employee number",
    "emp no",
    "emp number",
    "badge no",
    "badge number",
  ],
  name: ["name", "employee name", "full name", "staff name", "worker name"],
  email: ["email", "email address", "e-mail"],
  department: ["department", "dept", "division", "section"],
  designation: ["designation", "position", "job title", "title", "role", "job designation"],
  joinDate: [
    "join date",
    "joining date",
    "date of joining",
    "doj",
    "hire date",
    "date joined",
    "start date",
    "employment date",
    "commencement date",
  ],
  dateOfBirth: [
    "date of birth",
    "dob",
    "birth date",
    "birthday",
    "date of birth (dd/mm/yyyy)",
  ],
  salary: ["salary (monthly)", "salary", "monthly salary", "basic salary", "basic pay"],
  annualSalary: ["annual salary", "yearly salary", "salary (annual)", "annual pay"],
  status: ["status", "employee status", "employment status"],
  nationality: ["nationality", "citizenship", "residency"],
  prStatus: ["pr status", "pr year", "permanent resident status"],
  nricNumber: ["nric number", "nric", "nric no", "ic number", "ic no"],
  nricExpiry: ["nric expiry", "nric expiry date", "ic expiry", "nric exp"],
  finNumber: ["fin number", "fin", "fin no"],
  passportNumber: ["passport number", "passport no", "passport"],
  passportExpiry: ["passport expiry", "passport expiry date", "passport exp"],
  visaNumber: ["visa number", "visa no", "work permit number", "wp number"],
  visaExpiry: ["visa expiry", "visa expiry date", "work permit expiry"],
  visaType: ["visa type", "pass type", "work permit type"],
  visaRemarks: ["visa remarks", "visa notes", "remarks"],
  company: [
    "company",
    "company name",
    "employer",
    "organisation",
    "organization",
    "current company",
    "employer name",
    "company / employer",
    "working company",
  ],
  companyUen: ["uen", "uen number", "company uen", "registration number", "reg no"],
};

function normalizeCompanyKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickImportField(row: Record<string, unknown>, field: keyof typeof EMPLOYEE_IMPORT_COLUMN_ALIASES): unknown {
  const aliases = EMPLOYEE_IMPORT_COLUMN_ALIASES[field];
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  // Fuzzy header match (e.g. "Company Name *", "Employee Company")
  if (field === "company") {
    for (const [key, value] of Object.entries(row)) {
      if (value === undefined || value === null || String(value).trim() === "") continue;
      if (key.includes("company") && !key.includes("history") && !key.includes("uen")) {
        return value;
      }
      if (key.includes("employer") || key.includes("organisation") || key.includes("organization")) {
        return value;
      }
    }
  }

  return "";
}

function isImportRowEmpty(data: Record<string, unknown>): boolean {
  const keys = ["employeeId", "name", "department", "designation", "email"] as const;
  return keys.every((key) => !String(data[key] ?? "").trim());
}

export function parseEmployeeImportFile(buffer: ArrayBuffer): EmployeeImportRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const today = new Date().toISOString().split("T")[0];

  return rawRows
    .map((rawRow, index) => {
      const row = normalizeImportRow(rawRow);
      const rowNumber = index + 2;
      const errors: string[] = [];

      const employeeId = String(pickImportField(row, "employeeId")).trim();
      const name = String(pickImportField(row, "name")).trim();
      const email = String(pickImportField(row, "email")).trim();
      const department = String(pickImportField(row, "department")).trim() || "General";
      const designation = String(pickImportField(row, "designation")).trim() || "Staff";
      const joinDateRaw = pickImportField(row, "joinDate");
      const joinDateParsed = parseExcelDate(joinDateRaw);
      const joinDate = isValidYmd(joinDateParsed) ? joinDateParsed : today;
      const dobParsed = parseExcelDate(pickImportField(row, "dateOfBirth"));
      // DOB is optional — skip unparseable values instead of failing the row
      const dateOfBirth = isValidYmd(dobParsed) ? dobParsed : null;
      const salaryRaw = pickImportField(row, "salary");
      const annualSalaryRaw = pickImportField(row, "annualSalary");
      const status = parseEmployeeStatus(String(pickImportField(row, "status") || "active"));
      const nationalityRaw = String(pickImportField(row, "nationality") || "Singapore Citizen");
      const prStatusRaw = String(pickImportField(row, "prStatus"));
      const nationality = parseNationality(nationalityRaw);
      const companyName = String(pickImportField(row, "company")).trim();
      const companyUen = String(pickImportField(row, "companyUen")).trim();

      if (!name) errors.push("Name is required");

      const salary =
        salaryRaw === "" || salaryRaw == null
          ? null
          : String(salaryRaw);
      const annualSalary =
        annualSalaryRaw === "" || annualSalaryRaw == null
          ? salary
            ? String(Number(salary) * 12)
            : null
          : String(annualSalaryRaw);

      const data: Record<string, unknown> = {
        employeeId,
        name,
        email: email || null,
        department,
        designation,
        companyName: companyName || null,
        companyUen: companyUen || null,
        joinDate,
        dateOfBirth: dateOfBirth || null,
        salary,
        annualSalary,
        status,
        nationality,
        prStatus: nationality === "pr" ? parsePrStatus(prStatusRaw) || "year_3_plus" : null,
        nricNumber: String(pickImportField(row, "nricNumber")).trim() || null,
        nricExpiry: (() => {
          const v = parseExcelDate(pickImportField(row, "nricExpiry"));
          return isValidYmd(v) ? v : null;
        })(),
        finNumber: String(pickImportField(row, "finNumber")).trim() || null,
        passportNumber: String(pickImportField(row, "passportNumber")).trim() || null,
        passportExpiry: (() => {
          const v = parseExcelDate(pickImportField(row, "passportExpiry"));
          return isValidYmd(v) ? v : null;
        })(),
        visaNumber: String(pickImportField(row, "visaNumber")).trim() || null,
        visaExpiry: (() => {
          const v = parseExcelDate(pickImportField(row, "visaExpiry"));
          return isValidYmd(v) ? v : null;
        })(),
        visaType: parseVisaType(String(pickImportField(row, "visaType"))),
        visaRemarks: String(pickImportField(row, "visaRemarks")).trim() || null,
      };

      return { rowNumber, data, errors };
    })
    .filter((row) => !isImportRowEmpty(row.data));
}

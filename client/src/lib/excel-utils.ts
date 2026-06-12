import * as XLSX from "xlsx";

function parseExcelDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const d = new Date(parsed.y, parsed.m - 1, parsed.d);
      return d.toISOString().split("T")[0];
    }
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return str;
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
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
    Department: e.department || "",
    Designation: e.designation || "",
    "Join Date": e.joinDate ? parseExcelDate(e.joinDate) : "",
    "Date of Birth": e.dateOfBirth ? parseExcelDate(e.dateOfBirth) : "",
    "Salary (Monthly)": e.salary ?? "",
    Status: e.status || "active",
    Nationality: nationalityLabel(e.nationality),
    "PR Status": prStatusLabel(e.prStatus),
    "NRIC Number": e.nricNumber || "",
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

export function parseEmployeeImportFile(buffer: ArrayBuffer): EmployeeImportRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rawRows.map((row, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];

    const employeeId = String(row["Employee ID"] ?? row["employeeId"] ?? "").trim();
    const name = String(row["Name"] ?? row["name"] ?? "").trim();
    const department = String(row["Department"] ?? row["department"] ?? "").trim();
    const designation = String(row["Designation"] ?? row["designation"] ?? "").trim();
    const joinDate = parseExcelDate(row["Join Date"] ?? row["joinDate"] ?? "");
    const dateOfBirth = parseExcelDate(row["Date of Birth"] ?? row["dateOfBirth"] ?? "");
    const salaryRaw = row["Salary (Monthly)"] ?? row["salary"] ?? "";
    const status = String(row["Status"] ?? row["status"] ?? "active").trim() || "active";
    const nationalityRaw = String(row["Nationality"] ?? row["nationality"] ?? "Singapore Citizen");
    const prStatusRaw = String(row["PR Status"] ?? row["prStatus"] ?? "");
    const nationality = parseNationality(nationalityRaw);

    if (!employeeId) errors.push("Employee ID is required");
    if (!name) errors.push("Name is required");
    if (!department) errors.push("Department is required");
    if (!designation) errors.push("Designation is required");
    if (!joinDate) errors.push("Join Date is required");

    const salary =
      salaryRaw === "" || salaryRaw == null
        ? null
        : String(salaryRaw);

    const data: Record<string, unknown> = {
      employeeId,
      name,
      department,
      designation,
      joinDate,
      dateOfBirth: dateOfBirth || null,
      salary,
      status,
      nationality,
      prStatus: nationality === "pr" ? parsePrStatus(prStatusRaw) || "year_3_plus" : null,
      nricNumber: String(row["NRIC Number"] ?? row["nricNumber"] ?? "").trim() || null,
      finNumber: String(row["FIN Number"] ?? row["finNumber"] ?? "").trim() || null,
      passportNumber: String(row["Passport Number"] ?? row["passportNumber"] ?? "").trim() || null,
      passportExpiry: parseExcelDate(row["Passport Expiry"] ?? row["passportExpiry"] ?? "") || null,
      visaNumber: String(row["Visa Number"] ?? row["visaNumber"] ?? "").trim() || null,
      visaExpiry: parseExcelDate(row["Visa Expiry"] ?? row["visaExpiry"] ?? "") || null,
      visaType: String(row["Visa Type"] ?? row["visaType"] ?? "").trim() || null,
      visaRemarks: String(row["Visa Remarks"] ?? row["visaRemarks"] ?? "").trim() || null,
    };

    return { rowNumber, data, errors };
  });
}

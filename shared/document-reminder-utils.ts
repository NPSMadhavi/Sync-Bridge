export type DocumentReminderType =
  | "employee_passport"
  | "employee_visa"
  | "employee_nric"
  | "dependent_passport"
  | "dependent_visa"
  | "license"
  | "company_document"
  | "employee_document";

export const EMPLOYEE_PASSPORT_REMINDER_MONTHS = 7;
export const DEPENDENT_PASSPORT_REMINDER_MONTHS = 3;
export const DEPENDENT_VISA_REMINDER_MONTHS = 3;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function subtractMonths(date: Date, months: number): Date {
  const d = startOfDay(new Date(date));
  d.setMonth(d.getMonth() - months);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDisplayDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function getDaysUntilExpiry(expiryDate: Date | string, reference = new Date()): number {
  const expiry = startOfDay(typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate);
  const today = startOfDay(reference);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function documentTypeLabel(type: DocumentReminderType | string): string {
  switch (type) {
    case "employee_passport":
    case "dependent_passport":
      return "Passport";
    case "employee_visa":
    case "dependent_visa":
      return "Visa";
    case "employee_nric":
      return "NRIC";
    case "license":
      return "License";
    case "company_document":
    case "employee_document":
      return "Other Document";
    default:
      return "Document";
  }
}

export type DocumentExpiryRecord = {
  recordKey: string;
  employeeDbId?: number | null;
  employeeId: string;
  employeeName: string;
  dependentId?: number | null;
  dependentName?: string | null;
  documentType: string;
  documentNumber?: string;
  /** Human-readable title (company doc title, license name, or document type label). */
  documentTitle?: string;
  reminderType: string;
  expiryDate: string;
  daysRemaining?: number;
  daysExpired?: number;
  entityId?: number | null;
  email?: string;
};

export function formatEmployeeDocumentTypeEnum(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function expiryRecordItemType(record: DocumentExpiryRecord): "Document" | "License" {
  return record.reminderType === "license" ? "License" : "Document";
}

export function expiryRecordDisplayTitle(record: DocumentExpiryRecord): string {
  if (record.documentTitle?.trim()) {
    return record.documentTitle.trim();
  }
  if (record.reminderType === "license") {
    return record.employeeName || "—";
  }
  if (record.reminderType === "company_document") {
    const title = record.documentNumber?.trim();
    if (title && title !== "—") return title;
    return record.employeeName || "—";
  }
  return record.documentType || record.documentNumber || "—";
}

/** Value shown under the "Document Number" column (heading stays fixed). */
export function expiryRecordDocumentNumberDisplay(record: DocumentExpiryRecord): string {
  const type = record.documentType;
  if (type === "Passport" || type === "Visa" || type === "NRIC") {
    const num = record.documentNumber?.trim();
    return num && num !== "—" ? num : "—";
  }
  if (type === "License" || type === "Other Document") {
    return record.documentTitle?.trim() || "—";
  }
  const num = record.documentNumber?.trim();
  if (num && num !== "—") return num;
  return record.documentTitle?.trim() || "—";
}

export function expiryRecordEmployeeDisplayName(record: DocumentExpiryRecord): string {
  if (record.reminderType === "license" || record.reminderType === "company_document") {
    return "—";
  }
  if (record.dependentName) {
    return `${record.employeeName} (${record.dependentName})`;
  }
  return record.employeeName || "—";
}

export function documentExpiryStatus(
  record: Pick<DocumentExpiryRecord, "daysRemaining" | "daysExpired">
): "Expiring Soon" | "Expired" {
  if (record.daysExpired != null && record.daysExpired > 0) {
    return "Expired";
  }
  return "Expiring Soon";
}

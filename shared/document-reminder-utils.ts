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
  reminderType: string;
  expiryDate: string;
  daysRemaining?: number;
  daysExpired?: number;
  entityId?: number | null;
  email?: string;
};

import { storage } from "./storage";
import type { DocumentExpiryRecord } from "@shared/document-reminder-utils";

/** Placeholder addresses must never receive reminder emails. */
const PLACEHOLDER_EMAIL_PATTERN = /@syncbridge\.local$/i;

/** NRIC, Passport, and Visa reminders go to the employee's registered email address. */
export function isEmployeeIdentityReminderType(reminderType: string): boolean {
  return (
    reminderType === "employee_passport" ||
    reminderType === "employee_visa" ||
    reminderType === "employee_nric" ||
    reminderType === "dependent_passport" ||
    reminderType === "dependent_visa"
  );
}

/** License and company/employee document reminders use the user's profile email opt-in. */
export function isProfileReminderType(reminderType: string): boolean {
  return (
    reminderType === "license" ||
    reminderType === "company_document" ||
    reminderType === "employee_document"
  );
}

/**
 * True when an address is suitable as a reminder recipient.
 * Recipients must never come from SMTP env vars — only from employee/user records.
 */
export function isValidRecipientEmail(email: string | null | undefined): boolean {
  const trimmed = email?.trim();
  if (!trimmed || !trimmed.includes("@")) return false;
  if (PLACEHOLDER_EMAIL_PATTERN.test(trimmed)) return false;
  return true;
}

/**
 * Email address stored on the employee record (Employees page).
 */
export async function getEmployeeRegisteredEmail(employeeDbId: number): Promise<string | null> {
  const employee = await storage.getEmployee(employeeDbId);
  const email = employee?.email?.trim();
  return isValidRecipientEmail(email) ? email! : null;
}

/**
 * Email recipients for NRIC, Passport, and Visa automatic/manual reminders.
 */
export async function getIdentityDocumentReminderEmails(
  employeeDbId: number
): Promise<string[]> {
  const email = await getEmployeeRegisteredEmail(employeeDbId);
  return email ? [email] : [];
}

/**
 * Profile email for a single user when they opted in (Settings → Profile → Save).
 */
export async function getProfileReminderEmailForUser(userId: number): Promise<string | null> {
  const user = await storage.getUser(userId);
  if (!user?.sendReminderEmails) return null;
  const email = user.email?.trim();
  return isValidRecipientEmail(email) ? email! : null;
}

/**
 * Resolve recipients for manual Send Reminder from the dashboard (logged-in user).
 */
export async function getManualReminderRecipients(
  record: DocumentExpiryRecord,
  requestingUserId: number
): Promise<{ emails: string[]; error?: string; notificationOnly?: boolean }> {
  if (isEmployeeIdentityReminderType(record.reminderType)) {
    if (record.employeeDbId == null) {
      return {
        emails: [],
        error: `Employee "${record.employeeName}" is not linked to an employee record.`,
      };
    }

    const email = await getEmployeeRegisteredEmail(record.employeeDbId);
    if (!email) {
      return {
        emails: [],
        error: `Employee "${record.employeeName}" does not have a valid email on the Employees record. Please update the employee profile.`,
      };
    }

    return { emails: [email] };
  }

  if (isProfileReminderType(record.reminderType)) {
    const user = await storage.getUser(requestingUserId);
    if (!user?.sendReminderEmails) {
      return { emails: [], notificationOnly: true };
    }

    const email = user.email?.trim();
    if (!isValidRecipientEmail(email)) {
      return {
        emails: [],
        error: "Add a valid email address in Settings → Profile before sending reminders for licenses or documents.",
      };
    }

    return { emails: [email!] };
  }

  return { emails: [], error: `Unsupported reminder type: ${record.reminderType}` };
}

/**
 * Scheduled/automatic license & document reminders: profile emails for users who opted in.
 * Each address comes from the user's saved profile — never from SMTP configuration.
 */
export async function getOptedInProfileReminderEmails(tenantId?: number): Promise<string[]> {
  const users = await storage.getUsers(tenantId);
  const emails: string[] = [];

  for (const user of users) {
    if (!user.sendReminderEmails) continue;
    const email = user.email?.trim();
    if (isValidRecipientEmail(email) && !emails.includes(email!)) {
      emails.push(email!);
    }
  }

  return emails;
}

/** @deprecated Use getOptedInProfileReminderEmails */
export async function getProfileReminderRecipientEmails(
  tenantId?: number
): Promise<string[]> {
  return getOptedInProfileReminderEmails(tenantId);
}

/**
 * Users who should receive in-app expiry reminder notifications:
 * admins/HR/super admins, profile opt-in users, and optionally IT managers.
 */
export async function getReminderNotificationUsers(
  tenantId?: number,
  options?: { includeItManagers?: boolean }
): Promise<import("@shared/schema").User[]> {
  if (tenantId == null) {
    return [];
  }

  const adminUsers = await storage.getNotificationRecipientUsers(tenantId);
  const allUsers = await storage.getUsers(tenantId);
  const optedIn = allUsers.filter((user) => user.sendReminderEmails);
  const itManagers =
    options?.includeItManagers === true
      ? allUsers.filter((user) => user.role === "it_manager")
      : [];

  const byId = new Map<number, import("@shared/schema").User>();
  for (const user of [...adminUsers, ...optedIn, ...itManagers]) {
    byId.set(user.id, user);
  }
  return Array.from(byId.values());
}

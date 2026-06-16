import type { DocumentExpiryRecord } from "@shared/document-reminder-utils";
import { getDaysUntilExpiry, documentTypeLabel } from "@shared/document-reminder-utils";
import {
  sendEmailDetailed,
  generateDocumentExpiryEmailHTML,
  generateDocumentExpiryEmailText,
  generateLicenseExpiryEmailHTML,
  generateLicenseExpiryEmailText,
  generatePassportVisaReminderEmailHTML,
  generatePassportVisaReminderEmailText,
} from "./email";
import {
  getManualReminderRecipients,
  getReminderNotificationUsers,
  isEmployeeIdentityReminderType,
  isProfileReminderType,
} from "./reminder-email-recipients";
import { storage } from "./storage";

export type SendExpiryReminderResult = {
  recordKey: string;
  success: boolean;
  error?: string;
  recipients?: string[];
  notificationOnly?: boolean;
};

function identityDocLabel(reminderType: string): string {
  if (reminderType.includes("nric")) return "NRIC";
  if (reminderType.includes("passport")) return "Passport";
  if (reminderType.includes("visa")) return "Visa";
  return documentTypeLabel(reminderType);
}

async function createReminderNotifications(
  record: DocumentExpiryRecord,
  tenantId: number | undefined,
  daysUntilExpiry: number,
  requestingUserId?: number
): Promise<number> {
  const notificationUsers = await getReminderNotificationUsers(tenantId, {
    includeItManagers: record.reminderType === "license",
  });

  const byId = new Map(notificationUsers.map((user) => [user.id, user]));
  if (requestingUserId != null) {
    const requestingUser = await storage.getUser(requestingUserId);
    if (requestingUser) {
      byId.set(requestingUser.id, requestingUser);
    }
  }

  const message =
    daysUntilExpiry <= 0
      ? `${record.documentType} "${record.employeeName}" has expired`
      : `${record.documentType} "${record.employeeName}" expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`;

  const entityType = `manual_reminder:${record.reminderType}:${record.entityId ?? record.employeeDbId ?? ""}:${record.expiryDate}:${Date.now()}`;
  const notificationType = record.reminderType === "license" ? "license_expiry" : "document_expiry";

  let created = 0;
  for (const user of byId.values()) {
    await storage.createNotification({
      tenantId: tenantId ?? user.tenantId ?? null,
      type: notificationType,
      message,
      targetUserId: user.id,
      seen: false,
      entityId: record.employeeDbId ?? record.entityId ?? null,
      entityType,
    });
    created++;
  }
  return created;
}

async function deliverReminderEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  tenantId?: number;
}) {
  let result = await sendEmailDetailed({
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    tenantId: params.tenantId,
  });

  if (!result.success) {
    result = await sendEmailDetailed({
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
  }

  return result;
}

export async function sendExpiryRecordReminder(
  record: DocumentExpiryRecord,
  requestingUserId: number,
  tenantId?: number
): Promise<SendExpiryReminderResult> {
  const {
    emails: recipients,
    error: recipientError,
    notificationOnly,
  } = await getManualReminderRecipients(record, requestingUserId);

  const expiryDate = new Date(record.expiryDate);
  const daysUntilExpiry =
    record.daysRemaining ??
    (record.daysExpired != null ? -record.daysExpired : getDaysUntilExpiry(record.expiryDate));

  if (recipients.length === 0) {
    if (isProfileReminderType(record.reminderType) && notificationOnly) {
      await createReminderNotifications(record, tenantId, daysUntilExpiry, requestingUserId);
      await recordReminderHistory(record, tenantId, expiryDate, false);
      return {
        recordKey: record.recordKey,
        success: true,
        notificationOnly: true,
      };
    }

    return {
      recordKey: record.recordKey,
      success: false,
      error: recipientError || "No reminder email recipient found.",
    };
  }

  let subject: string;
  let html: string;
  let text: string;

  if (record.reminderType === "license") {
    subject =
      daysUntilExpiry <= 0
        ? `🚨 URGENT: License Expired - ${record.employeeName}`
        : `📋 License Expiry Reminder - ${record.employeeName} (${daysUntilExpiry} days)`;
    html = generateLicenseExpiryEmailHTML(record.employeeName, record.expiryDate, daysUntilExpiry);
    text = generateLicenseExpiryEmailText(record.employeeName, record.expiryDate, daysUntilExpiry);
  } else if (isEmployeeIdentityReminderType(record.reminderType)) {
    const docLabel = identityDocLabel(record.reminderType);
    subject = `${docLabel} Expiry Reminder`;
    const daysRemaining = Math.max(daysUntilExpiry, 0);
    html = generatePassportVisaReminderEmailHTML({
      employeeName: record.employeeName,
      dependentName: record.dependentName ?? undefined,
      documentType: docLabel,
      expiryDate,
      daysRemaining,
    });
    text = generatePassportVisaReminderEmailText({
      employeeName: record.employeeName,
      dependentName: record.dependentName ?? undefined,
      documentType: docLabel,
      expiryDate,
      daysRemaining,
    });
  } else {
    const title =
      record.reminderType === "company_document" || record.reminderType === "employee_document"
        ? record.employeeName
        : `${record.documentType} - ${record.employeeName}`;
    subject =
      daysUntilExpiry <= 0
        ? `🚨 URGENT: Document Expired - ${title}`
        : `📋 Document Expiry Reminder - ${title} (${daysUntilExpiry} days)`;
    html = generateDocumentExpiryEmailHTML(title, record.expiryDate, daysUntilExpiry);
    text = generateDocumentExpiryEmailText(title, record.expiryDate, daysUntilExpiry);
  }

  const sentTo: string[] = [];
  let lastError: string | undefined;

  for (const to of recipients) {
    const result = await deliverReminderEmail({ to, subject, html, text, tenantId });
    if (result.success) {
      sentTo.push(to);
    } else {
      lastError = result.error;
    }
  }

  if (sentTo.length === 0) {
    return {
      recordKey: record.recordKey,
      success: false,
      error: lastError || "Email delivery failed. Verify SMTP settings under Settings → Email.",
    };
  }

  await createReminderNotifications(record, tenantId, daysUntilExpiry, requestingUserId);
  await recordReminderHistory(record, tenantId, expiryDate, true);

  return {
    recordKey: record.recordKey,
    success: true,
    recipients: sentTo,
  };
}

async function recordReminderHistory(
  record: DocumentExpiryRecord,
  tenantId: number | undefined,
  expiryDate: Date,
  emailSent: boolean
): Promise<void> {
  try {
    await storage.scheduleDocumentReminder({
      tenantId: tenantId ?? null,
      employeeId: record.employeeDbId ?? null,
      dependentId: record.dependentId ?? null,
      entityId: record.entityId ?? null,
      documentType: record.reminderType,
      expiryDate,
      reminderDate: new Date(),
      status: "sent",
      reminderKind: "manual_send",
      emailSentAt: emailSent ? new Date() : null,
    });
  } catch (historyError) {
    console.warn("Reminder sent but history log failed:", historyError);
  }
}

export async function sendExpiryRecordReminders(
  records: DocumentExpiryRecord[],
  requestingUserId: number,
  tenantId?: number
): Promise<SendExpiryReminderResult[]> {
  const results: SendExpiryReminderResult[] = [];
  for (const record of records) {
    results.push(await sendExpiryRecordReminder(record, requestingUserId, tenantId));
  }
  return results;
}

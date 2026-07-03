import { storage } from "./storage";
import {
  sendEmail,
  generateDocumentExpiryEmailHTML,
  generateDocumentExpiryEmailText,
  generateLicenseExpiryEmailHTML,
  generateLicenseExpiryEmailText,
} from "./email";
import {
  getOptedInProfileReminderEmails,
  getProfileReminderEmailForUser,
  getReminderNotificationUsers,
} from "./reminder-email-recipients";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return startOfDay(d);
}

function buildNotificationEntityType(
  kind: "company_document" | "license",
  entityId: number,
  daysBefore: number,
  expiryDate: Date
): string {
  return `scheduled:${kind}:${entityId}:${daysBefore}:${startOfDay(expiryDate).toISOString()}`;
}

type ReminderPayload = {
  kind: "company_document" | "license";
  entityId: number;
  title: string;
  expiryDate: Date;
  daysBefore: number;
  tenantId?: number | null;
  reminderDate: Date;
  uploadedBy?: number | null;
};

/**
 * Sends configured expiry reminders for company documents and licenses
 * on the scheduled reminder date (expiry date minus daysBefore).
 */
export class ScheduledExpiryReminderService {
  private static instance: ScheduledExpiryReminderService;

  static getInstance(): ScheduledExpiryReminderService {
    if (!ScheduledExpiryReminderService.instance) {
      ScheduledExpiryReminderService.instance = new ScheduledExpiryReminderService();
    }
    return ScheduledExpiryReminderService.instance;
  }

  async processDueReminders(): Promise<void> {
    const today = startOfDay(new Date());
    console.log("📅 Processing scheduled expiry reminders for", today.toDateString());

    await this.processCompanyDocuments(today);
    await this.processLicenses(today);

    console.log("✅ Scheduled expiry reminders completed");
  }

  private async processCompanyDocuments(today: Date): Promise<void> {
    const documents = await storage.getCompanyDocuments();

    for (const doc of documents) {
      if (!doc.expiryDate) continue;

      const reminders = await storage.getDocumentRemindersForDocument(doc.id);
      if (reminders.length === 0) continue;

      const expiryDate = startOfDay(new Date(doc.expiryDate));

      for (const { daysBefore } of reminders) {
        const reminderDate = subtractDays(expiryDate, daysBefore);
        if (!isSameDay(today, reminderDate)) continue;

        const reminderKind = `days_before_${daysBefore}`;
        const alreadySent = await storage.hasConfiguredReminderBeenSent({
          documentType: "company_document",
          entityId: doc.id,
          reminderKind,
          reminderDate,
        });
        if (alreadySent) continue;

        await this.deliverReminder({
          kind: "company_document",
          entityId: doc.id,
          title: doc.title,
          expiryDate,
          daysBefore,
          tenantId: doc.tenantId,
          reminderDate,
          uploadedBy: doc.uploadedBy ?? null,
        });
      }
    }
  }

  private async processLicenses(today: Date): Promise<void> {
    const allLicenses = await storage.getAllLicenses();

    for (const license of allLicenses) {
      if (!license.expiryDate) continue;

      const reminders = await storage.getLicenseRemindersForLicense(license.id);
      if (reminders.length === 0) continue;

      const expiryDate = startOfDay(new Date(license.expiryDate));

      for (const { daysBefore } of reminders) {
        const reminderDate = subtractDays(expiryDate, daysBefore);
        if (!isSameDay(today, reminderDate)) continue;

        const reminderKind = `days_before_${daysBefore}`;
        const alreadySent = await storage.hasConfiguredReminderBeenSent({
          documentType: "license",
          entityId: license.id,
          reminderKind,
          reminderDate,
        });
        if (alreadySent) continue;

        await this.deliverReminder({
          kind: "license",
          entityId: license.id,
          title: license.name,
          expiryDate,
          daysBefore,
          tenantId: license.tenantId,
          reminderDate,
        });
      }
    }
  }

  private async resolveEmailRecipients(payload: ReminderPayload): Promise<string[]> {
    if (payload.kind === "company_document" && payload.uploadedBy) {
      const uploaderEmail = await getProfileReminderEmailForUser(payload.uploadedBy);
      return uploaderEmail ? [uploaderEmail] : [];
    }

    return getOptedInProfileReminderEmails(payload.tenantId ?? undefined);
  }

  private async deliverReminder(payload: ReminderPayload): Promise<void> {
    const daysUntilExpiry = Math.ceil(
      (payload.expiryDate.getTime() - startOfDay(new Date()).getTime()) / (1000 * 60 * 60 * 24)
    );

    const emailRecipients = await this.resolveEmailRecipients(payload);

    const subject =
      payload.kind === "license"
        ? this.buildLicenseSubject(payload.title, daysUntilExpiry)
        : this.buildDocumentSubject(payload.title, daysUntilExpiry);

    let emailSent = false;

    if (emailRecipients.length > 0) {
      for (const recipient of emailRecipients) {
        const html =
          payload.kind === "license"
            ? generateLicenseExpiryEmailHTML(payload.title, payload.expiryDate.toISOString(), daysUntilExpiry)
            : generateDocumentExpiryEmailHTML(
                payload.title,
                payload.expiryDate.toISOString(),
                daysUntilExpiry
              );
        const text =
          payload.kind === "license"
            ? generateLicenseExpiryEmailText(payload.title, payload.expiryDate.toISOString(), daysUntilExpiry)
            : generateDocumentExpiryEmailText(
                payload.title,
                payload.expiryDate.toISOString(),
                daysUntilExpiry
              );

        const success = await sendEmail({ to: recipient, subject, html, text });
        if (success) {
          emailSent = true;
          console.log(`📧 Reminder sent to ${recipient} for ${payload.kind}: ${payload.title}`);
        }
      }
    } else {
      console.log(`⚠️ No email recipients for ${payload.kind}: ${payload.title}`);
    }

    await this.createInAppNotifications(payload, daysUntilExpiry);

    await storage.scheduleDocumentReminder({
      tenantId: payload.tenantId ?? null,
      employeeId: null,
      entityId: payload.entityId,
      documentType: payload.kind,
      expiryDate: payload.expiryDate,
      reminderDate: payload.reminderDate,
      status: "sent",
      reminderKind: `days_before_${payload.daysBefore}`,
      emailSentAt: emailSent ? new Date() : undefined,
    });
  }

  private async createInAppNotifications(payload: ReminderPayload, daysUntilExpiry: number): Promise<void> {
    const notificationType = payload.kind === "license" ? "license_expiry" : "document_expiry";
    const message =
      daysUntilExpiry <= 0
        ? `${payload.kind === "license" ? "License" : "Document"} "${payload.title}" has expired`
        : `${payload.kind === "license" ? "License" : "Document"} "${payload.title}" expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`;

    const entityType = buildNotificationEntityType(
      payload.kind,
      payload.entityId,
      payload.daysBefore,
      payload.expiryDate
    );

    const users = await getReminderNotificationUsers(payload.tenantId ?? undefined, {
      includeItManagers: payload.kind === "license",
    });

    for (const user of users) {
      if (payload.tenantId != null && user.tenantId != null && user.tenantId !== payload.tenantId) {
        continue;
      }
      const exists = await storage.hasNotificationForEntity(user.id, entityType);
      if (exists) continue;

      await storage.createNotification({
        tenantId: payload.tenantId ?? user.tenantId ?? null,
        type: notificationType,
        message,
        targetUserId: user.id,
        seen: false,
        entityId: payload.entityId,
        entityType,
      });
    }
  }

  private buildDocumentSubject(title: string, daysUntilExpiry: number): string {
    if (daysUntilExpiry <= 0) return `🚨 URGENT: Document Expired - ${title}`;
    if (daysUntilExpiry <= 7) {
      return `⚠️ Document Expiring Soon - ${title} (${daysUntilExpiry} days)`;
    }
    return `📋 Document Expiry Reminder - ${title} (${daysUntilExpiry} days)`;
  }

  private buildLicenseSubject(name: string, daysUntilExpiry: number): string {
    if (daysUntilExpiry <= 0) return `🚨 URGENT: License Expired - ${name}`;
    if (daysUntilExpiry <= 7) {
      return `⚠️ License Expiring Soon - ${name} (${daysUntilExpiry} days)`;
    }
    return `📋 License Expiry Reminder - ${name} (${daysUntilExpiry} days)`;
  }
}

export function initializeScheduledExpiryReminders(): void {
  const service = ScheduledExpiryReminderService.getInstance();

  setTimeout(() => service.processDueReminders(), 90000);

  const interval = 24 * 60 * 60 * 1000;
  setInterval(() => service.processDueReminders(), interval);

  console.log("📅 Scheduled expiry reminder service initialized (daily checks)");
}

export const scheduledExpiryReminderService = ScheduledExpiryReminderService.getInstance();

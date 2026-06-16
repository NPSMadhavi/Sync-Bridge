import { storage } from "./storage";
import { getReminderNotificationUsers } from "./reminder-email-recipients";
import { formatDisplayDate } from "@shared/document-reminder-utils";
import type { DocumentExpiryRecord } from "@shared/document-reminder-utils";

function buildEntityType(record: DocumentExpiryRecord): string {
  return [
    "doc_reminder",
    record.reminderType,
    record.employeeDbId ?? "",
    record.dependentId ?? "",
    record.entityId ?? "",
    record.expiryDate,
  ].join(":");
}

function buildNotificationMessage(record: DocumentExpiryRecord, mode: "expiring" | "expired"): string {
  const dependent = record.dependentName ? ` (${record.dependentName})` : "";
  const docLabel = record.documentType;
  const expiry = formatDisplayDate(record.expiryDate);
  if (mode === "expired") {
    return `${docLabel} for ${record.employeeName}${dependent} expired on ${expiry}`;
  }
  const days = record.daysRemaining ?? 0;
  return `${docLabel} for ${record.employeeName}${dependent} expires in ${days} day${days === 1 ? "" : "s"} (${expiry})`;
}

export class DocumentReminderNotificationSync {
  private static instance: DocumentReminderNotificationSync;

  static getInstance(): DocumentReminderNotificationSync {
    if (!DocumentReminderNotificationSync.instance) {
      DocumentReminderNotificationSync.instance = new DocumentReminderNotificationSync();
    }
    return DocumentReminderNotificationSync.instance;
  }

  async syncAllTenants(): Promise<void> {
    console.log("🔔 Syncing document reminder notifications...");
    try {
      await this.syncForTenant(undefined);
      console.log("✅ Document reminder notifications synced");
    } catch (error) {
      console.error("❌ Document reminder notification sync error:", error);
    }
  }

  async syncForTenant(tenantId?: number): Promise<void> {
    const recipients = await getReminderNotificationUsers(tenantId, { includeItManagers: true });
    if (recipients.length === 0) return;

    const expiring = await storage.getDocumentExpiryRecords("expiring", tenantId);
    const expired = await storage.getDocumentExpiryRecords("expired", tenantId);

    for (const record of [...expiring, ...expired]) {
      const snoozed = await storage.isDocumentReminderSnoozed(
        record.reminderType,
        record.employeeDbId,
        record.dependentId,
        record.entityId
      );
      if (snoozed) continue;

      const mode = record.daysExpired != null ? "expired" : "expiring";
      const entityType = buildEntityType(record);
      const notificationType =
        record.reminderType === "license" ? "license_expiry" : "document_expiry";

      for (const user of recipients) {
        if (tenantId !== undefined && user.tenantId !== tenantId && !user.isSuperAdmin) {
          continue;
        }
        const exists = await storage.hasNotificationForEntity(user.id, entityType);
        if (exists) continue;

        await storage.createNotification({
          tenantId: tenantId ?? user.tenantId ?? null,
          type: notificationType,
          message: buildNotificationMessage(record, mode),
          targetUserId: user.id,
          seen: false,
          entityId: record.employeeDbId ?? record.entityId ?? null,
          entityType,
        });
      }
    }
  }
}

export function initializeDocumentReminderNotificationSync(): void {
  const sync = DocumentReminderNotificationSync.getInstance();
  setTimeout(() => sync.syncAllTenants(), 60000);
  setInterval(() => sync.syncAllTenants(), 24 * 60 * 60 * 1000);
}

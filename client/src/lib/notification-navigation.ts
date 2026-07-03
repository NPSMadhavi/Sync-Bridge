import type { Notification } from "@shared/schema";

const EMPLOYEE_REMINDER_TYPES = new Set([
  "employee_passport",
  "employee_visa",
  "employee_nric",
  "employee_document",
  "dependent_passport",
  "dependent_visa",
]);

function buildViewHref(path: string, id?: number | null): string {
  if (id != null && Number.isFinite(id)) {
    return `${path}?view=${id}`;
  }
  return path;
}

function hrefForReminderType(
  reminderType: string,
  options: {
    employeeDbId?: number | null;
    recordEntityId?: number | null;
    fallbackEntityId?: number | null;
  }
): string | null {
  const { employeeDbId, recordEntityId, fallbackEntityId } = options;

  if (reminderType === "license") {
    return buildViewHref("/licenses", recordEntityId ?? fallbackEntityId);
  }
  if (reminderType === "company_document") {
    return buildViewHref("/documents", recordEntityId ?? fallbackEntityId);
  }
  if (EMPLOYEE_REMINDER_TYPES.has(reminderType)) {
    return buildViewHref("/employees", employeeDbId ?? fallbackEntityId);
  }
  return null;
}

/** Resolve in-app navigation for a notification, when a related page exists. */
export function getNotificationHref(notification: Notification): string | null {
  const entityType = notification.entityType || "";
  const parts = entityType.split(":");
  const prefix = parts[0];
  const fallbackEntityId = notification.entityId ?? null;

  if (prefix === "doc_reminder") {
    const reminderType = parts[1] || "";
    const employeeDbId = parts[2] ? Number(parts[2]) : null;
    const recordEntityId = parts[4] ? Number(parts[4]) : null;
    return hrefForReminderType(reminderType, {
      employeeDbId: Number.isFinite(employeeDbId!) ? employeeDbId : null,
      recordEntityId: Number.isFinite(recordEntityId!) ? recordEntityId : null,
      fallbackEntityId,
    });
  }

  if (prefix === "manual_reminder") {
    const reminderType = parts[1] || "";
    const recordEntityId = parts[2] ? Number(parts[2]) : null;
    const resolvedId = Number.isFinite(recordEntityId!) ? recordEntityId : null;
    return hrefForReminderType(reminderType, {
      employeeDbId: EMPLOYEE_REMINDER_TYPES.has(reminderType) ? resolvedId : null,
      recordEntityId: !EMPLOYEE_REMINDER_TYPES.has(reminderType) ? resolvedId : null,
      fallbackEntityId,
    });
  }

  if (prefix === "scheduled") {
    const kind = parts[1];
    const entityId = parts[2] ? Number(parts[2]) : fallbackEntityId;
    if (kind === "license") return buildViewHref("/licenses", entityId);
    if (kind === "company_document") return buildViewHref("/documents", entityId);
    return null;
  }

  if (prefix === "document_expiry") {
    const documentId = parts[1] ? Number(parts[1]) : fallbackEntityId;
    return buildViewHref("/documents", documentId);
  }

  if (entityType === "license" || notification.type === "license_expiry") {
    return buildViewHref("/licenses", fallbackEntityId);
  }

  if (entityType === "employee_document") {
    return buildViewHref("/employees", fallbackEntityId);
  }

  if (entityType === "asset_assignment") {
    return buildViewHref("/assets", fallbackEntityId);
  }

  return null;
}

export function notificationHasNavigation(notification: Notification): boolean {
  return getNotificationHref(notification) != null;
}

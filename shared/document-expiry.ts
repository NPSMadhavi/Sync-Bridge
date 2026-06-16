export const DOCUMENT_EXPIRY_SOON_DAYS = 30;

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

type ExpiryInput = string | Date | null | undefined;

export function getDaysUntilExpiry(
  expiryDate: ExpiryInput,
  referenceDate: Date = new Date()
): number | null {
  if (!expiryDate) return null;
  const expiry = startOfDay(new Date(expiryDate));
  const today = startOfDay(referenceDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function isDocumentExpired(
  expiryDate: ExpiryInput,
  referenceDate: Date = new Date()
): boolean {
  if (!expiryDate) return false;
  const expiry = startOfDay(new Date(expiryDate));
  const today = startOfDay(referenceDate);
  return expiry.getTime() <= today.getTime();
}

export function isDocumentExpiringSoon(
  expiryDate: ExpiryInput,
  referenceDate: Date = new Date(),
  withinDays: number = DOCUMENT_EXPIRY_SOON_DAYS
): boolean {
  if (!expiryDate) return false;
  const expiry = startOfDay(new Date(expiryDate));
  const today = startOfDay(referenceDate);
  const threshold = startOfDay(referenceDate);
  threshold.setDate(today.getDate() + withinDays);
  return expiry.getTime() > today.getTime() && expiry.getTime() <= threshold.getTime();
}

export type DocumentExpiryStatus = "noExpiry" | "valid" | "expiringSoon" | "expired";

export function getDocumentExpiryStatus(
  expiryDate: ExpiryInput,
  referenceDate: Date = new Date()
): DocumentExpiryStatus {
  if (!expiryDate) return "noExpiry";
  if (isDocumentExpired(expiryDate, referenceDate)) return "expired";
  if (isDocumentExpiringSoon(expiryDate, referenceDate)) return "expiringSoon";
  return "valid";
}

export interface DocumentExpiryStats {
  total: number;
  noExpiry: number;
  valid: number;
  expiringSoon: number;
  expired: number;
}

export function computeDocumentExpiryStats<T extends { expiryDate?: ExpiryInput }>(
  documents: T[],
  referenceDate: Date = new Date()
): DocumentExpiryStats {
  let noExpiry = 0;
  let valid = 0;
  let expiringSoon = 0;
  let expired = 0;

  for (const doc of documents) {
    switch (getDocumentExpiryStatus(doc.expiryDate, referenceDate)) {
      case "noExpiry":
        noExpiry++;
        break;
      case "valid":
        valid++;
        break;
      case "expiringSoon":
        expiringSoon++;
        break;
      case "expired":
        expired++;
        break;
    }
  }

  return {
    total: documents.length,
    noExpiry,
    valid,
    expiringSoon,
    expired,
  };
}

export function filterExpiringSoonDocuments<T extends { expiryDate?: ExpiryInput }>(
  documents: T[],
  referenceDate: Date = new Date()
): T[] {
  return documents.filter((doc) => isDocumentExpiringSoon(doc.expiryDate, referenceDate));
}

/** Passport/visa (or any date) expiring within the soon window or already past due. */
export function isExpiryDueForAttention(
  expiryDate: ExpiryInput,
  referenceDate: Date = new Date()
): boolean {
  if (!expiryDate) return false;
  return isDocumentExpiringSoon(expiryDate, referenceDate) || isDocumentExpired(expiryDate, referenceDate);
}

export function filterExpiredDocuments<T extends { expiryDate?: ExpiryInput }>(
  documents: T[],
  referenceDate: Date = new Date()
): T[] {
  return documents.filter((doc) => isDocumentExpired(doc.expiryDate, referenceDate));
}

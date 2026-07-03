import { eq } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { employeeDocuments, employees } from "@shared/schema";

export type GlobalSearchResultType = "employee" | "asset" | "license" | "document";

export interface GlobalSearchResult {
  type: GlobalSearchResultType;
  id: number;
  title: string;
  subtitle: string;
  href: string;
}

const MAX_PER_TYPE = 5;
const MAX_TOTAL = 20;

function matchesQuery(query: string, ...values: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return false;
  return values.some((value) => value != null && String(value).toLowerCase().includes(q));
}

export interface GlobalSearchOptions {
  includeEmployees?: boolean;
  includeAssets?: boolean;
  includeLicenses?: boolean;
  includeDocuments?: boolean;
}

export async function performGlobalSearch(
  query: string,
  tenantId: number | undefined,
  options: GlobalSearchOptions = {}
): Promise<GlobalSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const results: GlobalSearchResult[] = [];
  const countByType = (type: GlobalSearchResultType) =>
    results.filter((item) => item.type === type).length;

  if (options.includeEmployees !== false) {
    const employeeRows = await storage.getEmployees(tenantId);
    for (const employee of employeeRows) {
      if (
        !matchesQuery(
          q,
          employee.name,
          employee.employeeId,
          employee.email,
          employee.department,
          employee.designation,
          employee.companyName
        )
      ) {
        continue;
      }
      results.push({
        type: "employee",
        id: employee.id,
        title: employee.name,
        subtitle: `${employee.employeeId} · ${employee.department}`,
        href: `/employees?q=${encodeURIComponent(q)}`,
      });
      if (countByType("employee") >= MAX_PER_TYPE) break;
    }
  }

  if (options.includeAssets !== false) {
    const assets = await storage.getAssets(tenantId);
    for (const asset of assets) {
      if (!matchesQuery(q, asset.tag, asset.serial, asset.type, asset.category, asset.location)) {
        continue;
      }
      results.push({
        type: "asset",
        id: asset.id,
        title: `${asset.type} · ${asset.tag}`,
        subtitle: `Serial: ${asset.serial}`,
        href: `/assets?q=${encodeURIComponent(q)}`,
      });
      if (countByType("asset") >= MAX_PER_TYPE) break;
    }
  }

  if (options.includeLicenses !== false) {
    const licenses = await storage.getAllLicenses(tenantId);
    for (const license of licenses) {
      if (!matchesQuery(q, license.name, license.licenseKey, license.vendor, license.type)) {
        continue;
      }
      results.push({
        type: "license",
        id: license.id,
        title: license.name,
        subtitle: license.licenseKey,
        href: `/licenses?q=${encodeURIComponent(q)}`,
      });
      if (countByType("license") >= MAX_PER_TYPE) break;
    }
  }

  if (options.includeDocuments !== false) {
    const companyDocs = await storage.getCompanyDocuments(tenantId);
    for (const doc of companyDocs) {
      if (!matchesQuery(q, doc.title, doc.documentType, doc.notes)) {
        continue;
      }
      results.push({
        type: "document",
        id: doc.id,
        title: doc.title,
        subtitle: `Company · ${doc.documentType}`,
        href: `/documents?q=${encodeURIComponent(q)}`,
      });
      if (countByType("document") >= MAX_PER_TYPE) break;
    }

    let employeeDocsQuery = db
      .select({
        id: employeeDocuments.id,
        documentType: employeeDocuments.documentType,
        employeeName: employees.name,
        employeeCode: employees.employeeId,
      })
      .from(employeeDocuments)
      .innerJoin(employees, eq(employeeDocuments.employeeId, employees.id));

    if (tenantId !== undefined) {
      employeeDocsQuery = employeeDocsQuery.where(eq(employees.tenantId, tenantId)) as typeof employeeDocsQuery;
    }

    const employeeDocs = await employeeDocsQuery;
    for (const doc of employeeDocs) {
      if (!matchesQuery(q, doc.documentType, doc.employeeName, doc.employeeCode)) {
        continue;
      }
      results.push({
        type: "document",
        id: doc.id,
        title: `${doc.employeeName} · ${doc.documentType}`,
        subtitle: doc.employeeCode,
        href: `/documents?q=${encodeURIComponent(q)}`,
      });
      if (countByType("document") >= MAX_PER_TYPE) break;
    }
  }

  return results.slice(0, MAX_TOTAL);
}

export type ModuleKey =
  | "dashboard"
  | "assets"
  | "licenses"
  | "company"
  | "employee"
  | "payroll"
  | "documents"
  | "vendors"
  | "customers"
  | "userManagement"
  | "settings";

export type UserPermissionsMap = Partial<Record<ModuleKey, boolean>> & {
  canSeeOtherData?: boolean;
};

export const MODULE_DEFINITIONS: { key: ModuleKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "assets", label: "Assets" },
  { key: "licenses", label: "Licenses" },
  { key: "company", label: "Company" },
  { key: "employee", label: "Employee" },
  { key: "payroll", label: "Payroll" },
  { key: "documents", label: "Documents" },
  { key: "vendors", label: "Vendors" },
  { key: "customers", label: "Customers" },
  { key: "userManagement", label: "User Management" },
  { key: "settings", label: "Settings" },
];

export const ALL_MODULE_KEYS: ModuleKey[] = MODULE_DEFINITIONS.map((m) => m.key);

export const ROUTE_MODULE_MAP: Record<string, ModuleKey> = {
  "/": "dashboard",
  "/assets": "assets",
  "/licenses": "licenses",
  "/company": "company",
  "/employees": "employee",
  "/payroll": "payroll",
  "/documents": "documents",
  "/vendors": "vendors",
  "/customers": "customers",
  "/users": "userManagement",
  "/settings": "settings",
  "/vendor-settings": "settings",
};

type PermissionUser = {
  role?: string | null;
  isSuperAdmin?: boolean | null;
  permissions?: UserPermissionsMap | null;
};

export function isSuperAdminUser(user: PermissionUser | null | undefined): boolean {
  return user?.role === "super_admin" || user?.isSuperAdmin === true;
}

export function isAdminUser(user: PermissionUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function isVendorUser(user: PermissionUser | null | undefined): boolean {
  return user?.role === "vendor";
}

export function normalizePermissions(permissions: unknown): UserPermissionsMap {
  if (!permissions || typeof permissions !== "object") {
    return {};
  }

  const normalized: UserPermissionsMap = {};
  for (const { key } of MODULE_DEFINITIONS) {
    const value = (permissions as Record<string, unknown>)[key];
    if (value === true) {
      normalized[key] = true;
    }
  }
  if ((permissions as Record<string, unknown>).canSeeOtherData === true) {
    normalized.canSeeOtherData = true;
  }
  return normalized;
}

export function createEmptyPermissions(): UserPermissionsMap {
  return {
    ...ALL_MODULE_KEYS.reduce<UserPermissionsMap>((acc, key) => {
      acc[key] = false;
      return acc;
    }, {}),
    canSeeOtherData: false,
  };
}

export function createFullPermissions(): UserPermissionsMap {
  return {
    ...ALL_MODULE_KEYS.reduce<UserPermissionsMap>((acc, key) => {
      acc[key] = true;
      return acc;
    }, {}),
    canSeeOtherData: true,
  };
}

export function setAllPermissions(checked: boolean, current: UserPermissionsMap = {}): UserPermissionsMap {
  return {
    ...ALL_MODULE_KEYS.reduce<UserPermissionsMap>((acc, key) => {
      acc[key] = checked;
      return acc;
    }, {}),
    canSeeOtherData: current.canSeeOtherData ?? false,
  };
}

export function userCanSeeOtherData(user: PermissionUser | null | undefined): boolean {
  if (!user) return false;
  if (isSuperAdminUser(user)) return false;
  if (isAdminUser(user)) return true;
  if (isVendorUser(user)) return false;
  return normalizePermissions(user.permissions).canSeeOtherData === true;
}

export function canViewModule(
  user: PermissionUser | null | undefined,
  module: ModuleKey
): boolean {
  if (!user) return false;
  if (isVendorUser(user)) return false;
  if (isSuperAdminUser(user)) return module === "userManagement";
  if (isAdminUser(user)) return true;
  return normalizePermissions(user.permissions)[module] === true;
}

export function getDefaultRouteForUser(user: PermissionUser | null | undefined): string {
  if (!user) return "/auth";
  if (isVendorUser(user)) return "/vendor-dashboard";
  if (isSuperAdminUser(user)) return "/users";

  if (isAdminUser(user)) return "/";

  const permissions = normalizePermissions(user.permissions);
  const firstAllowed = MODULE_DEFINITIONS.find(({ key }) => permissions[key] === true);
  if (!firstAllowed) return "/no-access";
  if (firstAllowed.key === "dashboard") return "/";
  if (firstAllowed.key === "employee") return "/employees";
  if (firstAllowed.key === "userManagement") return "/users";
  return `/${firstAllowed.key}`;
}

export function resolveApiModule(path: string): ModuleKey | null {
  if (path.startsWith("/api/dashboard")) return "dashboard";
  if (path.startsWith("/api/assets") || path.startsWith("/api/asset-assignments") || path.startsWith("/api/maintenance-records")) {
    return "assets";
  }
  if (path.startsWith("/api/licenses")) return "licenses";
  if (path.startsWith("/api/companies")) return "company";
  if (
    path.startsWith("/api/employees") ||
    path.startsWith("/api/dependents") ||
    path.startsWith("/api/running-numbers/employee")
  ) {
    return "employee";
  }
  if (path.startsWith("/api/payroll")) return "payroll";
  if (path.startsWith("/api/documents") || path.startsWith("/api/company-documents")) return "documents";
  if (path.startsWith("/api/vendors")) return "vendors";
  if (path.startsWith("/api/customers")) return "customers";
  if (path.startsWith("/api/users")) return "userManagement";
  if (path.startsWith("/api/email-settings") || path.startsWith("/api/settings")) return "settings";
  return null;
}

export const PUBLIC_API_PREFIXES = [
  "/api/user",
  "/api/login",
  "/api/logout",
  "/api/register",
  "/api/verify-email",
  "/api/resend-verification",
  "/api/notifications",
];

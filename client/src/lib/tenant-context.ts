type TenantUser = {
  role?: string;
  isSuperAdmin?: boolean;
  tenantId?: number | null;
} | null | undefined;

/** Tenant ID for API calls; super admin defaults to tenant 1 when none is set. */
export function getEffectiveTenantId(
  user: TenantUser,
  authTenantId?: number | null
): number | null {
  if (authTenantId != null) return authTenantId;
  if (user?.tenantId != null) return user.tenantId;
  if (user?.role === "super_admin" || user?.isSuperAdmin) return 1;
  return null;
}

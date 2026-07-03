import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { tenants } from "@shared/schema";
import { db } from "../db";
import { isSuperAdminUser } from "@shared/permissions";

type TenantScopedUser = {
  role?: string | null;
  isSuperAdmin?: boolean | null;
  tenantId?: number | null;
};

/** List/query scope: super admin may pass tenant context; everyone else uses their tenantId only. */
export async function resolveListScopedTenantId(req: Request): Promise<number | undefined> {
  const user = req.user as TenantScopedUser | undefined;
  if (isSuperAdminUser(user)) {
    const tenant = await getTenantFromRequest(req);
    return tenant?.id;
  }
  return user?.tenantId ?? undefined;
}

export function buildTenantSlug(name: string, email: string): string {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") ||
    "org";
  return `${base}-${Date.now().toString(36)}`;
}

export function assertResourceTenantAccess(
  req: Request,
  res: Response,
  resourceTenantId: number | null | undefined
): boolean {
  const user = req.user as TenantScopedUser | undefined;
  if (isSuperAdminUser(user)) return true;
  if (!user?.tenantId || resourceTenantId == null || resourceTenantId !== user.tenantId) {
    res.status(403).json({ message: "Access denied" });
    return false;
  }
  return true;
}

// Get tenant from request
export const getTenantFromRequest = async (req: Request) => {
  // If a logged in user has a tenant ID, use that
  if (req.isAuthenticated() && req.user?.tenantId) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId));
    return tenant;
  }

  // If tenantId is passed explicitly in header, validate it
  const tenantIdHeader = req.headers["x-tenant-id"];
  if (tenantIdHeader && !Array.isArray(tenantIdHeader)) {
    try {
      const tenantId = parseInt(tenantIdHeader, 10);
      if (!isNaN(tenantId)) {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
        return tenant;
      }
    } catch (error) {
      console.error("Error parsing tenant ID header:", error);
    }
  }

  // For subdomain-based tenancy
  const host = req.headers.host;
  if (host) {
    // Extract subdomain and check if it matches a tenant slug
    const hostParts = host.split(".");
    if (hostParts.length > 1) {
      const potentialSlug = hostParts[0];
      if (potentialSlug !== "www" && potentialSlug !== "api") {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, potentialSlug));
        return tenant;
      }
    }
  }

  return null;
};

// Middleware to require a tenant and add it to the request
export const requireTenant = async (req: Request, res: Response, next: NextFunction) => {
  console.log('requireTenant middleware - Path:', req.path);
  console.log('requireTenant middleware - User:', req.user);

  // Skip tenant check for authentication routes
  if (req.path === '/api/login' || req.path === '/api/register' || req.path === '/api/logout') {
    return next();
  }

  if (!req.isAuthenticated()) {
    console.log('requireTenant middleware - Not authenticated');
    return res.status(401).json({ message: "Authentication required", info: "Not authenticated" });
  }

  // Super admin users can access without tenant (global access)
  if (req.user?.role === 'super_admin' || req.user?.isSuperAdmin) {
    console.log('requireTenant middleware - Super admin detected, allowing global access');
    // Still try to get tenant if specified, but don't require it
    const tenant = await getTenantFromRequest(req);
    if (tenant) {
      (req as any).tenant = tenant;
      console.log('requireTenant middleware - Super admin with tenant context:', tenant.name);
    } else {
      console.log('requireTenant middleware - Super admin without tenant context (global access)');
    }
    return next();
  }

  // Regular users must have a tenant
  const tenant = await getTenantFromRequest(req);
  console.log('requireTenant middleware - Found tenant:', tenant);
  
  if (!tenant) {
    console.log('requireTenant middleware - No tenant found for regular user');
    return res.status(400).json({ message: "Tenant required", info: "No tenant found" });
  }

  // Verify user belongs to this tenant
  if (req.user?.tenantId && req.user.tenantId !== tenant.id) {
    console.log('requireTenant middleware - User tenant mismatch');
    return res.status(403).json({ message: "Access denied", info: "User does not belong to this tenant" });
  }

  // Add the tenant to the request for use in route handlers
  (req as any).tenant = tenant;
  console.log('requireTenant middleware - Tenant context set:', tenant.name);
  next();
};

// Middleware to filter by tenant ID
export const filterByTenant = (tenantId: number) => {
  return eq(tenants.id, tenantId);
};

/** Resolve tenant ID for API writes when super admin has no tenant on the session. */
export async function resolveRequestTenantId(req: Request, user?: any): Promise<number | null> {
  const tenant = await getTenantFromRequest(req);
  if (tenant?.id) return tenant.id;
  if (user?.tenantId) return user.tenantId;

  const header = req.headers["x-tenant-id"];
  if (typeof header === "string") {
    const parsed = parseInt(header, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const bodyTenantId = req.body?.tenantId;
  if (bodyTenantId != null && bodyTenantId !== "") {
    const parsed = Number(bodyTenantId);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  if (user?.role === "super_admin" || user?.isSuperAdmin) {
    return 1;
  }

  return null;
}

// Helper function to get tenant ID from request
export const getTenantIdFromRequest = (req: Request): number | null => {
  const user = req.user as any;
  const tenant = (req as any).tenant;
  
  // Super admin can access any tenant or global data
  if (user?.role === 'super_admin' || user?.isSuperAdmin) {
    return tenant?.id || null;
  }
  
  // Regular users are scoped to their tenant
  return user?.tenantId || tenant?.id || null;
};
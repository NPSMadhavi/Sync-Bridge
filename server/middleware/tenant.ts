import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { tenants } from "@shared/schema";
import { db } from "../db";

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
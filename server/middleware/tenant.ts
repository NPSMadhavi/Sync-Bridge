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
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tenant = await getTenantFromRequest(req);
  if (!tenant) {
    return res.status(400).json({ error: "Tenant not found" });
  }

  // Add the tenant to the request for use in route handlers
  (req as any).tenant = tenant;
  next();
};

// Middleware to filter by tenant ID
export const filterByTenant = (tenantId: number) => {
  return eq(tenants.id, tenantId);
};
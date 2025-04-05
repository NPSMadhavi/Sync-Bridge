import { Router } from "express";
import { storage } from "../storage";
import { insertTenantSchema } from "@shared/schema";
import { ZodError } from "zod";
import { formatZodError } from "zod-validation-error";
import { requireTenant } from "../middleware/tenant";

const router = Router();

// Get all tenants (admin only)
router.get("/", async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  try {
    const tenants = await storage.getTenants();
    res.json(tenants);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

// Get a specific tenant
router.get("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  try {
    const tenantId = parseInt(req.params.id, 10);
    
    // Only admins can view any tenant, other users can only view their own tenant
    if (req.user.role !== "admin" && req.user.tenantId !== tenantId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    res.json(tenant);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
});

// Create a new tenant (admin only)
router.post("/", async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  try {
    const tenantData = insertTenantSchema.parse(req.body);
    
    // Check if tenant with same name or slug already exists
    const existingByName = await storage.getTenantByName(tenantData.name);
    if (existingByName) {
      return res.status(400).json({ error: "Tenant with this name already exists" });
    }
    
    if (tenantData.slug) {
      const existingBySlug = await storage.getTenantBySlug(tenantData.slug);
      if (existingBySlug) {
        return res.status(400).json({ error: "Tenant with this slug already exists" });
      }
    } else {
      // Generate slug from name if not provided
      tenantData.slug = tenantData.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    }
    
    const tenant = await storage.createTenant(tenantData);
    
    // Log the tenant creation
    await storage.createAuditLog({
      action: "tenant.create",
      userId: req.user.id,
      targetType: "tenant",
      targetId: tenant.id,
      details: { tenant: tenant.name }
    });
    
    res.status(201).json(tenant);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: formatZodError(error).message });
    }
    console.error("Error creating tenant:", error);
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

// Update a tenant (admin only)
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  try {
    const tenantId = parseInt(req.params.id, 10);
    const updateData = req.body;
    
    // Check if the tenant exists
    const existingTenant = await storage.getTenant(tenantId);
    if (!existingTenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    // If slug is provided, check if it's unique
    if (updateData.slug) {
      const existingBySlug = await storage.getTenantBySlug(updateData.slug);
      if (existingBySlug && existingBySlug.id !== tenantId) {
        return res.status(400).json({ error: "Tenant with this slug already exists" });
      }
    }
    
    // If name is provided, check if it's unique
    if (updateData.name) {
      const existingByName = await storage.getTenantByName(updateData.name);
      if (existingByName && existingByName.id !== tenantId) {
        return res.status(400).json({ error: "Tenant with this name already exists" });
      }
    }
    
    const updatedTenant = await storage.updateTenant(tenantId, updateData);
    
    // Log the tenant update
    await storage.createAuditLog({
      action: "tenant.update",
      userId: req.user.id,
      targetType: "tenant",
      targetId: tenantId,
      details: { tenant: updatedTenant.name, changes: updateData }
    });
    
    res.json(updatedTenant);
  } catch (error) {
    console.error("Error updating tenant:", error);
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

// Delete a tenant (admin only)
router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  try {
    const tenantId = parseInt(req.params.id, 10);
    
    // Check if the tenant exists
    const existingTenant = await storage.getTenant(tenantId);
    if (!existingTenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    // Don't allow deletion if tenant has users
    const tenantUsers = await storage.getUsersByTenantId(tenantId);
    if (tenantUsers.length > 0) {
      return res.status(400).json({ 
        error: "Cannot delete tenant with existing users. Reassign or delete users first." 
      });
    }
    
    await storage.deleteTenant(tenantId);
    
    // Log the tenant deletion
    await storage.createAuditLog({
      action: "tenant.delete",
      userId: req.user.id,
      targetType: "tenant",
      targetId: tenantId,
      details: { tenant: existingTenant.name }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting tenant:", error);
    res.status(500).json({ error: "Failed to delete tenant" });
  }
});

// Get current tenant for logged in user
router.get("/current/info", requireTenant, (req, res) => {
  res.json((req as any).tenant);
});

export default router;
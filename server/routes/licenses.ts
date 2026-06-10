import express from 'express';
import { storage } from '../storage';
import { insertLicenseSchema } from '@shared/schema';
import { requireTenant } from '../middleware/tenant';
import { z } from 'zod';

const router = express.Router();

// Get all licenses for the tenant
router.get('/', requireTenant, async (req, res) => {
  try {
    const user = (req as any).user;
    let licenses;
    if (user?.role === 'super_admin' || user?.isSuperAdmin) {
      // Super admin: fetch all licenses
      licenses = await storage.getAllLicenses();
    } else {
      const tenant = (req as any).tenant;
      licenses = await storage.getAllLicenses(tenant.id);
    }
    console.log('Fetched licenses:', licenses);
    res.json(licenses);
  } catch (error) {
    console.error('Error fetching licenses:', error);
    res.status(500).json({ message: 'Failed to fetch licenses' });
  }
});

// Create a new license
router.post('/', requireTenant, async (req, res) => {
  try {
    const tenant = (req as any).tenant;
    const licenseData = insertLicenseSchema.parse(req.body);
    
    // Add tenant ID to the license data
    const license = await storage.createLicense({
      ...licenseData,
      tenantId: tenant?.id || null
    });
    
    // Create audit log
    await storage.createAuditLog({
      action: 'create',
      entity: 'license',
      entityId: license.id,
      userId: (req as any).user!.id,
      tenantId: tenant?.id || null,
      timestamp: new Date()
    });

    res.status(201).json(license);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors
      });
    }
    console.error('Error creating license:', error);
    res.status(500).json({ message: 'Failed to create license' });
  }
});

// Get a specific license
router.get('/:id', requireTenant, async (req, res) => {
  try {
    const tenant = (req as any).tenant;
    const license = await storage.getLicense(parseInt(req.params.id));
    
    if (!license) {
      return res.status(404).json({ message: 'License not found' });
    }
    
    // Check if license belongs to tenant
    if (license.tenantId !== tenant.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(license);
  } catch (error) {
    console.error('Error fetching license:', error);
    res.status(500).json({ message: 'Failed to fetch license' });
  }
});

// Update a license
router.put('/:id', requireTenant, async (req, res) => {
  try {
    const tenant = (req as any).tenant;
    const licenseId = parseInt(req.params.id);
    const existingLicense = await storage.getLicense(licenseId);
    
    if (!existingLicense) {
      return res.status(404).json({ message: 'License not found' });
    }
    
    // Check if license belongs to tenant (only for regular users)
    if (tenant && existingLicense.tenantId !== tenant.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const licenseData = insertLicenseSchema.partial().parse(req.body);
    const updatedLicense = await storage.updateLicense(licenseId, {
      ...licenseData,
      tenantId: tenant?.id || existingLicense.tenantId
    });
    
    // Create audit log
    await storage.createAuditLog({
      action: 'update',
      entity: 'license',
      entityId: licenseId,
      userId: (req as any).user!.id,
      tenantId: tenant?.id || null,
      timestamp: new Date()
    });
    
    res.json(updatedLicense);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors
      });
    }
    console.error('Error updating license:', error);
    res.status(500).json({ message: 'Failed to update license' });
  }
});

// Delete a license
router.delete('/:id', requireTenant, async (req, res) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const licenseId = parseInt(req.params.id);
    const existingLicense = await storage.getLicense(licenseId);
    
    if (!existingLicense) {
      return res.status(404).json({ message: 'License not found' });
    }
    
    // Check if license belongs to tenant (skip for super_admin without tenant context)
    if (tenant && existingLicense.tenantId !== tenant.id && !(user?.role === 'super_admin' || user?.isSuperAdmin)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await storage.deleteLicense(licenseId);
    
    // Create audit log
    await storage.createAuditLog({
      action: 'delete',
      entity: 'license',
      entityId: licenseId,
      userId: user!.id,
      tenantId: tenant?.id || existingLicense.tenantId,
      timestamp: new Date()
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting license:', error);
    res.status(500).json({ message: 'Failed to delete license' });
  }
});

export default router; 
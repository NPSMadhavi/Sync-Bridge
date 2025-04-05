import type { Express } from "express";
import express from "express";
import path from "path";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupFileServing, uploadMiddleware, handleFileUpload } from "./upload";
import { ZodError } from "zod";
import { 
  insertAssetSchema, insertEmployeeSchema, insertDependentSchema, 
  insertEmployeeDocumentSchema, insertVendorSchema, insertAssetAssignmentSchema,
  insertMaintenanceRecordSchema, insertLicenseSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  const { requireRole } = setupAuth(app);
  
  // Set up file serving
  setupFileServing(app);
  
  // Serve files from public directory
  app.use(express.static('public'));
  
  // Special route for pitch deck
  app.get('/pitch-deck', (req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'public', 'pitch-deck.html'));
  });

  // Error handling for Zod validation errors
  const handleZodError = (error: any, res: any) => {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors
      });
    }
    throw error;
  };

  // Root API endpoint
  app.get("/api", (req, res) => {
    res.json({ message: "SyncBridge API" });
  });

  // User routes
  app.get("/api/users", requireRole(['admin', 'hr']), async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Employee routes
  app.get("/api/employees", requireRole(['admin', 'hr', 'it_manager']), async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.get("/api/employees/:id", requireRole(['admin', 'hr', 'it_manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const employee = await storage.getEmployee(id);
      
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      res.json(employee);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employee" });
    }
  });

  app.post("/api/employees", requireRole(['admin', 'hr']), async (req, res) => {
    try {
      const employeeData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(employeeData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entity: "employee",
        entityId: employee.id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

  app.put("/api/employees/:id", requireRole(['admin', 'hr']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const employeeData = req.body;
      
      const updatedEmployee = await storage.updateEmployee(id, employeeData);
      
      if (!updatedEmployee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        action: "update",
        entity: "employee",
        entityId: id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.json(updatedEmployee);
    } catch (error) {
      res.status(500).json({ message: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", requireRole(['admin', 'hr']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEmployee(id);
      
      // Create audit log
      await storage.createAuditLog({
        action: "delete",
        entity: "employee",
        entityId: id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });

  // Dependent routes
  app.get("/api/employees/:employeeId/dependents", requireRole(['admin', 'hr']), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const dependents = await storage.getDependentsByEmployeeId(employeeId);
      res.json(dependents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dependents" });
    }
  });

  app.post("/api/dependents", requireRole(['admin', 'hr']), async (req, res) => {
    try {
      const dependentData = insertDependentSchema.parse(req.body);
      const dependent = await storage.createDependent(dependentData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entity: "dependent",
        entityId: dependent.id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.status(201).json(dependent);
    } catch (error) {
      if (error instanceof ZodError) return handleZodError(error, res);
      res.status(500).json({ message: "Failed to create dependent" });
    }
  });

  app.put("/api/dependents/:id", requireRole(['admin', 'hr']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const dependentData = req.body;
      
      const updatedDependent = await storage.updateDependent(id, dependentData);
      
      if (!updatedDependent) {
        return res.status(404).json({ message: "Dependent not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        action: "update",
        entity: "dependent",
        entityId: id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.json(updatedDependent);
    } catch (error) {
      res.status(500).json({ message: "Failed to update dependent" });
    }
  });

  app.delete("/api/dependents/:id", requireRole(['admin', 'hr']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDependent(id);
      
      // Create audit log
      await storage.createAuditLog({
        action: "delete",
        entity: "dependent",
        entityId: id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete dependent" });
    }
  });

  // Asset routes
  app.get("/api/assets", async (req, res) => {
    try {
      const assets = await storage.getAssets();
      res.json(assets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assets" });
    }
  });

  app.get("/api/assets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const asset = await storage.getAsset(id);
      
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      res.json(asset);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch asset" });
    }
  });

  app.post("/api/assets", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const assetData = insertAssetSchema.parse(req.body);
      const asset = await storage.createAsset(assetData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entity: "asset",
        entityId: asset.id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.status(201).json(asset);
    } catch (error) {
      if (error instanceof ZodError) return handleZodError(error, res);
      res.status(500).json({ message: "Failed to create asset" });
    }
  });

  app.put("/api/assets/:id", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assetData = req.body;
      
      const updatedAsset = await storage.updateAsset(id, assetData);
      
      if (!updatedAsset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        action: "update",
        entity: "asset",
        entityId: id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.json(updatedAsset);
    } catch (error) {
      res.status(500).json({ message: "Failed to update asset" });
    }
  });

  app.delete("/api/assets/:id", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAsset(id);
      
      // Create audit log
      await storage.createAuditLog({
        action: "delete",
        entity: "asset",
        entityId: id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete asset" });
    }
  });

  // Asset Assignment routes
  app.get("/api/asset-assignments", async (req, res) => {
    try {
      const assignments = await storage.getActiveAssetAssignments();
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch asset assignments" });
    }
  });

  app.post("/api/asset-assignments", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const assignmentData = insertAssetAssignmentSchema.parse(req.body);
      
      // Verify asset exists and is available
      const asset = await storage.getAsset(assignmentData.assetId);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      if (asset.status !== 'available') {
        return res.status(400).json({ message: "Asset is not available for assignment" });
      }
      
      // Create assignment
      const assignment = await storage.createAssetAssignment(assignmentData);
      
      // Update asset status to assigned
      await storage.updateAsset(asset.id, { status: 'assigned' });
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entity: "asset_assignment",
        entityId: assignment.id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      // Create notification for the employee
      const employee = await storage.getEmployee(assignmentData.employeeId);
      if (employee && employee.userId) {
        await storage.createNotification({
          type: 'assignment',
          message: `Asset ${asset.tag} has been assigned to you`,
          targetUserId: employee.userId,
          seen: false,
          entityId: assignment.id,
          entityType: 'asset_assignment'
        });
      }
      
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof ZodError) return handleZodError(error, res);
      res.status(500).json({ message: "Failed to create asset assignment" });
    }
  });

  app.put("/api/asset-assignments/:id/return", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.getAssetAssignment(id);
      
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      // Update assignment with return date
      const updatedAssignment = await storage.updateAssetAssignment(id, {
        dateReturned: new Date()
      });
      
      // Update asset status to available
      await storage.updateAsset(assignment.assetId, { status: 'available' });
      
      // Create audit log
      await storage.createAuditLog({
        action: "update",
        entity: "asset_assignment",
        entityId: id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.json(updatedAssignment);
    } catch (error) {
      res.status(500).json({ message: "Failed to update asset assignment" });
    }
  });

  // Maintenance Record routes
  app.get("/api/assets/:assetId/maintenance", async (req, res) => {
    try {
      const assetId = parseInt(req.params.assetId);
      const records = await storage.getMaintenanceRecordsByAssetId(assetId);
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch maintenance records" });
    }
  });

  app.post("/api/maintenance-records", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const recordData = insertMaintenanceRecordSchema.parse(req.body);
      
      // If asset is being sent for maintenance, update its status
      const asset = await storage.getAsset(recordData.assetId);
      if (asset && asset.status !== 'maintenance') {
        await storage.updateAsset(asset.id, { status: 'maintenance' });
      }
      
      const record = await storage.createMaintenanceRecord(recordData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entity: "maintenance_record",
        entityId: record.id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof ZodError) return handleZodError(error, res);
      res.status(500).json({ message: "Failed to create maintenance record" });
    }
  });

  app.put("/api/maintenance-records/:id/complete", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { resolution, cost } = req.body;
      
      if (!resolution) {
        return res.status(400).json({ message: "Resolution is required" });
      }
      
      const record = await storage.getMaintenanceRecord(id);
      if (!record) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      
      const updatedRecord = await storage.updateMaintenanceRecord(id, {
        resolution,
        cost
      });
      
      // Update asset status back to available
      await storage.updateAsset(record.assetId, { status: 'available' });
      
      // Create audit log
      await storage.createAuditLog({
        action: "update",
        entity: "maintenance_record",
        entityId: id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.json(updatedRecord);
    } catch (error) {
      res.status(500).json({ message: "Failed to update maintenance record" });
    }
  });

  // Employee Document routes
  app.get("/api/employees/:employeeId/documents", async (req, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const documents = await storage.getEmployeeDocumentsByEmployeeId(employeeId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employee documents" });
    }
  });

  app.post("/api/documents", uploadMiddleware, async (req, res) => {
    try {
      const { employeeId, documentType, issueDate, expiryDate, notes, fileData } = req.body;
      
      if (!fileData) {
        return res.status(400).json({ message: "File data is required" });
      }
      
      // Handle the file upload
      const filePath = await handleFileUpload(fileData, `document-${documentType}`);
      
      // Create the document record
      const documentData = insertEmployeeDocumentSchema.parse({
        employeeId: parseInt(employeeId),
        documentType,
        filePath,
        issueDate: issueDate ? new Date(issueDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        notes
      });
      
      const document = await storage.createEmployeeDocument(documentData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entity: "employee_document",
        entityId: document.id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      // If document has expiry date, create notifications for HR/Admin
      if (document.expiryDate) {
        // Get admin and HR users
        const admins = Array.from((await storage.getEmployees())
          .filter(emp => emp.userId)
          .map(emp => emp.userId as number));
        
        for (const adminId of admins) {
          await storage.createNotification({
            type: 'document_expiry',
            message: `Document ${document.documentType} will expire on ${new Date(document.expiryDate).toLocaleDateString()}`,
            targetUserId: adminId,
            seen: false,
            entityId: document.id,
            entityType: 'employee_document'
          });
        }
      }
      
      res.status(201).json(document);
    } catch (error) {
      if (error instanceof ZodError) return handleZodError(error, res);
      console.error(error);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  // Vendor routes
  app.get("/api/vendors", async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.post("/api/vendors", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const vendorData = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(vendorData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entity: "vendor",
        entityId: vendor.id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.status(201).json(vendor);
    } catch (error) {
      if (error instanceof ZodError) return handleZodError(error, res);
      res.status(500).json({ message: "Failed to create vendor" });
    }
  });

  // Notification routes
  app.get("/api/notifications", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const notifications = await storage.getNotificationsByUserId(req.user!.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.put("/api/notifications/:id/seen", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id);
      const notification = await storage.getNotification(id);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      if (notification.targetUserId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this notification" });
      }
      
      const updatedNotification = await storage.markNotificationAsSeen(id);
      res.json(updatedNotification);
    } catch (error) {
      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  // License routes
  app.get("/api/licenses", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const assetId = req.query.assetId ? parseInt(req.query.assetId as string) : undefined;
      
      let licenses;
      if (assetId) {
        licenses = await storage.getLicensesByAssetId(assetId);
      } else {
        // Get all licenses expiring in the next 90 days by default
        licenses = await storage.getExpiringLicenses(90);
      }
      
      res.json(licenses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch licenses" });
    }
  });

  app.get("/api/licenses/:id", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const license = await storage.getLicense(id);
      
      if (!license) {
        return res.status(404).json({ message: "License not found" });
      }
      
      res.json(license);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch license" });
    }
  });

  app.post("/api/licenses", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const licenseData = insertLicenseSchema.parse(req.body);
      const license = await storage.createLicense(licenseData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entity: "license",
        entityId: license.id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      // If the license is about to expire, create a notification for IT managers
      if (license.expiryDate) {
        const now = new Date();
        const expiryDate = new Date(license.expiryDate);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= 30) {
          // Create notifications for admins and IT managers
          const user = await storage.getUser(req.user!.id);
          if (user && (user.role === 'admin' || user.role === 'it_manager')) {
            await storage.createNotification({
              type: 'license_expiry',
              message: `License ${license.name} will expire in ${daysUntilExpiry} days`,
              targetUserId: user.id,
              seen: false,
              entityId: license.id,
              entityType: 'license'
            });
          }
        }
      }
      
      res.status(201).json(license);
    } catch (error) {
      if (error instanceof ZodError) return handleZodError(error, res);
      res.status(500).json({ message: "Failed to create license" });
    }
  });

  app.put("/api/licenses/:id", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const licenseData = req.body;
      
      const updatedLicense = await storage.updateLicense(id, licenseData);
      
      if (!updatedLicense) {
        return res.status(404).json({ message: "License not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        action: "update",
        entity: "license",
        entityId: id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.json(updatedLicense);
    } catch (error) {
      res.status(500).json({ message: "Failed to update license" });
    }
  });

  app.delete("/api/licenses/:id", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLicense(id);
      
      // Create audit log
      await storage.createAuditLog({
        action: "delete",
        entity: "license",
        entityId: id,
        userId: req.user!.id,
        timestamp: new Date()
      });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete license" });
    }
  });

  // Dashboard statistics
  app.get("/api/dashboard", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard statistics" });
    }
  });

  // Audit logs
  app.get("/api/audit-logs", requireRole(['admin']), async (req, res) => {
    try {
      const logs = await storage.getAuditLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Report generation
  app.get("/api/reports/expiring-documents", requireRole(['admin', 'hr']), async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 90;
      const documents = await storage.getExpiringDocuments(days);
      
      // Format for CSV
      const csvRows = [];
      csvRows.push(['ID', 'Employee ID', 'Document Type', 'Issue Date', 'Expiry Date', 'Notes']);
      
      for (const doc of documents) {
        csvRows.push([
          doc.id.toString(),
          doc.employeeId.toString(),
          doc.documentType,
          doc.issueDate ? new Date(doc.issueDate).toLocaleDateString() : '',
          doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : '',
          doc.notes || ''
        ]);
      }
      
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=expiring-documents.csv');
      res.send(csvContent);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.get("/api/reports/asset-assignments", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const assignments = await storage.getActiveAssetAssignments();
      
      // Format for CSV
      const csvRows = [];
      csvRows.push(['ID', 'Asset ID', 'Employee ID', 'Date Assigned', 'Notes']);
      
      for (const assignment of assignments) {
        csvRows.push([
          assignment.id.toString(),
          assignment.assetId.toString(),
          assignment.employeeId.toString(),
          new Date(assignment.dateAssigned).toLocaleDateString(),
          assignment.notes || ''
        ]);
      }
      
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=asset-assignments.csv');
      res.send(csvContent);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.get("/api/reports/expiring-licenses", requireRole(['admin', 'it_manager']), async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 90;
      const licenses = await storage.getExpiringLicenses(days);
      
      // Format for CSV
      const csvRows = [];
      csvRows.push(['ID', 'Name', 'Type', 'License Key', 'Purchase Date', 'Expiry Date', 'Asset ID', 'Cost', 'Seats']);
      
      for (const license of licenses) {
        csvRows.push([
          license.id.toString(),
          license.name,
          license.type,
          license.licenseKey,
          license.purchaseDate ? new Date(license.purchaseDate).toLocaleDateString() : '',
          license.expiryDate ? new Date(license.expiryDate).toLocaleDateString() : '',
          license.assetId ? license.assetId.toString() : '',
          license.cost ? license.cost.toString() : '',
          license.seats ? license.seats.toString() : ''
        ]);
      }
      
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=expiring-licenses.csv');
      res.send(csvContent);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

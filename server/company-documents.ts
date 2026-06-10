import { Router } from "express";
import { z } from "zod";
import { db } from "./db";
import { companyDocuments, documentReminders, users } from "@shared/schema";
import { eq, and, desc, lt, gte } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { analyzeDocumentFile } from "./ai-document-analyzer";
import { requireTenant } from "./middleware/tenant";

const router = Router();

// Validation schemas
const createCompanyDocumentSchema = z.object({
  title: z.string().min(1),
  documentType: z.enum([
    "company_license",
    "government_certificate", 
    "purchase_invoice",
    "rental_agreement",
    "utility_bill",
    "payment_reminder",
    "legal_agreement",
    "other",
  ]),
  customType: z.string().optional(),
  issueDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
  expiryDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
  notes: z.string().optional(),
  fileData: z.string().min(1),
  reminders: z.array(z.object({
    daysBefore: z.number().min(1).max(365)
  })).optional(),
});

// Test endpoint to verify JSON response
router.get("/test-analyze", requireTenant, (req, res) => {
  res.json({ 
    message: "Test endpoint working", 
    timestamp: new Date().toISOString(),
    status: "ok" 
  });
});

// Analyze document with AI
router.post("/analyze", requireTenant, async (req, res) => {
  console.log("Starting document analysis...");
  
  try {
    const { fileData, filename } = req.body;
    console.log("Received request:", { filename, hasFileData: !!fileData });
    
    if (!fileData) {
      console.error("No file data provided");
      return res.status(400).json({ error: "File data is required" });
    }

    // Extract mime type and base64 data
    const [mimeTypePart, base64Data] = fileData.split(',');
    const mimeType = mimeTypePart.split(':')[1].split(';')[0];
    console.log("Detected mime type:", mimeType);

    // Analyze the document with filename context
    console.log("Starting document analysis...");
    const analysis = await analyzeDocumentFile(base64Data, mimeType, filename);
    console.log("Analysis completed:", { title: analysis.title, type: analysis.documentType, confidence: analysis.confidence });
    
    // Ensure we always return valid JSON
    if (!analysis || typeof analysis !== 'object') {
      console.error("Invalid analysis result:", analysis);
      return res.status(500).json({
        error: "Invalid analysis result",
        type: "validation_error"
      });
    }
    
    console.log("Sending successful response:", analysis);
    res.json(analysis);
  } catch (error) {
    console.error("Error analyzing document:", error);
    
    // Always ensure we return JSON, never HTML
    const errorResponse = {
      error: "Failed to analyze document",
      details: error instanceof Error ? error.message : 'Unknown error',
      type: "analysis_error",
      filename: req.body.filename || 'unknown'
    };
    
    console.log("Sending error response:", errorResponse);
    return res.status(500).json(errorResponse);
  }
});

// Get all company documents
router.get("/", requireTenant, async (req, res) => {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;

    // Define and validate select fields
    const selectFields = {
      id: companyDocuments.id,
      title: companyDocuments.title,
      documentType: companyDocuments.documentType,
      customType: companyDocuments.customType,
      filePath: companyDocuments.filePath,
      issueDate: companyDocuments.issueDate,
      expiryDate: companyDocuments.expiryDate,
      notes: companyDocuments.notes,
      createdAt: companyDocuments.createdAt,
      uploadedBy: users.name,
    };

    // Validate that all fields exist on their respective tables
    Object.entries(selectFields).forEach(([key, value]) => {
      if (!value) {
        console.error(`Field ${key} is undefined in company documents or users table`);
        throw new Error(`Invalid field in select: ${key}`);
      }
    });

    console.log('Fields being selected:', selectFields);

    let query = db
      .select(selectFields)
      .from(companyDocuments)
      .leftJoin(users, eq(companyDocuments.uploadedBy, users.id));

    // Apply tenant filter based on user role
    if (user?.role === 'super_admin' || user?.isSuperAdmin) {
      if (tenant) {
        query = query.where(eq(companyDocuments.tenantId, tenant.id));
      }
      // If no tenant, fetch all (global access for super admin)
    } else {
      if (!tenant) {
        return res.status(400).json({ message: 'Tenant context required for regular users' });
      }
      query = query.where(eq(companyDocuments.tenantId, tenant.id));
    }

    const docs = await query.orderBy(desc(companyDocuments.createdAt));

    res.json(docs);
  } catch (error) {
    console.error("Error fetching company documents:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// Create new company document
router.post("/", requireTenant, async (req, res) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const userId = user?.id;

    // Allow super_admin without tenant; regular users must have tenant
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!(user?.role === 'super_admin' || user?.isSuperAdmin) && !tenant) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    const validatedData = createCompanyDocumentSchema.parse(req.body);

    // Validate custom type requirement
    if (validatedData.documentType === "other" && !validatedData.customType?.trim()) {
      return res.status(400).json({ error: "Custom document type is required when 'Other' is selected" });
    }

    // Process file upload
    let filePath = "";
    if (validatedData.fileData) {
      const base64Data = validatedData.fileData.split(',')[1];
      const mimeType = validatedData.fileData.split(';')[0].split(':')[1];
      
      // Determine file extension
      let extension = ".pdf";
      if (mimeType.includes("jpeg") || mimeType.includes("jpg")) extension = ".jpg";
      else if (mimeType.includes("png")) extension = ".png";

      // Create filename
      const timestamp = Date.now();
      const filename = `company-doc-${timestamp}${extension}`;
      
      // Ensure uploads directory exists
      const uploadsDir = join(process.cwd(), "uploads", "company-documents");
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      filePath = join("uploads", "company-documents", filename);
      const fullPath = join(process.cwd(), filePath);

      // Write file
      await writeFile(fullPath, base64Data, "base64");
    }

    // Create document
    const [newDocument] = await db
      .insert(companyDocuments)
      .values({
        tenantId: tenant?.id ?? null,
        title: validatedData.title,
        documentType: validatedData.documentType,
        customType: validatedData.customType || null,
        filePath,
        issueDate: validatedData.issueDate,
        expiryDate: validatedData.expiryDate,
        notes: validatedData.notes || null,
        uploadedBy: userId,
      })
      .returning();

    // Create reminders if provided
    if (validatedData.reminders?.length) {
      await db.insert(documentReminders).values(
        validatedData.reminders.map(reminder => ({
          documentId: newDocument.id,
          daysBefore: reminder.daysBefore
        }))
      );
    }

    res.status(201).json(newDocument);
  } catch (error) {
    console.error("Error creating company document:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create document" });
    }
  }
});

// Update company document
router.put("/:id", requireTenant, async (req, res) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const userId = user?.id;
    const documentId = parseInt(req.params.id);

    if (!userId || isNaN(documentId)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!(user?.role === 'super_admin' || user?.isSuperAdmin) && !tenant) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    const validatedData = createCompanyDocumentSchema.omit({ fileData: true }).parse(req.body);

    // Check if document exists and belongs to tenant
    const existingDoc = await db
      .select()
      .from(companyDocuments)
      .where(
        tenant
          ? and(eq(companyDocuments.id, documentId), eq(companyDocuments.tenantId, tenant.id))
          : eq(companyDocuments.id, documentId)
      )
      .limit(1);

    if (existingDoc.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Update document
    const [updatedDocument] = await db
      .update(companyDocuments)
      .set({
        title: validatedData.title,
        documentType: validatedData.documentType,
        customType: validatedData.customType || null,
        issueDate: validatedData.issueDate,
        expiryDate: validatedData.expiryDate,
        notes: validatedData.notes || null,
      })
      .where(eq(companyDocuments.id, documentId))
      .returning();

    // Update reminders - delete existing and create new ones
    await db.delete(documentReminders).where(eq(documentReminders.documentId, documentId));
    
    if (validatedData.reminders && validatedData.reminders.length > 0) {
      await db.insert(documentReminders).values(
        validatedData.reminders.map(reminder => ({
          documentId: documentId,
          daysBefore: reminder.daysBefore,
        }))
      );
    }

    res.json(updatedDocument);
  } catch (error) {
    console.error("Error updating company document:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update document" });
  }
});

// Delete company document
router.delete("/:id", requireTenant, async (req, res) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: "Invalid document ID" });
    }

    // Check if document exists and belongs to tenant
    const existingDoc = await db
      .select()
      .from(companyDocuments)
      .where(
        tenant
          ? and(eq(companyDocuments.id, documentId), eq(companyDocuments.tenantId, tenant.id))
          : eq(companyDocuments.id, documentId)
      )
      .limit(1);

    if (existingDoc.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Delete document (reminders will be cascade deleted)
    await db.delete(companyDocuments).where(eq(companyDocuments.id, documentId));

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting company document:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Get documents expiring soon
router.get("/expiring", async (req, res) => {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Define and validate select fields
    const selectFields = {
      id: companyDocuments.id,
      title: companyDocuments.title,
      documentType: companyDocuments.documentType,
      customType: companyDocuments.customType,
      expiryDate: companyDocuments.expiryDate,
      uploadedBy: users.name,
    };

    // Validate that all fields exist on their respective tables
    Object.entries(selectFields).forEach(([key, value]) => {
      if (!value) {
        console.error(`Field ${key} is undefined in company documents or users table`);
        throw new Error(`Invalid field in select: ${key}`);
      }
    });

    console.log('Fields being selected:', selectFields);

    let query = db
      .select(selectFields)
      .from(companyDocuments)
      .leftJoin(users, eq(companyDocuments.uploadedBy, users.id));

    // Apply tenant filter based on user role
    let conditions = [
      lt(companyDocuments.expiryDate, thirtyDaysFromNow),
      gte(companyDocuments.expiryDate, new Date())
    ];

    if (user?.role === 'super_admin' || user?.isSuperAdmin) {
      if (tenant) {
        conditions.push(eq(companyDocuments.tenantId, tenant.id));
      }
      // If no tenant, fetch all (global access for super admin)
    } else {
      if (!tenant) {
        return res.status(400).json({ message: 'Tenant context required for regular users' });
      }
      conditions.push(eq(companyDocuments.tenantId, tenant.id));
    }

    const expiringDocs = await query
      .where(and(...conditions))
      .orderBy(companyDocuments.expiryDate);

    res.json(expiringDocs);
  } catch (error) {
    console.error("Error fetching expiring documents:", error);
    res.status(500).json({ error: "Failed to fetch expiring documents" });
  }
});

export default router;
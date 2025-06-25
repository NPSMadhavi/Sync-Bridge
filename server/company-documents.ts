import { Router } from "express";
import { z } from "zod";
import { db } from "./db";
import { companyDocuments, documentReminders, users } from "@shared/schema";
import { eq, and, desc, lt, gte } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { analyzeDocumentFile } from "./ai-document-analyzer";

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

// Analyze document with AI
router.post("/analyze", async (req, res) => {
  try {
    const { fileData, filename } = req.body;
    
    if (!fileData) {
      return res.status(400).json({ error: "File data is required" });
    }

    // Extract mime type and base64 data
    const [mimeTypePart, base64Data] = fileData.split(',');
    const mimeType = mimeTypePart.split(':')[1].split(';')[0];

    // Analyze the document with filename context
    const analysis = await analyzeDocumentFile(base64Data, mimeType, filename);
    
    res.json(analysis);
  } catch (error) {
    console.error("Error analyzing document:", error);
    
    // Return a proper JSON error response
    return res.status(500).json({ 
      error: "Failed to analyze document",
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Get all company documents
router.get("/", async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const docs = await db
      .select({
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
      })
      .from(companyDocuments)
      .leftJoin(users, eq(companyDocuments.uploadedBy, users.id))
      .where(eq(companyDocuments.tenantId, tenantId))
      .orderBy(desc(companyDocuments.createdAt));

    res.json(docs);
  } catch (error) {
    console.error("Error fetching company documents:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// Create new company document
router.post("/", async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
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
        tenantId,
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
    if (validatedData.reminders && validatedData.reminders.length > 0) {
      await db.insert(documentReminders).values(
        validatedData.reminders.map(reminder => ({
          documentId: newDocument.id,
          daysBefore: reminder.daysBefore,
        }))
      );
    }

    res.status(201).json(newDocument);
  } catch (error) {
    console.error("Error creating company document:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create document" });
  }
});

// Update company document
router.put("/:id", async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const documentId = parseInt(req.params.id);
    
    if (!tenantId || !userId || isNaN(documentId)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validatedData = createCompanyDocumentSchema.omit({ fileData: true }).parse(req.body);

    // Check if document exists and belongs to tenant
    const existingDoc = await db
      .select()
      .from(companyDocuments)
      .where(and(
        eq(companyDocuments.id, documentId),
        eq(companyDocuments.tenantId, tenantId)
      ))
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
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const documentId = parseInt(req.params.id);
    
    if (!tenantId || isNaN(documentId)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if document exists and belongs to tenant
    const existingDoc = await db
      .select()
      .from(companyDocuments)
      .where(and(
        eq(companyDocuments.id, documentId),
        eq(companyDocuments.tenantId, tenantId)
      ))
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
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringDocs = await db
      .select({
        id: companyDocuments.id,
        title: companyDocuments.title,
        documentType: companyDocuments.documentType,
        customType: companyDocuments.customType,
        expiryDate: companyDocuments.expiryDate,
        uploadedBy: users.name,
      })
      .from(companyDocuments)
      .leftJoin(users, eq(companyDocuments.uploadedBy, users.id))
      .where(and(
        eq(companyDocuments.tenantId, tenantId),
        lt(companyDocuments.expiryDate, thirtyDaysFromNow),
        gte(companyDocuments.expiryDate, new Date())
      ))
      .orderBy(companyDocuments.expiryDate);

    res.json(expiringDocs);
  } catch (error) {
    console.error("Error fetching expiring documents:", error);
    res.status(500).json({ error: "Failed to fetch expiring documents" });
  }
});

export default router;
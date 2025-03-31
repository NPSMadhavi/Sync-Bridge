import { pgTable, text, integer, serial, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'hr', 'it_manager', 'employee']);
export const assetStatusEnum = pgEnum('asset_status', ['available', 'assigned', 'maintenance', 'retired']);
export const documentTypeEnum = pgEnum('document_type', ['passport', 'visa', 'contract', 'certification', 'warranty', 'purchase_order', 'other']);
export const notificationTypeEnum = pgEnum('notification_type', ['document_expiry', 'maintenance_due', 'assignment']);

// Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default('employee'),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull().unique(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  department: text("department").notNull(),
  designation: text("designation").notNull(),
  joinDate: timestamp("join_date").notNull(),
  passportNumber: text("passport_number"),
  passportExpiry: timestamp("passport_expiry"),
  visaNumber: text("visa_number"),
  visaExpiry: timestamp("visa_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dependents = pgTable("dependents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  passportNumber: text("passport_number"),
  passportExpiry: timestamp("passport_expiry"),
  visaNumber: text("visa_number"),
  visaExpiry: timestamp("visa_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  tag: text("tag").notNull().unique(),
  type: text("type").notNull(),
  category: text("category").notNull(),
  serial: text("serial").notNull(),
  status: assetStatusEnum("status").notNull().default('available'),
  location: text("location"),
  vendorId: integer("vendor_id").references(() => vendors.id),
  purchaseDate: timestamp("purchase_date"),
  warrantyExpiry: timestamp("warranty_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assetAssignments = pgTable("asset_assignments", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => assets.id).notNull(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  dateAssigned: timestamp("date_assigned").notNull().defaultNow(),
  dateReturned: timestamp("date_returned"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const maintenanceRecords = pgTable("maintenance_records", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => assets.id).notNull(),
  issueDescription: text("issue_description").notNull(),
  resolution: text("resolution"),
  serviceDate: timestamp("service_date").notNull(),
  nextMaintenanceDate: timestamp("next_maintenance_date"),
  cost: text("cost"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employeeDocuments = pgTable("employee_documents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  documentType: documentTypeEnum("document_type").notNull(),
  filePath: text("file_path").notNull(),
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  email: text("email").notNull(),
  assetTypesSupplied: text("asset_types_supplied"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: notificationTypeEnum("type").notNull(),
  message: text("message").notNull(),
  targetUserId: integer("target_user_id").references(() => users.id).notNull(),
  seen: boolean("seen").notNull().default(false),
  entityId: integer("entity_id"), // Reference to related entity (document, asset, etc.)
  entityType: text("entity_type"), // Type of the entity (document, asset, etc.)
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  userId: integer("user_id").references(() => users.id).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  employees: many(employees),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  dependents: many(dependents),
  documents: many(employeeDocuments),
  assetAssignments: many(assetAssignments),
}));

export const dependentsRelations = relations(dependents, ({ one }) => ({
  employee: one(employees, {
    fields: [dependents.employeeId],
    references: [employees.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [assets.vendorId],
    references: [vendors.id],
  }),
  assignments: many(assetAssignments),
  maintenanceRecords: many(maintenanceRecords),
}));

export const assetAssignmentsRelations = relations(assetAssignments, ({ one }) => ({
  asset: one(assets, {
    fields: [assetAssignments.assetId],
    references: [assets.id],
  }),
  employee: one(employees, {
    fields: [assetAssignments.employeeId],
    references: [employees.id],
  }),
}));

export const maintenanceRecordsRelations = relations(maintenanceRecords, ({ one }) => ({
  asset: one(assets, {
    fields: [maintenanceRecords.assetId],
    references: [assets.id],
  }),
}));

export const employeeDocumentsRelations = relations(employeeDocuments, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeDocuments.employeeId],
    references: [employees.id],
  }),
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
  assets: many(assets),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.targetUserId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true });

export const insertEmployeeSchema = createInsertSchema(employees)
  .omit({ id: true, createdAt: true });

export const insertDependentSchema = createInsertSchema(dependents)
  .omit({ id: true, createdAt: true });

export const insertAssetSchema = createInsertSchema(assets)
  .omit({ id: true, createdAt: true });

export const insertAssetAssignmentSchema = createInsertSchema(assetAssignments)
  .omit({ id: true, createdAt: true });

export const insertMaintenanceRecordSchema = createInsertSchema(maintenanceRecords)
  .omit({ id: true, createdAt: true });

export const insertEmployeeDocumentSchema = createInsertSchema(employeeDocuments)
  .omit({ id: true, createdAt: true });

export const insertVendorSchema = createInsertSchema(vendors)
  .omit({ id: true, createdAt: true });

export const insertNotificationSchema = createInsertSchema(notifications)
  .omit({ id: true, createdAt: true });

export const insertAuditLogSchema = createInsertSchema(auditLogs)
  .omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type Dependent = typeof dependents.$inferSelect;
export type InsertDependent = z.infer<typeof insertDependentSchema>;

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;

export type AssetAssignment = typeof assetAssignments.$inferSelect;
export type InsertAssetAssignment = z.infer<typeof insertAssetAssignmentSchema>;

export type MaintenanceRecord = typeof maintenanceRecords.$inferSelect;
export type InsertMaintenanceRecord = z.infer<typeof insertMaintenanceRecordSchema>;

export type EmployeeDocument = typeof employeeDocuments.$inferSelect;
export type InsertEmployeeDocument = z.infer<typeof insertEmployeeDocumentSchema>;

export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

import { pgTable, text, integer, serial, timestamp, boolean, pgEnum, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'admin', 'hr_manager', 'it_manager', 'accountant', 'employee']);
export const moduleEnum = pgEnum('module', [
  'dashboard', 'assets', 'licenses', 'employees', 'documents', 
  'vendors', 'customers', 'invoices', 'reports', 'audit_logs', 
  'settings', 'user_management'
]);
export const assetStatusEnum = pgEnum('asset_status', ['available', 'assigned', 'maintenance', 'retired']);
export const documentTypeEnum = pgEnum('document_type', ['passport', 'visa', 'contract', 'certification', 'warranty', 'purchase_order', 'other']);
export const notificationTypeEnum = pgEnum('notification_type', ['document_expiry', 'maintenance_due', 'assignment', 'license_expiry']);
export const licenseTypeEnum = pgEnum('license_type', ['software', 'hardware', 'subscription', 'service', 'other']);
export const licenseStatusEnum = pgEnum('license_status', ['active', 'expired', 'revoked', 'assigned']);
export const renewalCycleEnum = pgEnum('renewal_cycle', ['none', 'monthly', 'yearly', 'custom']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'starter', 'business', 'enterprise']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'overdue', 'cancelled']);
export const paymentMethodEnum = pgEnum('payment_method', ['bank_transfer', 'credit_card', 'cash', 'check', 'other']);
export const visaTypeEnum = pgEnum('visa_type', ['s_pass', 'work_permit', 'employment_pass', 'pr', 'dependent_pass', 'ltvp', 'student_pass', 'other']);
export const employeeStatusEnum = pgEnum('employee_status', ['active', 'resigned', 'on_hold', 'terminated']);
export const relationshipEnum = pgEnum('relationship', ['spouse', 'child', 'parent', 'sibling', 'other']);
export const companyDocumentTypeEnum = pgEnum("company_document_type", ["company_license", "government_certificate", "purchase_invoice", "rental_agreement", "utility_bill", "payment_reminder", "legal_agreement", "other"]);

// Tables
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain"),
  plan: subscriptionPlanEnum("plan").notNull().default('free'),
  maxUsers: integer("max_users").notNull().default(5),
  maxAssets: integer("max_assets").notNull().default(20),
  maxDocuments: integer("max_documents").notNull().default(50),
  isActive: boolean("is_active").notNull().default(true),
  logo: text("logo"),
  primaryColor: text("primary_color").default('#10b981'),
  createdAt: timestamp("created_at").defaultNow(),
  expiryDate: timestamp("expiry_date"),
});
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default('employee'),
  password: text("password").notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false),
  isEmailVerified: boolean("is_email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiry: timestamp("email_verification_expiry"),
  isActive: boolean("is_active").default(true),
  allowedModules: text("allowed_modules").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userPermissions = pgTable("user_permissions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  userId: integer("user_id").references(() => users.id).notNull(),
  module: moduleEnum("module").notNull(),
  canView: boolean("can_view").default(true),
  canCreate: boolean("can_create").default(false),
  canUpdate: boolean("can_update").default(false),
  canDelete: boolean("can_delete").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  employeeId: text("employee_id").notNull(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  department: text("department").notNull(),
  designation: text("designation").notNull(),
  joinDate: timestamp("join_date").notNull(),
  status: employeeStatusEnum("status").notNull().default('active'),
  passportNumber: text("passport_number"),
  passportExpiry: timestamp("passport_expiry"),
  visaNumber: text("visa_number"),
  visaExpiry: timestamp("visa_expiry"),
  visaType: visaTypeEnum("visa_type"),
  visaRemarks: text("visa_remarks"),
  passportScan: text("passport_scan"),
  visaScan: text("visa_scan"),
  nricScan: text("nric_scan"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dependents = pgTable("dependents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  name: text("name").notNull(),
  relationship: relationshipEnum("relationship").notNull(),
  passportNumber: text("passport_number"),
  passportExpiry: timestamp("passport_expiry"),
  visaNumber: text("visa_number"),
  visaExpiry: timestamp("visa_expiry"),
  visaType: visaTypeEnum("visa_type"),
  passportScan: text("passport_scan"),
  visaScan: text("visa_scan"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  tag: text("tag").notNull(),
  type: text("type").notNull(),
  category: text("category").notNull(),
  serial: text("serial").notNull(),
  status: assetStatusEnum("status").notNull().default('available'),
  location: text("location"),
  vendorId: integer("vendor_id").references(() => vendors.id),
  purchaseDate: timestamp("purchase_date"),
  warrantyExpiry: timestamp("warranty_expiry"),
  hasLicense: boolean("has_license").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const licenses = pgTable("licenses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  assetId: integer("asset_id").references(() => assets.id),
  name: text("name").notNull(),
  licenseKey: text("license_key").notNull(),
  type: licenseTypeEnum("type").notNull(),
  seats: integer("seats").default(1),
  purchaseDate: timestamp("purchase_date"),
  expiryDate: timestamp("expiry_date"),
  cost: text("cost"),
  vendor: text("vendor"),
  renewalCycle: renewalCycleEnum("renewal_cycle").default('none'),
  status: licenseStatusEnum("status").default('active'),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assetAssignments = pgTable("asset_assignments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  assetId: integer("asset_id").references(() => assets.id).notNull(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  dateAssigned: timestamp("date_assigned").notNull().defaultNow(),
  dateReturned: timestamp("date_returned"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const maintenanceRecords = pgTable("maintenance_records", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
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
  tenantId: integer("tenant_id").references(() => tenants.id),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  documentType: documentTypeEnum("document_type").notNull(),
  filePath: text("file_path").notNull(),
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companyDocuments = pgTable("company_documents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  documentType: companyDocumentTypeEnum("document_type").notNull(),
  customType: text("custom_type"),
  title: text("title").notNull(),
  filePath: text("file_path").notNull(),
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"),
  notes: text("notes"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentReminders = pgTable("document_reminders", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => companyDocuments.id, { onDelete: "cascade" }).notNull(),
  daysBefore: integer("days_before").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  email: text("email").notNull(),
  assetTypesSupplied: text("asset_types_supplied"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
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
  tenantId: integer("tenant_id").references(() => tenants.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  userId: integer("user_id").references(() => users.id).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  taxId: text("tax_id"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id),
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: invoiceStatusEnum("status").notNull().default('draft'),
  subtotal: integer("subtotal").notNull(), // in cents
  taxAmount: integer("tax_amount").default(0), // in cents
  discountAmount: integer("discount_amount").default(0), // in cents
  totalAmount: integer("total_amount").notNull(), // in cents
  paidAmount: integer("paid_amount").default(0), // in cents
  balanceAmount: integer("balance_amount").notNull(), // in cents
  taxRate: integer("tax_rate").default(0), // percentage * 100 (e.g., 15.5% = 1550)
  discountRate: integer("discount_rate").default(0), // percentage * 100
  currency: text("currency").default('USD'),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  isEmailSent: boolean("is_email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull(), // in cents
  totalPrice: integer("total_price").notNull(), // in cents
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  amount: integer("amount").notNull(), // in cents
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  transactionId: text("transaction_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  employees: many(employees),
  assets: many(assets),
  licenses: many(licenses),
  vendors: many(vendors),
  assetAssignments: many(assetAssignments),
  maintenanceRecords: many(maintenanceRecords),
  employeeDocuments: many(employeeDocuments),
  dependents: many(dependents),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
  customers: many(customers),
  invoices: many(invoices),
  payments: many(payments),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  employees: many(employees),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [employees.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  dependents: many(dependents),
  documents: many(employeeDocuments),
  assetAssignments: many(assetAssignments),
}));

export const dependentsRelations = relations(dependents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [dependents.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [dependents.employeeId],
    references: [employees.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [assets.tenantId],
    references: [tenants.id],
  }),
  vendor: one(vendors, {
    fields: [assets.vendorId],
    references: [vendors.id],
  }),
  assignments: many(assetAssignments),
  maintenanceRecords: many(maintenanceRecords),
  licenses: many(licenses),
}));

export const licensesRelations = relations(licenses, ({ one }) => ({
  tenant: one(tenants, {
    fields: [licenses.tenantId],
    references: [tenants.id],
  }),
  asset: one(assets, {
    fields: [licenses.assetId],
    references: [assets.id],
  }),
}));

export const assetAssignmentsRelations = relations(assetAssignments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [assetAssignments.tenantId],
    references: [tenants.id],
  }),
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
  tenant: one(tenants, {
    fields: [maintenanceRecords.tenantId],
    references: [tenants.id],
  }),
  asset: one(assets, {
    fields: [maintenanceRecords.assetId],
    references: [assets.id],
  }),
}));

export const employeeDocumentsRelations = relations(employeeDocuments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [employeeDocuments.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [employeeDocuments.employeeId],
    references: [employees.id],
  }),
}));

export const companyDocumentsRelations = relations(companyDocuments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [companyDocuments.tenantId],
    references: [tenants.id],
  }),
  uploadedBy: one(users, {
    fields: [companyDocuments.uploadedBy],
    references: [users.id],
  }),
  reminders: many(documentReminders),
}));

export const documentRemindersRelations = relations(documentReminders, ({ one }) => ({
  document: one(companyDocuments, {
    fields: [documentReminders.documentId],
    references: [companyDocuments.id],
  }),
}));

export const vendorsRelations = relations(vendors, ({ many, one }) => ({
  tenant: one(tenants, {
    fields: [vendors.tenantId],
    references: [tenants.id],
  }),
  assets: many(assets),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  tenant: one(tenants, {
    fields: [notifications.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [notifications.targetUserId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  items: many(invoiceItems),
  payments: many(payments),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true,
  isSuperAdmin: true,
  tenantId: true,
  isEmailVerified: true,
  emailVerificationToken: true,
  emailVerificationExpiry: true
});

export const insertUserPermissionSchema = createInsertSchema(userPermissions).omit({
  id: true,
  createdAt: true,
  tenantId: true
});

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

export const insertCompanyDocumentSchema = createInsertSchema(companyDocuments)
  .omit({ id: true, createdAt: true, uploadedBy: true });

export const insertDocumentReminderSchema = createInsertSchema(documentReminders)
  .omit({ id: true, createdAt: true });

export const insertVendorSchema = createInsertSchema(vendors)
  .omit({ id: true, createdAt: true });

export const insertNotificationSchema = createInsertSchema(notifications)
  .omit({ id: true, createdAt: true });

export const insertLicenseSchema = createInsertSchema(licenses)
  .omit({ id: true, createdAt: true });

export const insertAuditLogSchema = createInsertSchema(auditLogs)
  .omit({ id: true });

export const insertTenantSchema = createInsertSchema(tenants)
  .omit({ id: true, createdAt: true });

export const insertCustomerSchema = createInsertSchema(customers)
  .omit({ id: true, createdAt: true });

export const insertInvoiceSchema = createInsertSchema(invoices)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems)
  .omit({ id: true, createdAt: true });

export const insertPaymentSchema = createInsertSchema(payments)
  .omit({ id: true, createdAt: true });

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;

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

export type License = typeof licenses.$inferSelect;
export type InsertLicense = z.infer<typeof insertLicenseSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

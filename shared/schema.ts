import { pgTable, text, integer, serial, timestamp, boolean, pgEnum, uuid, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'admin', 'hr_manager', 'it_manager', 'accountant', 'employee', 'vendor']);
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
export const nationalityEnum = pgEnum('nationality', ['citizen', 'pr', 'foreigner', 'singaporean_pr']);
export const prStatusEnum = pgEnum('pr_status', ['year_1', 'year_2', 'year_3_plus']);
export const relationshipEnum = pgEnum('relationship', ['spouse', 'child', 'parent', 'sibling', 'other']);
export const companyDocumentTypeEnum = pgEnum("company_document_type", ["company_license", "government_certificate", "purchase_invoice", "rental_agreement", "utility_bill", "payment_reminder", "legal_agreement", "other"]);

// Payroll Enums
export const payrollStatusEnum = pgEnum('payroll_status', ['draft', 'pending', 'approved', 'paid', 'cancelled']);
export const payrollPeriodEnum = pgEnum('payroll_period', ['monthly', 'bi_weekly', 'weekly']);
export const smtpSecureEnum = pgEnum('smtp_secure', ['None', 'SSL/TLS', 'STARTTLS']);

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

export const emailSettings = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull().default(587),
  smtpSecure: smtpSecureEnum("smtp_secure").notNull().default('STARTTLS'),
  smtpUser: text("smtp_user").notNull(),
  smtpPass: text("smtp_pass").notNull(),
  emailFrom: text("email_from").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdFk: foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: "email_settings_tenant_id_fk"
  }).onDelete("cascade"),
}));

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

export const sessions = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire").notNull(),
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
  dateOfBirth: date("date_of_birth"),
  salary: decimal("salary", { precision: 12, scale: 2 }),
  status: employeeStatusEnum("status").notNull().default('active'),
  nationality: nationalityEnum("nationality"),
  prStatus: text("pr_status"),
  nricNumber: text("nric_number"),
  finNumber: text("fin_number"),
  passportNumber: text("passport_number"),
  passportExpiry: timestamp("passport_expiry"),
  visaNumber: text("visa_number"),
  visaExpiry: timestamp("visa_expiry"),
  visaType: visaTypeEnum("visa_type"),
  visaRemarks: text("visa_remarks"),
  passportScan: text("passport_scan"),
  visaScan: text("visa_scan"),
  nricScan: text("nric_scan"),
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employeeCompanyHistory = pgTable("employee_company_history", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  employeeCode: text("employee_code").notNull(),
  employeeName: text("employee_name").notNull(),
  companyId: integer("company_id").references(() => companies.id),
  companyName: text("company_name").notNull(),
  dateChanged: timestamp("date_changed").notNull().defaultNow(),
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

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  companyName: text("company_name").notNull(),
  uenNumber: text("uen_number").notNull(),
  address: text("address"),
  phoneNumber: text("phone_number"),
  website: text("website"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  website: text("website"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  taxId: text("tax_id"),
  registrationNumber: text("registration_number"),
  assetTypesSupplied: text("asset_types_supplied"),
  paymentTerms: text("payment_terms"),
  creditLimit: text("credit_limit"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
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

export const invoiceDesigns = pgTable("invoice_designs", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().unique().references(() => invoices.id),
  primaryColor: text("primary_color"),
  fontFamily: text("font_family"),
  fontSize: text("font_size"),
  logoUrl: text("logo_url"),
  headerNote: text("header_note"),
  footerNote: text("footer_note"),
  templateStyle: text("template_style"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

import { decimal, date, jsonb } from "drizzle-orm/pg-core";

// Employee Payroll Configuration table
export const employeePayroll = pgTable("employee_payroll", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  baseSalary: decimal("base_salary", { precision: 10, scale: 2 }).notNull(),
  payrollPeriod: payrollPeriodEnum("payroll_period").notNull().default('monthly'),
  noOfWorkingDays: integer("no_of_working_days"),
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }),
  overtimeRate: decimal("overtime_rate", { precision: 8, scale: 2 }),
  allowances: jsonb("allowances").$type<Record<string, number>>().default({}),
  deductions: jsonb("deductions").$type<Record<string, number>>().default({}),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default('0.00'),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }),
  cpfRate: decimal("cpf_rate", { precision: 5, scale: 2 }).default('20.00'),
  cpfAmount: decimal("cpf_amount", { precision: 12, scale: 2 }),
  employerCpfRate: decimal("employer_cpf_rate", { precision: 5, scale: 2 }).default('0.00'),
  employerCpfAmount: decimal("employer_cpf_amount", { precision: 12, scale: 2 }),
  incomeTax: decimal("income_tax", { precision: 12, scale: 2 }),
  netSalary: decimal("net_salary", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
});

// Payroll Records table
export const payrollRecords = pgTable("payroll_records", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  payrollConfigId: integer("payroll_config_id").references(() => employeePayroll.id).notNull(),
  payPeriodStart: date("pay_period_start").notNull(),
  payPeriodEnd: date("pay_period_end").notNull(),
  baseSalary: decimal("base_salary", { precision: 10, scale: 2 }).notNull(),
  overtimeHours: decimal("overtime_hours", { precision: 6, scale: 2 }).default('0.00'),
  overtimePay: decimal("overtime_pay", { precision: 10, scale: 2 }).default('0.00'),
  allowances: jsonb("allowances").$type<Record<string, number>>().default({}),
  deductions: jsonb("deductions").$type<Record<string, number>>().default({}),
  grossPay: decimal("gross_pay", { precision: 10, scale: 2 }).notNull(),
  taxDeduction: decimal("tax_deduction", { precision: 10, scale: 2 }).default('0.00'),
  cpfDeduction: decimal("cpf_deduction", { precision: 10, scale: 2 }).default('0.00'),
  netPay: decimal("net_pay", { precision: 10, scale: 2 }).notNull(),
  status: payrollStatusEnum("status").notNull().default('draft'),
  paymentDate: date("payment_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
});

// Vendor-specific tables
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendorProductPrices = pgTable("vendor_product_prices", {
  id: serial("id").primaryKey(),
  vendorEmail: text("vendor_email").notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  buyingPrice: integer("buying_price").notNull(), // in cents
  sellingPrice: integer("selling_price").notNull(), // in cents
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vendorCustomers = pgTable("vendor_customers", {
  id: serial("id").primaryKey(),
  vendorEmail: text("vendor_email").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendorOrders = pgTable("vendor_orders", {
  id: serial("id").primaryKey(),
  vendorEmail: text("vendor_email").notNull(),
  customerName: text("customer_name").notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  buyingPrice: integer("buying_price").notNull(), // in cents
  sellingPrice: integer("selling_price").notNull(), // in cents
  totalCost: integer("total_cost").notNull(), // in cents
  totalSale: integer("total_sale").notNull(), // in cents
  profit: integer("profit").notNull(), // in cents
  orderDate: timestamp("order_date").notNull().defaultNow(),
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
  employeePayroll: many(employeePayroll),
  payrollRecords: many(payrollRecords),
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
  productPrices: many(vendorProductPrices),
  customers: many(vendorCustomers),
  orders: many(vendorOrders),
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

export const employeePayrollRelations = relations(employeePayroll, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [employeePayroll.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [employeePayroll.employeeId],
    references: [employees.id],
  }),
  createdByUser: one(users, {
    fields: [employeePayroll.createdBy],
    references: [users.id],
  }),
  payrollRecords: many(payrollRecords),
}));

export const payrollRecordsRelations = relations(payrollRecords, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payrollRecords.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [payrollRecords.employeeId],
    references: [employees.id],
  }),
  payrollConfig: one(employeePayroll, {
    fields: [payrollRecords.payrollConfigId],
    references: [employeePayroll.id],
  }),
  createdByUser: one(users, {
    fields: [payrollRecords.createdBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [payrollRecords.approvedBy],
    references: [users.id],
  }),
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

// Vendor-specific relations
export const productsRelations = relations(products, ({ many }) => ({
  vendorPrices: many(vendorProductPrices),
  orders: many(vendorOrders),
}));

export const vendorProductPricesRelations = relations(vendorProductPrices, ({ one }) => ({
  product: one(products, {
    fields: [vendorProductPrices.productId],
    references: [products.id],
  }),
}));

export const vendorCustomersRelations = relations(vendorCustomers, ({ }) => ({}));

export const vendorOrdersRelations = relations(vendorOrders, ({ one }) => ({
  product: one(products, {
    fields: [vendorOrders.productId],
    references: [products.id],
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

export const insertEmployeeSchema = createInsertSchema(employees, {
  nationality: z.enum(['citizen', 'pr', 'foreigner', 'singaporean_pr']).optional().nullable(),
  prStatus: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.enum(['year_1', 'year_2', 'year_3_plus']).nullable().optional()
  ),
  // joinDate is a timestamp column — accept YYYY-MM-DD or ISO datetime
  joinDate: z.preprocess(
    (val) => (val === null || val === undefined ? '' : String(val)),
    z.string().min(1, "Join date is required").transform((str) => {
      let cleanStr = str;
      if (str.includes('+05') && str.startsWith('+05')) {
        cleanStr = str.replace(/^\+05/, '');
      }
      const d = /^\d{4}-\d{2}-\d{2}$/.test(cleanStr)
        ? new Date(`${cleanStr}T12:00:00`)
        : new Date(cleanStr);
      if (isNaN(d.getTime())) {
        throw new Error("Invalid join date format");
      }
      return d;
    })
  ),
  // dateOfBirth is a `date` column — must be a YYYY-MM-DD string, not a Date object
  dateOfBirth: z.string().optional().nullable().transform(str => {
    if (!str || str.trim() === '') return null;
    try {
      let cleanStr = str;
      if (str.includes('+05') && str.startsWith('+05')) {
        cleanStr = str.replace(/^\+05/, '');
      }
      const d = new Date(cleanStr);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }),
  salary: z.union([z.string(), z.number()]).optional().nullable().transform(val => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'string') return val;
    return val?.toString() || null;
  }),
  // passportExpiry and visaExpiry are timestamp columns — use ISO strings
  passportExpiry: z.string().optional().nullable().transform(str => {
    if (!str || str.trim() === '') return null;
    try {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }),
  visaExpiry: z.string().optional().nullable().transform(str => {
    if (!str || str.trim() === '') return null;
    try {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }),
  companyId: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const n = Number(val);
      return Number.isNaN(n) ? null : n;
    },
    z.number().nullable().optional()
  ),
}).omit({ id: true, createdAt: true });

export const insertDependentSchema = createInsertSchema(dependents, {
  passportExpiry: z.string().datetime().nullable().transform(str => str ? new Date(str).toISOString() : null),
  visaExpiry: z.string().datetime().nullable().transform(str => str ? new Date(str).toISOString() : null),
}).omit({ id: true, createdAt: true });

export const insertAssetSchema = createInsertSchema(assets, {
  purchaseDate: z.string().datetime().nullable().optional().transform(str => str ? new Date(str).toISOString() : null),
  warrantyExpiry: z.string().datetime().nullable().optional().transform(str => str ? new Date(str).toISOString() : null),
})
  .omit({ id: true, createdAt: true })
  .extend({
    location: z.string().optional(),
    vendorId: z.number().optional(),
  });

export const insertAssetAssignmentSchema = createInsertSchema(assetAssignments)
  .omit({ id: true, createdAt: true });

export const insertMaintenanceRecordSchema = createInsertSchema(maintenanceRecords)
  .omit({ id: true, createdAt: true });

export const insertEmployeeDocumentSchema = createInsertSchema(employeeDocuments, {
  issueDate: z.string().datetime().nullable().transform(str => str ? new Date(str).toISOString() : null),
  expiryDate: z.string().datetime().nullable().transform(str => str ? new Date(str).toISOString() : null),
}).omit({ id: true, createdAt: true });

export const insertCompanyDocumentSchema = createInsertSchema(companyDocuments)
  .omit({ id: true, createdAt: true, uploadedBy: true });

export const insertCompanySchema = createInsertSchema(companies, {
  companyName: z.string().min(1, "Company name is required"),
  uenNumber: z.string().min(1, "UEN number is required"),
  address: z.string().nullable().optional().transform(val => val?.trim() || null),
  phoneNumber: z.string().nullable().optional().transform(val => val?.trim() || null),
  website: z.string().nullable().optional().transform(val => val?.trim() || null),
}).omit({ id: true, createdAt: true });

export const insertDocumentReminderSchema = createInsertSchema(documentReminders)
  .omit({ id: true, createdAt: true });

export const insertVendorSchema = createInsertSchema(vendors, {
  phone: z.string().nullable().transform(val => val || ""),
  website: z.string().nullable().transform(val => val || ""),
  address: z.string().nullable().transform(val => val || ""),
  city: z.string().nullable().transform(val => val || ""),
  state: z.string().nullable().transform(val => val || ""),
  zipCode: z.string().nullable().transform(val => val || ""),
  country: z.string().nullable().transform(val => val || ""),
  taxId: z.string().nullable().transform(val => val || ""),
  registrationNumber: z.string().nullable().transform(val => val || ""),
  assetTypesSupplied: z.string().nullable().transform(val => val || ""),
  paymentTerms: z.string().nullable().transform(val => val || ""),
  creditLimit: z.string().nullable().transform(val => val || ""),
  isActive: z.boolean().nullable().transform(val => val ?? true),
  notes: z.string().nullable().transform(val => val || ""),
}).omit({ id: true, createdAt: true });

export const insertNotificationSchema = createInsertSchema(notifications)
  .omit({ id: true, createdAt: true });

export const insertLicenseSchema = createInsertSchema(licenses, {
  purchaseDate: z.string().datetime().nullable().transform(str => str ? new Date(str).toISOString() : null),
  expiryDate: z.string().datetime().nullable().transform(str => str ? new Date(str).toISOString() : null),
}).omit({ id: true, createdAt: true });

export const insertAuditLogSchema = createInsertSchema(auditLogs)
  .omit({ id: true });

export const insertTenantSchema = createInsertSchema(tenants)
  .omit({ id: true, createdAt: true });

export const insertEmailSettingsSchema = createInsertSchema(emailSettings)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertCustomerSchema = createInsertSchema(customers, {
  phone: z.string().nullable().transform(val => val || ""),
  company: z.string().nullable().transform(val => val || ""),
  address: z.string().nullable().transform(val => val || ""),
  city: z.string().nullable().transform(val => val || ""),
  state: z.string().nullable().transform(val => val || ""),
  zipCode: z.string().nullable().transform(val => val || ""),
  country: z.string().nullable().transform(val => val || ""),
  taxId: z.string().nullable().transform(val => val || ""),
  isActive: z.boolean().nullable().transform(val => val ?? true),
  notes: z.string().nullable().transform(val => val || ""),
}).omit({ id: true, createdAt: true });

export const insertInvoiceSchema = createInsertSchema(invoices, {
  issueDate: z.string().datetime().transform(str => new Date(str).toISOString()),
  dueDate: z.string().datetime().transform(str => new Date(str).toISOString()),
  subtotal: z.number().transform(val => Math.round(val)),
  totalAmount: z.number().transform(val => Math.round(val)),
  balanceAmount: z.number().transform(val => Math.round(val)),
  taxAmount: z.number().transform(val => Math.round(val)),
  discountAmount: z.number().transform(val => Math.round(val)),
  paidAmount: z.number().optional().transform(val => Math.round(val || 0)),
})
.omit({ id: true, createdAt: true, updatedAt: true });

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems, {
  unitPrice: z.number().transform(val => Math.round(val)),
  totalPrice: z.number().transform(val => Math.round(val)),
})
.omit({ id: true, createdAt: true });

export const insertInvoiceDesignSchema = createInsertSchema(invoiceDesigns)
  .omit({ id: true, createdAt: true, updatedAt: true });

// Employee Payroll schema
export const insertEmployeePayrollSchema = createInsertSchema(employeePayroll, {
  baseSalary: z.number().transform(val => val.toString()),
  hourlyRate: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
    z.number().optional().transform(val => val?.toString() || '0')
  ),
  overtimeRate: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
    z.number().optional().transform(val => val?.toString() || '0')
  ),
  taxRate: z.union([z.string(), z.number()]).optional().transform(val => {
    if (typeof val === 'string') return val;
    return val?.toString() || '0.00';
  }),
  noOfWorkingDays: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      const n = Number(val);
      return Number.isNaN(n) ? undefined : Math.trunc(n);
    },
    z.number().int().min(1, "No of working days is required")
  ),
  cpfRate: z.union([z.string(), z.number()]).optional().transform(val => {
    if (typeof val === 'string') return val;
    return val?.toString() || '20.00';
  }),
  annualSalary: z.union([z.string(), z.number()]).optional().transform(val => val?.toString() || '0.00'),
  incomeTax: z.union([z.string(), z.number()]).optional().transform(val => val?.toString() || '0.00'),
  cpfAmount: z.union([z.string(), z.number()]).optional().transform(val => val?.toString() || '0.00'),
  taxAmount: z.union([z.string(), z.number()]).optional().transform(val => val?.toString() || '0.00'),
  employerCpfRate: z.union([z.string(), z.number()]).optional().transform(val => val?.toString() || '0.00'),
  employerCpfAmount: z.union([z.string(), z.number()]).optional().transform(val => val?.toString() || '0.00'),
  netSalary: z.union([z.string(), z.number()]).optional().transform(val => val?.toString() || '0.00'),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmployeePayroll = z.infer<typeof insertEmployeePayrollSchema>;
export type EmployeePayroll = typeof employeePayroll.$inferSelect;

// Payroll Records schema
export const insertPayrollRecordSchema = createInsertSchema(payrollRecords, {
  baseSalary: z.number().transform(val => val.toString()),
  overtimeHours: z.number().optional().transform(val => val?.toString() || '0.00'),
  overtimePay: z.number().optional().transform(val => val?.toString() || '0.00'),
  grossPay: z.number().transform(val => val.toString()),
  taxDeduction: z.union([z.string(), z.number()]).optional().transform(val => {
    if (typeof val === 'string') return val;
    return val?.toString() || '0.00';
  }),
  cpfDeduction: z.union([z.string(), z.number()]).optional().transform(val => {
    if (typeof val === 'string') return val;
    return val?.toString() || '0.00';
  }),
  netPay: z.number().transform(val => val.toString()),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
});

export type InsertPayrollRecord = z.infer<typeof insertPayrollRecordSchema>;
export type PayrollRecord = typeof payrollRecords.$inferSelect;

// Vendor-specific insert schemas
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertVendorProductPriceSchema = createInsertSchema(vendorProductPrices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorCustomerSchema = createInsertSchema(vendorCustomers).omit({
  id: true,
  createdAt: true,
});

export const insertVendorOrderSchema = createInsertSchema(vendorOrders, {
  orderDate: z.string().datetime().transform(str => new Date(str).toISOString()),
  buyingPrice: z.number().transform(val => Math.round(val)),
  sellingPrice: z.number().transform(val => Math.round(val)),
  totalCost: z.number().transform(val => Math.round(val)),
  totalSale: z.number().transform(val => Math.round(val)),
  profit: z.number().transform(val => Math.round(val)),
}).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments, {
  amount: z.number().transform(val => Math.round(val)),
})
.omit({ id: true, createdAt: true });

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
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

export type CompanyDocument = typeof companyDocuments.$inferSelect;
export type InsertCompanyDocument = z.infer<typeof insertCompanyDocumentSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type EmployeeCompanyHistory = typeof employeeCompanyHistory.$inferSelect;
export type InsertEmployeeCompanyHistory = typeof employeeCompanyHistory.$inferInsert;
export type DocumentReminder = typeof documentReminders.$inferSelect;
export type InsertDocumentReminder = z.infer<typeof insertDocumentReminderSchema>;

export type InvoiceDesign = typeof invoiceDesigns.$inferSelect;
export type InsertInvoiceDesign = typeof invoiceDesigns.$inferInsert;

// Vendor-specific types
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type VendorProductPrice = typeof vendorProductPrices.$inferSelect;
export type InsertVendorProductPrice = z.infer<typeof insertVendorProductPriceSchema>;
export type VendorCustomer = typeof vendorCustomers.$inferSelect;
export type InsertVendorCustomer = z.infer<typeof insertVendorCustomerSchema>;
export type VendorOrder = typeof vendorOrders.$inferSelect;
export type InsertVendorOrder = z.infer<typeof insertVendorOrderSchema>;

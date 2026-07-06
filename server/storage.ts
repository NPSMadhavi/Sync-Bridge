import session from 'express-session';
import { db } from './db';
import { 
  users, 
  employees, 
  dependents, 
  assets, 
  assetAssignments, 
  maintenanceRecords, 
  employeeDocuments, 
  companyDocuments,
  companies,
  employeeCompanyHistory,
  vendors,
  products,
  vendorProductPrices,
  vendorCustomers,
  notifications,
  auditLogs,
  licenses,
  tenants,
  customers,
  invoices,
  invoiceItems,
  invoiceDesigns,
  payments,
  userPermissions,
  payrollRecords,
  documentReminderHistory,
  employeePayroll,
  documentReminders,
  licenseReminders,
  emailSettings,
  runningNumbers,
  formatRunningNumber,
  RUNNING_NUMBER_MODULE_EMPLOYEE,
  Asset,
  InsertAsset,
  AssetAssignment,
  InsertAssetAssignment,
  MaintenanceRecord,
  InsertMaintenanceRecord,
  EmployeeDocument,
  InsertEmployeeDocument,
  CompanyDocument,
  InsertCompanyDocument,
  Company,
  InsertCompany,
  EmployeeCompanyHistory,
  InsertEmployeeCompanyHistory,
  Vendor,
  InsertVendor,
  VendorProductPrice,
  InsertVendorProductPrice,
  VendorCustomer,
  InsertVendorCustomer,
  Notification,
  InsertNotification,
  AuditLog,
  InsertAuditLog,
  License,
  InsertLicense,
  Customer,
  InsertCustomer,
  Invoice,
  InsertInvoice,
  InvoiceItem,
  InsertInvoiceItem,
  Payment,
  InsertPayment,
  Employee,
  InsertEmployee,
  RunningNumber,
  SaveRunningNumber,
} from '@shared/schema';
import {
  computeDocumentExpiryStats,
  filterExpiredDocuments,
  filterExpiringSoonDocuments,
  getDaysUntilExpiry,
  isDocumentExpired,
  isDocumentExpiringSoon,
  startOfDay,
  DOCUMENT_EXPIRY_SOON_DAYS,
} from '@shared/document-expiry';
import {
  documentTypeLabel,
  formatEmployeeDocumentTypeEnum,
  type DocumentExpiryRecord,
} from '@shared/document-reminder-utils';
import { normalizePermissions } from '@shared/permissions';
import { eq, and, gt, gte, lt, lte, desc, isNull, sql, isNotNull, or, inArray, getTableColumns } from 'drizzle-orm';
import { DataEncryption } from './utils/encryption';

export class CompanyDeletionBlockedError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "CompanyDeletionBlockedError";
  }
}

// Define sensitive fields for encryption
const SENSITIVE_FIELDS = {
  users: ['email'] as const,
  employees: ['nricNumber', 'finNumber', 'passportNumber', 'visaNumber'] as const,
  dependents: ['passportNumber', 'visaNumber'] as const,
  vendors: ['contact', 'email', 'phone', 'taxId', 'registrationNumber', 'address'] as const,
  customers: ['email', 'phone', 'taxId', 'address'] as const,
  vendorCustomers: ['customerEmail', 'customerPhone'] as const,
} as const;

// Session store
const sessionStore = new session.MemoryStore();

// Storage interface
export interface IStorage {
  // User verification operations
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  verifyUserEmail(token: string): Promise<User | undefined>;
  
  // User Permission operations
  getUserPermissions(userId: number): Promise<UserPermission[]>;
  createUserPermission(permission: InsertUserPermission): Promise<UserPermission>;
  updateUserPermissions(userId: number, permissions: InsertUserPermission[]): Promise<void>;
  deleteUserPermissions(userId: number): Promise<void>;
  
  // Tenant operations
  getTenant(id: number): Promise<Tenant | undefined>;
  getTenantByName(name: string): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  getTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: number, tenant: Partial<InsertTenant>): Promise<Tenant | undefined>;
  deleteTenant(id: number): Promise<void>;
  getUsersByTenantId(tenantId: number): Promise<User[]>;
  
  // Email Settings operations
  getEmailSettings(tenantId: number): Promise<EmailSettings | undefined>;
  getAnyActiveEmailSettings(): Promise<EmailSettings | undefined>;
  createEmailSettings(emailSettings: InsertEmailSettings): Promise<EmailSettings>;
  updateEmailSettings(tenantId: number, emailSettings: Partial<InsertEmailSettings>): Promise<EmailSettings | undefined>;
  
  // Running Number operations
  getRunningNumber(tenantId: number, moduleName: string): Promise<RunningNumber | undefined>;
  upsertRunningNumber(tenantId: number, moduleName: string, data: SaveRunningNumber): Promise<RunningNumber>;
  createEmployeeWithRunningNumber(tenantId: number, employee: Omit<InsertEmployee, 'employeeId'>): Promise<Employee>;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(tenantId?: number): Promise<User[]>;
  createUser(user: InsertUser, tenantId: number): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  
  // Employee operations
  getEmployee(id: number): Promise<(Employee & { companyName?: string | null }) | undefined>;
  getEmployeeByUserId(userId: number): Promise<Employee | undefined>;
  getEmployees(tenantId?: number): Promise<(Employee & { companyName?: string | null })[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<void>;
  
  // Employee company history operations
  getEmployeeCompanyHistory(employeeId: number): Promise<EmployeeCompanyHistory[]>;
  createEmployeeCompanyHistory(record: InsertEmployeeCompanyHistory): Promise<EmployeeCompanyHistory>;
  
  // Dependent operations
  getDependent(id: number): Promise<Dependent | undefined>;
  getDependentsByEmployeeId(employeeId: number): Promise<Dependent[]>;
  createDependent(dependent: InsertDependent): Promise<Dependent>;
  updateDependent(id: number, dependent: Partial<InsertDependent>): Promise<Dependent | undefined>;
  deleteDependent(id: number): Promise<void>;

  // Document reminder operations
  scheduleDocumentReminder(data: {
    tenantId?: number | null;
    employeeId: number;
    dependentId?: number | null;
    documentType: string;
    expiryDate?: Date | null;
    reminderDate: Date;
    status: "pending" | "sent" | "snoozed" | "closed";
    reminderKind?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    emailSentAt?: Date;
  }): Promise<void>;
  getDueDocumentReminders(asOf: Date): Promise<(typeof documentReminderHistory.$inferSelect)[]>;
  hasAutoReminderSent(
    employeeId: number,
    dependentId: number | null,
    documentType: string,
    reminderKind: string
  ): Promise<boolean>;
  markDocumentReminderSent(id: number, sentAt: Date): Promise<void>;
  getDocumentRemindersForDocument(documentId: number): Promise<{ daysBefore: number }[]>;
  getLicenseRemindersForLicense(licenseId: number): Promise<{ daysBefore: number }[]>;
  replaceLicenseReminders(licenseId: number, reminders: { daysBefore: number }[]): Promise<void>;
  hasConfiguredReminderBeenSent(params: {
    documentType: string;
    entityId: number;
    reminderKind: string;
    reminderDate: Date;
  }): Promise<boolean>;
  getExpiringDocumentRecords(
    type: string,
    tenantId?: number
  ): Promise<any[]>;
  getDocumentExpiryRecords(
    mode: "expiring" | "expired",
    tenantId?: number
  ): Promise<import("@shared/document-reminder-utils").DocumentExpiryRecord[]>;
  isDocumentReminderSnoozed(
    reminderType: string,
    employeeDbId?: number | null,
    dependentId?: number | null,
    entityId?: number | null
  ): Promise<boolean>;
  hasNotificationForEntity(userId: number, entityType: string): Promise<boolean>;
  getNotificationRecipientUsers(tenantId?: number): Promise<User[]>;
  
  // Asset operations
  getAsset(id: number): Promise<Asset | undefined>;
  getAssets(tenantId?: number): Promise<Asset[]>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: number, asset: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(id: number): Promise<void>;
  
  // Asset Assignment operations
  getAssetAssignment(id: number): Promise<AssetAssignment | undefined>;
  getAssetAssignmentsByAssetId(assetId: number): Promise<AssetAssignment[]>;
  getAssetAssignmentsByEmployeeId(employeeId: number): Promise<AssetAssignment[]>;
  getAssetAssignments(tenantId?: number): Promise<any[]>;
  getAssetAssignmentsAllTenants(): Promise<any[]>;
  getActiveAssetAssignments(tenantId?: number): Promise<AssetAssignment[]>;
  createAssetAssignment(assignment: InsertAssetAssignment): Promise<AssetAssignment>;
  updateAssetAssignment(id: number, assignment: Partial<InsertAssetAssignment>): Promise<AssetAssignment | undefined>;
  deleteAssetAssignment(id: number): Promise<void>;
  
  // Maintenance Record operations
  getMaintenanceRecord(id: number): Promise<MaintenanceRecord | undefined>;
  getMaintenanceRecordsByAssetId(assetId: number): Promise<MaintenanceRecord[]>;
  getMaintenanceHistory(tenantId?: number): Promise<any[]>;
  getMaintenanceHistoryAllTenants(): Promise<any[]>;
  createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(id: number, record: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined>;
  deleteMaintenanceRecord(id: number): Promise<void>;
  
  // Employee Document operations
  getEmployeeDocument(id: number): Promise<EmployeeDocument | undefined>;
  getEmployeeDocuments(employeeId: number): Promise<EmployeeDocument[]>;
  getEmployeeDocumentsByEmployeeId(employeeId: number): Promise<EmployeeDocument[]>;
  getExpiringDocuments(daysThreshold: number, tenantId?: number): Promise<EmployeeDocument[]>;
  createEmployeeDocument(document: InsertEmployeeDocument): Promise<EmployeeDocument>;
  updateEmployeeDocument(id: number, document: Partial<InsertEmployeeDocument>): Promise<EmployeeDocument | undefined>;
  deleteEmployeeDocument(id: number): Promise<void>;
  
  // Company Document operations
  getCompanyDocument(id: number): Promise<CompanyDocument | undefined>;
  getCompanyDocuments(tenantId?: number): Promise<CompanyDocument[]>;
  createCompanyDocument(document: InsertCompanyDocument): Promise<CompanyDocument>;
  updateCompanyDocument(id: number, document: Partial<InsertCompanyDocument>): Promise<CompanyDocument | undefined>;
  deleteCompanyDocument(id: number): Promise<void>;
  
  // Company operations
  getCompany(id: number): Promise<Company | undefined>;
  getCompanies(tenantId?: number): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<void>;
  
  // Vendor operations
  getVendor(id: number): Promise<Vendor | undefined>;
  getVendors(tenantId?: number): Promise<Vendor[]>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: number, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: number): Promise<void>;
  
  // Vendor-specific operations
  getProducts(tenantId?: number): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<void>;
  
  getVendorProductPrices(vendorEmail: string): Promise<VendorProductPrice[]>;
  createVendorProductPrice(price: InsertVendorProductPrice): Promise<VendorProductPrice>;
  updateVendorProductPrice(id: number, price: Partial<InsertVendorProductPrice>): Promise<VendorProductPrice | undefined>;
  deleteVendorProductPrice(id: number): Promise<void>;
  
  getVendorCustomers(vendorEmail: string): Promise<VendorCustomer[]>;
  createVendorCustomer(customer: InsertVendorCustomer): Promise<VendorCustomer>;
  updateVendorCustomer(id: number, customer: Partial<InsertVendorCustomer>): Promise<VendorCustomer | undefined>;
  deleteVendorCustomer(id: number): Promise<void>;
  
  // Notification operations
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUserId(userId: number): Promise<Notification[]>;
  getUnseenNotificationsByUserId(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsSeen(id: number): Promise<Notification | undefined>;
  markAllNotificationsAsSeen(userId: number): Promise<void>;
  deleteNotification(id: number): Promise<void>;
  
  // Audit Log operations
  getAuditLog(id: number): Promise<AuditLog | undefined>;
  getAuditLogs(tenantId?: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  // License operations
  getLicense(id: number): Promise<License | undefined>;
  getLicensesByAssetId(assetId: number): Promise<License[]>;
  getExpiringLicenses(daysThreshold: number, tenantId?: number): Promise<License[]>;
  getAllLicenses(tenantId?: number): Promise<License[]>;
  createLicense(license: InsertLicense): Promise<License>;
  updateLicense(id: number, license: Partial<InsertLicense>): Promise<License | undefined>;
  deleteLicense(id: number): Promise<void>;
  
  // Customer operations
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomers(tenantId?: number): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<void>;
  
  // Invoice operations
  getInvoice(id: number): Promise<Invoice | undefined>;
  getInvoices(tenantId?: number): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice & { items?: InsertInvoiceItem[] }): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice> & { items?: InsertInvoiceItem[] }): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<void>;
  
  // Invoice Item operations
  getInvoiceItemsByInvoiceId(invoiceId: number): Promise<InvoiceItem[]>;
  createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem>;
  updateInvoiceItem(id: number, item: Partial<InsertInvoiceItem>): Promise<InvoiceItem | undefined>;
  deleteInvoiceItem(id: number): Promise<void>;
  
  // Payment operations
  getPayment(id: number): Promise<Payment | undefined>;
  getPaymentsByInvoiceId(invoiceId: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: number): Promise<void>;
  
  // Dashboard statistics
  getDashboardStats(tenantId?: number): Promise<any>;
  
  // Session store
  sessionStore: session.Store;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = sessionStore;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsers(tenantId?: number): Promise<User[]> {
    if (tenantId) {
      return await db.select().from(users).where(eq(users.tenantId, tenantId));
    }
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser, tenantId: number): Promise<User> {
    const hashedPassword = await this.hashPassword(insertUser.password);
    const { permissions, ...rest } = insertUser as InsertUser & {
      permissions?: Record<string, boolean>;
    };
    const [newUser] = await db.insert(users).values({
      ...rest,
      password: hashedPassword,
      tenantId,
      permissions: permissions ? normalizePermissions(permissions) : {},
    }).returning();
    return newUser;
  }

  private async hashPassword(password: string): Promise<string> {
    const crypto = await import('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${hash}.${salt}`;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    interface UpdateData {
      name?: string;
      email?: string;
      password?: string;
      role?: typeof users.$inferSelect['role'];
      permissions?: Record<string, boolean>;
      sendReminderEmails?: boolean;
    }

    const updateData: UpdateData = {};
    
    if (userData.name !== undefined) updateData.name = userData.name;
    if (userData.email !== undefined) updateData.email = userData.email;
    if (userData.role !== undefined) updateData.role = userData.role;
    if (userData.sendReminderEmails !== undefined) {
      updateData.sendReminderEmails = userData.sendReminderEmails;
    }
    if ((userData as UpdateData).permissions !== undefined) {
      updateData.permissions = normalizePermissions((userData as UpdateData).permissions);
    }
    
    if (userData.password) {
      updateData.password = await this.hashPassword(userData.password);
    }

    const [updatedUser] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    // Delete/nullify related records to avoid FK constraint violations
    await db.delete(userPermissions).where(eq(userPermissions.userId, id));
    await db.delete(notifications).where(eq(notifications.targetUserId, id));
    await db.delete(auditLogs).where(eq(auditLogs.userId, id));
    // Nullify nullable FK references instead of deleting
    await db.update(employees).set({ userId: null }).where(eq(employees.userId, id));
    await db.update(companyDocuments).set({ uploadedBy: null }).where(eq(companyDocuments.uploadedBy, id));
    await db.update(payrollRecords).set({ approvedBy: null }).where(eq(payrollRecords.approvedBy, id));
    await db.delete(users).where(eq(users.id, id));
  }

  // Employee operations
  async getEmployee(id: number): Promise<(Employee & { companyName?: string | null }) | undefined> {
    const [row] = await db
      .select({
        ...getTableColumns(employees),
        companyName: companies.companyName,
      })
      .from(employees)
      .leftJoin(companies, eq(employees.companyId, companies.id))
      .where(eq(employees.id, id));
    return row;
  }

  async getEmployeeByUserId(userId: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.userId, userId));
    return employee;
  }

  async getEmployees(tenantId?: number): Promise<(Employee & { companyName?: string | null })[]> {
    const query = db
      .select({
        ...getTableColumns(employees),
        companyName: companies.companyName,
      })
      .from(employees)
      .leftJoin(companies, eq(employees.companyId, companies.id));

    if (tenantId) {
      return await query.where(eq(employees.tenantId, tenantId));
    }
    return await query;
  }

  private normalizeEmployeeDates(employee: Partial<InsertEmployee> & Record<string, any>) {
    const toDate = (value: unknown) => {
      if (value == null || value === "") return value;
      if (value instanceof Date) return value;
      if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? value : parsed;
      }
      return value;
    };

    const toPgDate = (value: unknown) => {
      if (value == null || value === "") return value;
      if (typeof value === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? value : parsed.toISOString().split("T")[0];
      }
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? value : value.toISOString().split("T")[0];
      }
      if (typeof value === "number") {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? value : parsed.toISOString().split("T")[0];
      }
      return value;
    };

    return {
      ...employee,
      joinDate: toDate(employee.joinDate),
      dateOfBirth: toPgDate(employee.dateOfBirth),
      passportExpiry: toDate(employee.passportExpiry),
      nricExpiry: toDate(employee.nricExpiry),
      visaExpiry: toDate(employee.visaExpiry),
    };
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    try {
      const normalizedEmployee = this.normalizeEmployeeDates(employee);
      console.log("Employee Payload:", normalizedEmployee);
      console.log("DOB Type:", typeof normalizedEmployee.dateOfBirth);
      console.log("DOB Value:", normalizedEmployee.dateOfBirth);
      console.log("DOB instanceof Date:", normalizedEmployee.dateOfBirth instanceof Date);
      // Encrypt sensitive data
      const encryptedEmployee = await DataEncryption.encryptObject(normalizedEmployee, SENSITIVE_FIELDS.employees);
      const [newEmployee] = await db.insert(employees).values(encryptedEmployee).returning();
      return newEmployee;
    } catch (error) {
      console.error('Error creating employee (with encryption):', error);
      // Fallback: insert without encryption if encryption fails
      try {
        const fallbackEmployee = this.normalizeEmployeeDates(employee);
        console.log("Employee Payload:", fallbackEmployee);
        console.log("DOB Type:", typeof fallbackEmployee.dateOfBirth);
        console.log("DOB Value:", fallbackEmployee.dateOfBirth);
        console.log("DOB instanceof Date:", fallbackEmployee.dateOfBirth instanceof Date);
        const [newEmployee] = await db.insert(employees).values(fallbackEmployee).returning();
        return newEmployee;
      } catch (fallbackError) {
        console.error('Error creating employee (fallback):', fallbackError);
        throw fallbackError;
      }
    }
  }

  private async insertEmployeeWithClient(
    client: typeof db,
    employee: InsertEmployee
  ): Promise<Employee> {
    const normalizedEmployee = this.normalizeEmployeeDates(employee);
    try {
      const encryptedEmployee = await DataEncryption.encryptObject(
        normalizedEmployee,
        SENSITIVE_FIELDS.employees
      );
      const [newEmployee] = await client.insert(employees).values(encryptedEmployee).returning();
      return newEmployee;
    } catch (error) {
      console.error('Error creating employee in transaction (with encryption):', error);
      const [newEmployee] = await client.insert(employees).values(normalizedEmployee).returning();
      return newEmployee;
    }
  }

  async createEmployeeWithRunningNumber(
    tenantId: number,
    employee: Omit<InsertEmployee, 'employeeId'>
  ): Promise<Employee> {
    return db.transaction(async (tx) => {
      const [config] = await tx
        .select()
        .from(runningNumbers)
        .where(
          and(
            eq(runningNumbers.tenantId, tenantId),
            eq(runningNumbers.moduleName, RUNNING_NUMBER_MODULE_EMPLOYEE)
          )
        )
        .for('update')
        .limit(1);

      if (!config) {
        throw new Error('Running number configuration not found for Employee module');
      }

      const employeeId = formatRunningNumber(
        config.prefix,
        config.nextCounter,
        config.suffix
      );

      await tx
        .update(runningNumbers)
        .set({
          nextCounter: config.nextCounter + 1,
          updatedAt: new Date(),
        })
        .where(eq(runningNumbers.id, config.id));

      return this.insertEmployeeWithClient(tx, {
        ...employee,
        tenantId: employee.tenantId ?? tenantId,
        employeeId,
      } as InsertEmployee);
    });
  }

  async updateEmployee(id: number, employeeData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    try {
      const normalizedEmployeeData = this.normalizeEmployeeDates(employeeData);
      console.log("Employee Update Payload:", normalizedEmployeeData);
      console.log("DOB Type:", typeof normalizedEmployeeData.dateOfBirth);
      console.log("DOB Value:", normalizedEmployeeData.dateOfBirth);
      console.log("DOB instanceof Date:", normalizedEmployeeData.dateOfBirth instanceof Date);
      const encryptedData = await DataEncryption.encryptObject(normalizedEmployeeData, SENSITIVE_FIELDS.employees);
      const [updatedEmployee] = await db.update(employees).set(encryptedData).where(eq(employees.id, id)).returning();
      return updatedEmployee;
    } catch (error) {
      console.error('Error updating employee (with encryption):', error);
      // Fallback: update without encryption
      try {
        const fallbackEmployeeData = this.normalizeEmployeeDates(employeeData);
        console.log("Employee Update Payload:", fallbackEmployeeData);
        console.log("DOB Type:", typeof fallbackEmployeeData.dateOfBirth);
        console.log("DOB Value:", fallbackEmployeeData.dateOfBirth);
        console.log("DOB instanceof Date:", fallbackEmployeeData.dateOfBirth instanceof Date);
        const [updatedEmployee] = await db.update(employees).set(fallbackEmployeeData).where(eq(employees.id, id)).returning();
        return updatedEmployee;
      } catch (fallbackError) {
        console.error('Error updating employee (fallback):', fallbackError);
        throw new Error('Failed to update employee');
      }
    }
  }


  async deleteEmployee(id: number): Promise<void> {
    const employeeDependents = await db
      .select({ id: dependents.id })
      .from(dependents)
      .where(eq(dependents.employeeId, id));
    const dependentIds = employeeDependents.map((d) => d.id);

    if (dependentIds.length > 0) {
      await db.delete(documentReminderHistory).where(
        or(
          eq(documentReminderHistory.employeeId, id),
          inArray(documentReminderHistory.dependentId, dependentIds)
        )
      );
    } else {
      await db.delete(documentReminderHistory).where(eq(documentReminderHistory.employeeId, id));
    }

    // Delete all related records to avoid FK constraint violations
    await db.delete(employeeCompanyHistory).where(eq(employeeCompanyHistory.employeeId, id));
    await db.delete(assetAssignments).where(eq(assetAssignments.employeeId, id));
    await db.delete(employeeDocuments).where(eq(employeeDocuments.employeeId, id));
    await db.delete(dependents).where(eq(dependents.employeeId, id));
    await db.delete(payrollRecords).where(eq(payrollRecords.employeeId, id));
    await db.delete(employeePayroll).where(eq(employeePayroll.employeeId, id));
    await db.delete(employees).where(eq(employees.id, id));
  }

  async getEmployeeCompanyHistory(employeeId: number): Promise<EmployeeCompanyHistory[]> {
    return await db
      .select()
      .from(employeeCompanyHistory)
      .where(eq(employeeCompanyHistory.employeeId, employeeId))
      .orderBy(
        desc(employeeCompanyHistory.effectiveFrom),
        desc(employeeCompanyHistory.dateChanged)
      );
  }

  async createEmployeeCompanyHistory(record: InsertEmployeeCompanyHistory): Promise<EmployeeCompanyHistory> {
    const [history] = await db.insert(employeeCompanyHistory).values(record).returning();
    return history;
  }

  // Company operations
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getCompanies(tenantId?: number): Promise<Company[]> {
    if (tenantId) {
      return await db
        .select()
        .from(companies)
        .where(or(eq(companies.tenantId, tenantId), isNull(companies.tenantId)));
    }
    return await db.select().from(companies);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async updateCompany(id: number, companyData: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updatedCompany] = await db.update(companies).set(companyData).where(eq(companies.id, id)).returning();
    return updatedCompany;
  }

  async deleteCompany(id: number): Promise<void> {
    const blockers = await this.getCompanyDeleteBlockers(id);
    if (blockers.length > 0) {
      throw new CompanyDeletionBlockedError(blockers[0].message);
    }

    await db.transaction(async (tx) => {
      await tx.update(employees).set({ companyId: null }).where(eq(employees.companyId, id));
      await tx
        .update(employeeCompanyHistory)
        .set({ companyId: null })
        .where(eq(employeeCompanyHistory.companyId, id));

      const deleted = await tx.delete(companies).where(eq(companies.id, id)).returning({ id: companies.id });
      if (deleted.length === 0) {
        throw new Error("Company not found");
      }
    });
  }

  private async getCompanyDeleteBlockers(
    companyId: number
  ): Promise<Array<{ table: string; count: number; message: string }>> {
    const blockers: Array<{ table: string; count: number; message: string }> = [];

    const [payrollRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payrollRecords)
      .where(eq(payrollRecords.companyId, companyId));

    if (Number(payrollRow?.count ?? 0) > 0) {
      blockers.push({
        table: "payroll_records",
        count: Number(payrollRow.count),
        message: "This company cannot be deleted because payroll records exist.",
      });
    }

    return blockers;
  }

  // Vendor operations
  async getVendor(id: number): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor;
  }

  async getVendors(tenantId?: number): Promise<Vendor[]> {
    if (tenantId) {
      return await db
        .select()
        .from(vendors)
        .where(or(eq(vendors.tenantId, tenantId), isNull(vendors.tenantId)));
    }
    return await db.select().from(vendors);
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    try {
      // Encrypt sensitive data
      const encryptedVendor = await DataEncryption.encryptObject(vendor, SENSITIVE_FIELDS.vendors);
      const [newVendor] = await db.insert(vendors).values(encryptedVendor).returning();
      return newVendor;
    } catch (error) {
      console.error('Error creating vendor:', error);
      // If encryption fails, try without encryption
      try {
        const [newVendor] = await db.insert(vendors).values(vendor).returning();
        return newVendor;
      } catch (fallbackError) {
        console.error('Error creating vendor (fallback):', fallbackError);
        throw new Error('Failed to create vendor');
      }
    }
  }

  async updateVendor(id: number, vendorData: Partial<InsertVendor>): Promise<Vendor | undefined> {
    try {
      // Encrypt sensitive data
      const encryptedVendorData = await DataEncryption.encryptObject(vendorData, SENSITIVE_FIELDS.vendors);
      const [updatedVendor] = await db.update(vendors).set(encryptedVendorData).where(eq(vendors.id, id)).returning();
      return updatedVendor;
    } catch (error) {
      console.error('Error updating vendor:', error);
      // If encryption fails, try without encryption
      try {
        const [updatedVendor] = await db.update(vendors).set(vendorData).where(eq(vendors.id, id)).returning();
        return updatedVendor;
      } catch (fallbackError) {
        console.error('Error updating vendor (fallback):', fallbackError);
        throw new Error('Failed to update vendor');
      }
    }
  }

  async deleteVendor(id: number): Promise<void> {
    // Retrieve vendor to get email
    const vendor = await this.getVendor(id);
    if (!vendor) return;
    // Delete related vendor product prices
    await db.delete(vendorProductPrices).where(eq(vendorProductPrices.vendorEmail, vendor.email));
    // Delete related vendor customers
    await db.delete(vendorCustomers).where(eq(vendorCustomers.vendorEmail, vendor.email));
    // Finally delete the vendor record
    await db.delete(vendors).where(eq(vendors.id, id));
  }

  // Product operations
  async getProducts(tenantId?: number): Promise<Product[]> {
    if (tenantId) {
      return await db.select().from(products).where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)));
    }
    return await db.select().from(products).where(eq(products.isActive, true));
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, productData: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updatedProduct] = await db.update(products).set(productData).where(eq(products.id, id)).returning();
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Vendor Product Prices
  async getVendorProductPrices(vendorEmail: string): Promise<VendorProductPrice[]> {
    const result = await db
      .select({
        id: vendorProductPrices.id,
        productId: vendorProductPrices.productId,
        vendorEmail: vendorProductPrices.vendorEmail,
        buyingPrice: vendorProductPrices.buyingPrice,
        sellingPrice: vendorProductPrices.sellingPrice,
        productName: products.name,
        productDescription: products.description,
        productCategory: products.category,
      })
      .from(vendorProductPrices)
      .leftJoin(products, eq(vendorProductPrices.productId, products.id))
      .where(eq(vendorProductPrices.vendorEmail, vendorEmail));

    return result.map(row => ({
      id: row.id,
      productId: row.productId,
      vendorEmail: row.vendorEmail,
      buyingPrice: row.buyingPrice,
      sellingPrice: row.sellingPrice,
      product: row.productName ? {
        id: row.productId,
        name: row.productName,
        description: row.productDescription || undefined,
        category: row.productCategory || undefined,
      } : undefined,
    }));
  }

  async createVendorProductPrice(price: InsertVendorProductPrice): Promise<VendorProductPrice> {
    const [newPrice] = await db.insert(vendorProductPrices).values(price).returning();
    return newPrice;
  }

  async updateVendorProductPrice(id: number, priceData: Partial<InsertVendorProductPrice>): Promise<VendorProductPrice | undefined> {
    const [updatedPrice] = await db.update(vendorProductPrices).set(priceData).where(eq(vendorProductPrices.id, id)).returning();
    return updatedPrice;
  }

  async deleteVendorProductPrice(id: number): Promise<void> {
    await db.delete(vendorProductPrices).where(eq(vendorProductPrices.id, id));
  }

  // Vendor Customers
  async getVendorCustomers(vendorEmail: string): Promise<VendorCustomer[]> {
    return await db.select().from(vendorCustomers).where(eq(vendorCustomers.vendorEmail, vendorEmail));
  }

  async createVendorCustomer(customer: InsertVendorCustomer): Promise<VendorCustomer> {
    try {
      // Encrypt sensitive data
      const encryptedCustomer = await DataEncryption.encryptObject(customer, SENSITIVE_FIELDS.vendorCustomers);
      const [newCustomer] = await db.insert(vendorCustomers).values(encryptedCustomer).returning();
      return newCustomer;
    } catch (error) {
      console.error('Error creating vendor customer:', error);
      // If encryption fails, try without encryption
      try {
        const [newCustomer] = await db.insert(vendorCustomers).values(customer).returning();
        return newCustomer;
      } catch (fallbackError) {
        console.error('Error creating vendor customer (fallback):', fallbackError);
        throw new Error('Failed to create vendor customer');
      }
    }
  }

  async updateVendorCustomer(id: number, customerData: Partial<InsertVendorCustomer>): Promise<VendorCustomer | undefined> {
    const [updatedCustomer] = await db.update(vendorCustomers).set(customerData).where(eq(vendorCustomers.id, id)).returning();
    return updatedCustomer;
  }

  async deleteVendorCustomer(id: number): Promise<void> {
    await db.delete(vendorCustomers).where(eq(vendorCustomers.id, id));
  }

  // Placeholder implementations for other methods
  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    return undefined;
  }

  async verifyUserEmail(token: string): Promise<User | undefined> {
    return undefined;
  }

  async getUserPermissions(userId: number): Promise<UserPermission[]> {
    return [];
  }

  async createUserPermission(permission: InsertUserPermission): Promise<UserPermission> {
    const [newPermission] = await db.insert(userPermissions).values(permission).returning();
    return newPermission;
  }

  async updateUserPermissions(userId: number, permissions: InsertUserPermission[]): Promise<void> {
    // Implementation
  }

  async deleteUserPermissions(userId: number): Promise<void> {
    await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantByName(name: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.name, name));
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant;
  }

  async getTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants);
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [newTenant] = await db.insert(tenants).values(tenant).returning();
    return newTenant;
  }

  async updateTenant(id: number, tenantData: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updatedTenant] = await db.update(tenants).set(tenantData).where(eq(tenants.id, id)).returning();
    return updatedTenant;
  }

  async deleteTenant(id: number): Promise<void> {
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  async getUsersByTenantId(tenantId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.tenantId, tenantId));
  }

  // Email Settings operations
  async getEmailSettings(tenantId: number): Promise<EmailSettings | undefined> {
    const [settings] = await db.select().from(emailSettings).where(eq(emailSettings.tenantId, tenantId));
    return settings;
  }

  async getAnyActiveEmailSettings(): Promise<EmailSettings | undefined> {
    const [settings] = await db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.isActive, true))
      .limit(1);
    return settings;
  }

  async createEmailSettings(emailSettingsData: InsertEmailSettings): Promise<EmailSettings> {
    const [newSettings] = await db.insert(emailSettings).values({
      ...emailSettingsData,
      updatedAt: new Date()
    }).returning();
    return newSettings;
  }

  async updateEmailSettings(tenantId: number, emailSettingsData: Partial<InsertEmailSettings>): Promise<EmailSettings | undefined> {
    const [updatedSettings] = await db.update(emailSettings).set({
      ...emailSettingsData,
      updatedAt: new Date()
    }).where(eq(emailSettings.tenantId, tenantId)).returning();
    return updatedSettings;
  }

  async getRunningNumber(tenantId: number, moduleName: string): Promise<RunningNumber | undefined> {
    const [config] = await db
      .select()
      .from(runningNumbers)
      .where(
        and(
          eq(runningNumbers.tenantId, tenantId),
          eq(runningNumbers.moduleName, moduleName)
        )
      )
      .limit(1);
    return config;
  }

  async upsertRunningNumber(
    tenantId: number,
    moduleName: string,
    data: SaveRunningNumber
  ): Promise<RunningNumber> {
    const existing = await this.getRunningNumber(tenantId, moduleName);
    if (existing) {
      const [updated] = await db
        .update(runningNumbers)
        .set({
          prefix: data.prefix,
          nextCounter: data.nextCounter,
          suffix: data.suffix ?? "",
          updatedAt: new Date(),
        })
        .where(eq(runningNumbers.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(runningNumbers)
      .values({
        tenantId,
        moduleName,
        prefix: data.prefix,
        nextCounter: data.nextCounter,
        suffix: data.suffix ?? "",
        updatedAt: new Date(),
      })
      .returning();
    return created;
  }

  // Add other placeholder methods as needed
  async getDependent(id: number): Promise<Dependent | undefined> {
    const [row] = await db.select().from(dependents).where(eq(dependents.id, id));
    return row;
  }

  async getDependentsByEmployeeId(employeeId: number): Promise<Dependent[]> {
    return db.select().from(dependents).where(eq(dependents.employeeId, employeeId));
  }

  async createDependent(dependent: InsertDependent): Promise<Dependent> {
    const encrypted = await DataEncryption.encryptObject(dependent, SENSITIVE_FIELDS.dependents);
    const [row] = await db.insert(dependents).values(encrypted).returning();
    return row;
  }

  async updateDependent(id: number, dependent: Partial<InsertDependent>): Promise<Dependent | undefined> {
    const encrypted = await DataEncryption.encryptObject(dependent, SENSITIVE_FIELDS.dependents);
    const [row] = await db.update(dependents).set(encrypted).where(eq(dependents.id, id)).returning();
    return row;
  }

  async deleteDependent(id: number): Promise<void> {
    await db.delete(dependents).where(eq(dependents.id, id));
  }

  async scheduleDocumentReminder(data: {
    tenantId?: number | null;
    employeeId?: number | null;
    dependentId?: number | null;
    entityId?: number | null;
    documentType: string;
    expiryDate?: Date | null;
    reminderDate: Date;
    status: "pending" | "sent" | "snoozed" | "closed";
    reminderKind?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    emailSentAt?: Date;
  }): Promise<void> {
    await db.insert(documentReminderHistory).values({
      tenantId: data.tenantId ?? null,
      employeeId: data.employeeId ?? null,
      dependentId: data.dependentId ?? null,
      entityId: data.entityId ?? null,
      documentType: data.documentType,
      expiryDate: data.expiryDate ?? null,
      reminderDate: data.reminderDate,
      status: data.status,
      reminderKind: data.reminderKind ?? null,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      emailSentAt: data.emailSentAt ?? null,
      updatedAt: new Date(),
    });
  }

  async getDueDocumentReminders(asOf: Date): Promise<(typeof documentReminderHistory.$inferSelect)[]> {
    const dayEnd = new Date(asOf);
    dayEnd.setHours(23, 59, 59, 999);
    return db
      .select()
      .from(documentReminderHistory)
      .where(
        and(
          eq(documentReminderHistory.status, "pending"),
          lte(documentReminderHistory.reminderDate, dayEnd)
        )
      );
  }

  async hasAutoReminderSent(
    employeeId: number,
    dependentId: number | null,
    documentType: string,
    reminderKind: string
  ): Promise<boolean> {
    const conditions = [
      eq(documentReminderHistory.employeeId, employeeId),
      eq(documentReminderHistory.documentType, documentType),
      eq(documentReminderHistory.reminderKind, reminderKind),
      eq(documentReminderHistory.status, "sent"),
    ];
    if (dependentId != null) {
      conditions.push(eq(documentReminderHistory.dependentId, dependentId));
    } else {
      conditions.push(isNull(documentReminderHistory.dependentId));
    }
    const rows = await db.select().from(documentReminderHistory).where(and(...conditions)).limit(1);
    return rows.length > 0;
  }

  async markDocumentReminderSent(id: number, sentAt: Date): Promise<void> {
    await db
      .update(documentReminderHistory)
      .set({ status: "sent", emailSentAt: sentAt, updatedAt: new Date() })
      .where(eq(documentReminderHistory.id, id));
  }

  async getDocumentRemindersForDocument(documentId: number): Promise<{ daysBefore: number }[]> {
    const rows = await db
      .select({ daysBefore: documentReminders.daysBefore })
      .from(documentReminders)
      .where(eq(documentReminders.documentId, documentId));
    return rows;
  }

  async getLicenseRemindersForLicense(licenseId: number): Promise<{ daysBefore: number }[]> {
    const rows = await db
      .select({ daysBefore: licenseReminders.daysBefore })
      .from(licenseReminders)
      .where(eq(licenseReminders.licenseId, licenseId));
    return rows;
  }

  async replaceLicenseReminders(licenseId: number, reminders: { daysBefore: number }[]): Promise<void> {
    await db.delete(licenseReminders).where(eq(licenseReminders.licenseId, licenseId));
    if (reminders.length > 0) {
      await db.insert(licenseReminders).values(
        reminders.map((reminder) => ({
          licenseId,
          daysBefore: reminder.daysBefore,
        }))
      );
    }
  }

  async hasConfiguredReminderBeenSent(params: {
    documentType: string;
    entityId: number;
    reminderKind: string;
    reminderDate: Date;
  }): Promise<boolean> {
    const dayStart = new Date(params.reminderDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(params.reminderDate);
    dayEnd.setHours(23, 59, 59, 999);

    const rows = await db
      .select()
      .from(documentReminderHistory)
      .where(
        and(
          eq(documentReminderHistory.documentType, params.documentType),
          eq(documentReminderHistory.entityId, params.entityId),
          eq(documentReminderHistory.reminderKind, params.reminderKind),
          eq(documentReminderHistory.status, "sent"),
          gte(documentReminderHistory.reminderDate, dayStart),
          lte(documentReminderHistory.reminderDate, dayEnd)
        )
      )
      .limit(1);
    return rows.length > 0;
  }

  async getExpiringDocumentRecords(type: string, tenantId?: number): Promise<any[]> {
    if (type === "all" || type === "expiring") {
      return this.getDocumentExpiryRecords("expiring", tenantId);
    }
    if (type === "expired") {
      return this.getDocumentExpiryRecords("expired", tenantId);
    }
    const all = await this.getDocumentExpiryRecords("expiring", tenantId);
    return all.filter((r) => r.reminderType === type);
  }

  async getDocumentExpiryRecords(
    mode: "expiring" | "expired",
    tenantId?: number
  ): Promise<DocumentExpiryRecord[]> {
    const referenceDate = new Date();
    const results: DocumentExpiryRecord[] = [];

    const pushRecord = (params: {
      recordKey: string;
      reminderType: string;
      employeeDbId?: number | null;
      employeeId: string;
      employeeName: string;
      dependentId?: number | null;
      dependentName?: string | null;
      documentNumber?: string | null;
      documentTitle?: string | null;
      expiry: Date | string | null | undefined;
      entityId?: number | null;
      email?: string;
    }) => {
      if (!params.expiry) return;
      const days = getDaysUntilExpiry(params.expiry, referenceDate);
      if (days === null) return;
      const documentNumber = params.documentNumber?.trim() || "—";
      const documentTitle =
        params.documentTitle?.trim() || documentTypeLabel(params.reminderType);

      if (mode === "expiring") {
        if (!isDocumentExpiringSoon(params.expiry, referenceDate, DOCUMENT_EXPIRY_SOON_DAYS)) return;
        results.push({
          recordKey: params.recordKey,
          reminderType: params.reminderType,
          employeeDbId: params.employeeDbId ?? null,
          employeeId: params.employeeId,
          employeeName: params.employeeName,
          dependentId: params.dependentId ?? null,
          dependentName: params.dependentName ?? null,
          documentType: documentTypeLabel(params.reminderType),
          documentNumber,
          documentTitle,
          expiryDate: new Date(params.expiry).toISOString(),
          daysRemaining: days,
          entityId: params.entityId ?? null,
          email: params.email,
        });
      } else if (isDocumentExpired(params.expiry, referenceDate)) {
        results.push({
          recordKey: params.recordKey,
          reminderType: params.reminderType,
          employeeDbId: params.employeeDbId ?? null,
          employeeId: params.employeeId,
          employeeName: params.employeeName,
          dependentId: params.dependentId ?? null,
          dependentName: params.dependentName ?? null,
          documentType: documentTypeLabel(params.reminderType),
          documentNumber,
          documentTitle,
          expiryDate: new Date(params.expiry).toISOString(),
          daysExpired: Math.abs(days),
          entityId: params.entityId ?? null,
          email: params.email,
        });
      }
    };

    let employeeQuery = db
      .select({
        id: employees.id,
        employeeId: employees.employeeId,
        name: employees.name,
        email: employees.email,
        passportNumber: employees.passportNumber,
        visaNumber: employees.visaNumber,
        nricNumber: employees.nricNumber,
        finNumber: employees.finNumber,
        passportExpiry: employees.passportExpiry,
        visaExpiry: employees.visaExpiry,
        nricExpiry: employees.nricExpiry,
      })
      .from(employees);
    if (tenantId !== undefined) {
      employeeQuery = employeeQuery.where(eq(employees.tenantId, tenantId)) as typeof employeeQuery;
    }
    const employeeRows = await employeeQuery;

    for (const row of employeeRows) {
      pushRecord({
        recordKey: `emp-passport-${row.id}`,
        reminderType: "employee_passport",
        employeeDbId: row.id,
        employeeId: row.employeeId,
        employeeName: row.name,
        documentNumber: row.passportNumber,
        documentTitle: documentTypeLabel("employee_passport"),
        expiry: row.passportExpiry,
        email: row.email ?? undefined,
      });
      pushRecord({
        recordKey: `emp-visa-${row.id}`,
        reminderType: "employee_visa",
        employeeDbId: row.id,
        employeeId: row.employeeId,
        employeeName: row.name,
        documentNumber: row.visaNumber,
        documentTitle: documentTypeLabel("employee_visa"),
        expiry: row.visaExpiry,
        email: row.email ?? undefined,
      });
      pushRecord({
        recordKey: `emp-nric-${row.id}`,
        reminderType: "employee_nric",
        employeeDbId: row.id,
        employeeId: row.employeeId,
        employeeName: row.name,
        documentNumber: row.nricNumber || row.finNumber,
        documentTitle: documentTypeLabel("employee_nric"),
        expiry: row.nricExpiry,
        email: row.email ?? undefined,
      });
    }

    let dependentQuery = db
      .select({
        dependentId: dependents.id,
        dependentName: dependents.name,
        passportNumber: dependents.passportNumber,
        visaNumber: dependents.visaNumber,
        passportExpiry: dependents.passportExpiry,
        visaExpiry: dependents.visaExpiry,
        employeeDbId: employees.id,
        employeeId: employees.employeeId,
        employeeName: employees.name,
        email: employees.email,
      })
      .from(dependents)
      .innerJoin(employees, eq(dependents.employeeId, employees.id));
    if (tenantId !== undefined) {
      dependentQuery = dependentQuery.where(eq(employees.tenantId, tenantId)) as typeof dependentQuery;
    }
    const dependentRows = await dependentQuery;

    for (const row of dependentRows) {
      pushRecord({
        recordKey: `dep-passport-${row.dependentId}`,
        reminderType: "dependent_passport",
        employeeDbId: row.employeeDbId,
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        dependentId: row.dependentId,
        dependentName: row.dependentName,
        documentNumber: row.passportNumber,
        documentTitle: documentTypeLabel("dependent_passport"),
        expiry: row.passportExpiry,
        email: row.email ?? undefined,
      });
      pushRecord({
        recordKey: `dep-visa-${row.dependentId}`,
        reminderType: "dependent_visa",
        employeeDbId: row.employeeDbId,
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        dependentId: row.dependentId,
        dependentName: row.dependentName,
        documentNumber: row.visaNumber,
        documentTitle: documentTypeLabel("dependent_visa"),
        expiry: row.visaExpiry,
        email: row.email ?? undefined,
      });
    }

    let licenseQuery = db
      .select({
        id: licenses.id,
        name: licenses.name,
        licenseKey: licenses.licenseKey,
        expiryDate: licenses.expiryDate,
      })
      .from(licenses);
    if (tenantId !== undefined) {
      licenseQuery = licenseQuery.where(eq(licenses.tenantId, tenantId)) as typeof licenseQuery;
    }
    const licenseRows = await licenseQuery;
    for (const license of licenseRows) {
      pushRecord({
        recordKey: `license-${license.id}`,
        reminderType: "license",
        employeeId: "—",
        employeeName: license.name,
        documentNumber: license.licenseKey,
        documentTitle: license.name,
        expiry: license.expiryDate,
        entityId: license.id,
      });
    }

    let companyDocsQuery = db
      .select({
        id: companyDocuments.id,
        title: companyDocuments.title,
        expiryDate: companyDocuments.expiryDate,
      })
      .from(companyDocuments);
    if (tenantId !== undefined) {
      companyDocsQuery = companyDocsQuery.where(eq(companyDocuments.tenantId, tenantId)) as typeof companyDocsQuery;
    }
    const companyDocRows = await companyDocsQuery;
    for (const doc of companyDocRows) {
      pushRecord({
        recordKey: `company-doc-${doc.id}`,
        reminderType: "company_document",
        employeeId: "—",
        employeeName: doc.title,
        documentNumber: doc.title,
        documentTitle: doc.title,
        expiry: doc.expiryDate,
        entityId: doc.id,
      });
    }

    let employeeDocsQuery = db
      .select({
        id: employeeDocuments.id,
        expiryDate: employeeDocuments.expiryDate,
        documentType: employeeDocuments.documentType,
        employeeDbId: employees.id,
        employeeId: employees.employeeId,
        employeeName: employees.name,
        email: employees.email,
      })
      .from(employeeDocuments)
      .innerJoin(employees, eq(employeeDocuments.employeeId, employees.id));
    if (tenantId !== undefined) {
      employeeDocsQuery = employeeDocsQuery.where(eq(employees.tenantId, tenantId)) as typeof employeeDocsQuery;
    }
    const employeeDocRows = await employeeDocsQuery;
    for (const doc of employeeDocRows) {
      pushRecord({
        recordKey: `emp-doc-${doc.id}`,
        reminderType: "employee_document",
        employeeDbId: doc.employeeDbId,
        employeeId: doc.employeeId,
        employeeName: doc.employeeName,
        documentNumber: `DOC-${doc.id}`,
        documentTitle: formatEmployeeDocumentTypeEnum(String(doc.documentType)),
        expiry: doc.expiryDate,
        entityId: doc.id,
        email: doc.email ?? undefined,
      });
    }

    return results.sort(
      (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
    );
  }

  async isDocumentReminderSnoozed(
    reminderType: string,
    employeeDbId?: number | null,
    dependentId?: number | null,
    entityId?: number | null
  ): Promise<boolean> {
    const today = startOfDay(new Date());
    const conditions = [
      eq(documentReminderHistory.documentType, reminderType),
      or(
        eq(documentReminderHistory.status, "snoozed"),
        eq(documentReminderHistory.status, "pending")
      )!,
      gt(documentReminderHistory.reminderDate, today),
    ];

    if (employeeDbId != null) {
      conditions.push(eq(documentReminderHistory.employeeId, employeeDbId));
    } else if (entityId != null) {
      conditions.push(eq(documentReminderHistory.entityId, entityId));
    }

    if (dependentId != null) {
      conditions.push(eq(documentReminderHistory.dependentId, dependentId));
    }

    const rows = await db
      .select()
      .from(documentReminderHistory)
      .where(and(...conditions))
      .limit(1);
    return rows.length > 0;
  }

  async hasNotificationForEntity(userId: number, entityType: string): Promise<boolean> {
    const rows = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.targetUserId, userId),
          eq(notifications.entityType, entityType),
          eq(notifications.seen, false)
        )
      )
      .limit(1);
    return rows.length > 0;
  }

  async getNotificationRecipientUsers(tenantId?: number): Promise<User[]> {
    if (tenantId == null) {
      return [];
    }
    const allUsers = await this.getUsers(tenantId);
    return allUsers.filter(
      (user) =>
        user.tenantId === tenantId &&
        (user.role === "admin" || user.role === "hr_manager")
    );
  }

  async getAsset(id: number): Promise<Asset | undefined> {
    const result = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
    return result[0];
  }
  async getAssets(tenantId?: number): Promise<Asset[]> {
    if (tenantId) {
      return await db.select().from(assets).where(eq(assets.tenantId, tenantId));
    }
    return await db.select().from(assets);
  }
  async createAsset(asset: InsertAsset): Promise<Asset> {
    const result = await db.insert(assets).values(this.normalizeAssetDates(asset)).returning();
    return result[0];
  }
  async updateAsset(id: number, asset: Partial<InsertAsset>): Promise<Asset | undefined> {
    const result = await db
      .update(assets)
      .set(this.normalizeAssetDates(asset))
      .where(eq(assets.id, id))
      .returning();
    return result[0];
  }
  async deleteAsset(id: number): Promise<void> {
    await db.delete(assetAssignments).where(eq(assetAssignments.assetId, id));
    await db.delete(maintenanceRecords).where(eq(maintenanceRecords.assetId, id));
    await db.delete(licenses).where(eq(licenses.assetId, id));
    await db.delete(assets).where(eq(assets.id, id));
  }

  async getAssetAssignment(id: number): Promise<AssetAssignment | undefined> {
    const [assignment] = await db.select().from(assetAssignments).where(eq(assetAssignments.id, id));
    return assignment;
  }

  async getAssetAssignmentsByAssetId(assetId: number): Promise<AssetAssignment[]> {
    return await db.select().from(assetAssignments).where(eq(assetAssignments.assetId, assetId));
  }

  async getAssetAssignmentsByEmployeeId(employeeId: number): Promise<AssetAssignment[]> {
    return await db.select().from(assetAssignments).where(eq(assetAssignments.employeeId, employeeId));
  }

  async getAssetAssignments(tenantId?: number): Promise<any[]> {
    const rows = tenantId
      ? await db
          .select({
            id: assetAssignments.id,
            tenantId: assetAssignments.tenantId,
            dateAssigned: assetAssignments.dateAssigned,
            dateReturned: assetAssignments.dateReturned,
            notes: assetAssignments.notes,
            assetId: assets.id,
            assetType: assets.type,
            assetTag: assets.tag,
            assetSerial: assets.serial,
            employeeId: employees.id,
            employeeName: employees.name,
            employeeDepartment: employees.department,
          })
          .from(assetAssignments)
          .leftJoin(assets, eq(assetAssignments.assetId, assets.id))
          .leftJoin(employees, eq(assetAssignments.employeeId, employees.id))
          .where(eq(assetAssignments.tenantId, tenantId))
      : await db
          .select({
            id: assetAssignments.id,
            tenantId: assetAssignments.tenantId,
            dateAssigned: assetAssignments.dateAssigned,
            dateReturned: assetAssignments.dateReturned,
            notes: assetAssignments.notes,
            assetId: assets.id,
            assetType: assets.type,
            assetTag: assets.tag,
            assetSerial: assets.serial,
            employeeId: employees.id,
            employeeName: employees.name,
            employeeDepartment: employees.department,
          })
          .from(assetAssignments)
          .leftJoin(assets, eq(assetAssignments.assetId, assets.id))
          .leftJoin(employees, eq(assetAssignments.employeeId, employees.id));

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      assetId: row.assetId,
      employeeId: row.employeeId,
      dateAssigned: row.dateAssigned ? new Date(row.dateAssigned).toISOString() : new Date().toISOString(),
      dateReturned: row.dateReturned ? new Date(row.dateReturned).toISOString() : null,
      notes: row.notes,
      status: row.dateReturned ? "returned" : "active",
      asset: {
        id: row.assetId || 0,
        name: row.assetType ? row.assetType.charAt(0).toUpperCase() + row.assetType.slice(1) : "Unknown",
        type: row.assetType || "Unknown",
        tag: row.assetTag || "",
        serial: row.assetSerial || "",
      },
      employee: {
        id: row.employeeId || 0,
        name: row.employeeName || "Unknown",
        department: row.employeeDepartment || "Unknown",
      },
    }));
  }

  async getAssetAssignmentsAllTenants(): Promise<any[]> {
    return await this.getAssetAssignments();
  }

  async getActiveAssetAssignments(tenantId?: number): Promise<AssetAssignment[]> {
    const query = db.select().from(assetAssignments).where(isNull(assetAssignments.dateReturned));
    if (tenantId) {
      return await db.select().from(assetAssignments).where(and(eq(assetAssignments.tenantId, tenantId), isNull(assetAssignments.dateReturned)));
    }
    return await query;
  }

  async createAssetAssignment(assignment: InsertAssetAssignment): Promise<AssetAssignment> {
    const [newAssignment] = await db.insert(assetAssignments).values(assignment).returning();
    return newAssignment;
  }

  async updateAssetAssignment(id: number, assignment: Partial<InsertAssetAssignment>): Promise<AssetAssignment | undefined> {
    const [updatedAssignment] = await db.update(assetAssignments).set(assignment).where(eq(assetAssignments.id, id)).returning();
    return updatedAssignment;
  }

  async deleteAssetAssignment(id: number): Promise<void> {
    await db.delete(assetAssignments).where(eq(assetAssignments.id, id));
  }

  async getMaintenanceRecord(id: number): Promise<MaintenanceRecord | undefined> {
    const [record] = await db.select().from(maintenanceRecords).where(eq(maintenanceRecords.id, id));
    return record;
  }

  async getMaintenanceRecordsByAssetId(assetId: number): Promise<MaintenanceRecord[]> {
    return await db.select().from(maintenanceRecords).where(eq(maintenanceRecords.assetId, assetId));
  }

  async getMaintenanceHistory(tenantId?: number): Promise<any[]> {
    const rows = tenantId
      ? await db
          .select({
            id: maintenanceRecords.id,
            tenantId: maintenanceRecords.tenantId,
            assetId: maintenanceRecords.assetId,
            issueDescription: maintenanceRecords.issueDescription,
            resolution: maintenanceRecords.resolution,
            serviceDate: maintenanceRecords.serviceDate,
            nextMaintenanceDate: maintenanceRecords.nextMaintenanceDate,
            cost: maintenanceRecords.cost,
            assetType: assets.type,
            assetTag: assets.tag,
          })
          .from(maintenanceRecords)
          .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
          .where(eq(maintenanceRecords.tenantId, tenantId))
      : await db
          .select({
            id: maintenanceRecords.id,
            tenantId: maintenanceRecords.tenantId,
            assetId: maintenanceRecords.assetId,
            issueDescription: maintenanceRecords.issueDescription,
            resolution: maintenanceRecords.resolution,
            serviceDate: maintenanceRecords.serviceDate,
            nextMaintenanceDate: maintenanceRecords.nextMaintenanceDate,
            cost: maintenanceRecords.cost,
            assetType: assets.type,
            assetTag: assets.tag,
          })
          .from(maintenanceRecords)
          .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id));

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      assetId: row.assetId,
      issueDescription: row.issueDescription,
      resolution: row.resolution,
      serviceDate: row.serviceDate ? new Date(row.serviceDate).toISOString() : null,
      nextMaintenanceDate: row.nextMaintenanceDate ? new Date(row.nextMaintenanceDate).toISOString() : null,
      cost: row.cost,
      asset: {
        id: row.assetId || 0,
        name: row.assetType ? row.assetType.charAt(0).toUpperCase() + row.assetType.slice(1) : "Unknown",
        type: row.assetType || "Unknown",
        tag: row.assetTag || "",
      },
    }));
  }

  async getMaintenanceHistoryAllTenants(): Promise<any[]> {
    return await this.getMaintenanceHistory();
  }

  async createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord> {
    const [newRecord] = await db.insert(maintenanceRecords).values(record).returning();
    return newRecord;
  }

  async updateMaintenanceRecord(id: number, record: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined> {
    const [updatedRecord] = await db.update(maintenanceRecords).set(record).where(eq(maintenanceRecords.id, id)).returning();
    return updatedRecord;
  }

  async deleteMaintenanceRecord(id: number): Promise<void> {
    await db.delete(maintenanceRecords).where(eq(maintenanceRecords.id, id));
  }

  async getEmployeeDocument(id: number): Promise<EmployeeDocument | undefined> { return undefined; }
  async getEmployeeDocuments(employeeId: number): Promise<EmployeeDocument[]> { return []; }
  async getEmployeeDocumentsByEmployeeId(employeeId: number): Promise<EmployeeDocument[]> { return []; }
  async createEmployeeDocument(document: InsertEmployeeDocument): Promise<EmployeeDocument> { throw new Error('Not implemented'); }
  async updateEmployeeDocument(id: number, document: Partial<InsertEmployeeDocument>): Promise<EmployeeDocument | undefined> { return undefined; }
  async deleteEmployeeDocument(id: number): Promise<void> { }

  async getCompanyDocument(id: number): Promise<CompanyDocument | undefined> { return undefined; }
  async getCompanyDocuments(tenantId?: number): Promise<CompanyDocument[]> {
    let query = db.select().from(companyDocuments);
    if (tenantId !== undefined) {
      query = query.where(eq(companyDocuments.tenantId, tenantId));
    }
    return await query.orderBy(desc(companyDocuments.createdAt));
  }
  async createCompanyDocument(document: InsertCompanyDocument): Promise<CompanyDocument> { throw new Error('Not implemented'); }
  async updateCompanyDocument(id: number, document: Partial<InsertCompanyDocument>): Promise<CompanyDocument | undefined> { return undefined; }
  async deleteCompanyDocument(id: number): Promise<void> { }

  async getNotification(id: number): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification;
  }

  async getNotificationsByUserId(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.targetUserId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnseenNotificationsByUserId(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.targetUserId, userId), eq(notifications.seen, false)));
  }

  private normalizeNotificationType(type: unknown): Notification["type"] {
    const allowedTypes = new Set<Notification["type"]>([
      'document_expiry',
      'maintenance_due',
      'assignment',
      'license_expiry',
    ]);

    if (typeof type === 'string' && allowedTypes.has(type as Notification["type"])) {
      return type as Notification["type"];
    }

    return 'assignment';
  }

  private normalizeNotificationPayload(notification: Partial<InsertNotification> & Record<string, any>) {
    const targetUserId = Number(notification.targetUserId);

    return {
      tenantId: notification.tenantId ?? null,
      type: this.normalizeNotificationType(notification.type),
      message: typeof notification.message === 'string' ? notification.message : '',
      targetUserId: Number.isFinite(targetUserId) ? targetUserId : 1,
      seen: notification.seen ?? false,
      entityId: notification.entityId ?? null,
      entityType: notification.entityType ?? null,
    };
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const normalizedNotification = this.normalizeNotificationPayload(notification as any);

    try {
      const [newNotification] = await db.insert(notifications).values(normalizedNotification).returning();
      return newNotification;
    } catch (error) {
      console.error('Error creating notification:', error);

      // Fall back to an in-memory shaped response so the primary action
      // (for example creating a customer or invoice) can still complete.
      return {
        id: Date.now(),
        tenantId: normalizedNotification.tenantId,
        type: normalizedNotification.type,
        message: normalizedNotification.message,
        targetUserId: normalizedNotification.targetUserId,
        seen: normalizedNotification.seen ?? false,
        entityId: normalizedNotification.entityId,
        entityType: normalizedNotification.entityType,
        createdAt: new Date(),
      } as Notification;
    }
  }

  async markNotificationAsSeen(id: number): Promise<Notification | undefined> {
    const [updatedNotification] = await db
      .update(notifications)
      .set({ seen: true })
      .where(eq(notifications.id, id))
      .returning();
    return updatedNotification;
  }

  async markAllNotificationsAsSeen(userId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ seen: true })
      .where(and(eq(notifications.targetUserId, userId), eq(notifications.seen, false)));
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async getAuditLog(id: number): Promise<AuditLog | undefined> { return undefined; }
  async getAuditLogs(tenantId?: number): Promise<AuditLog[]> { return []; }
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> { 
    try {
      const [auditLog] = await db.insert(auditLogs).values(log).returning();
      return auditLog;
    } catch (error) {
      console.error('Error creating audit log:', error);
      // Return a mock audit log to prevent errors
      return {
        id: 1,
        tenantId: log.tenantId || 1,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        userId: log.userId,
        timestamp: log.timestamp || new Date(),
      } as AuditLog;
    }
  }

  async getLicense(id: number): Promise<License | undefined> {
    const result = await db.select().from(licenses).where(eq(licenses.id, id)).limit(1);
    return result[0];
  }
  async getLicensesByAssetId(assetId: number): Promise<License[]> {
    return await db.select().from(licenses).where(eq(licenses.assetId, assetId));
  }
  async getExpiringLicenses(daysThreshold: number, tenantId?: number): Promise<License[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
    
    let query = db.select().from(licenses)
      .where(and(
        lte(licenses.expiryDate, thresholdDate),
        isNotNull(licenses.expiryDate)
      ));
    
    if (tenantId) {
      query = query.where(eq(licenses.tenantId, tenantId));
    }
    
    return await query;
  }
  async getAllLicenses(tenantId?: number): Promise<License[]> {
    if (tenantId) {
      // Include licenses matching this tenant OR legacy licenses with no tenant assigned
      return await db.select().from(licenses).where(
        or(eq(licenses.tenantId, tenantId), isNull(licenses.tenantId))
      );
    }
    return await db.select().from(licenses);
  }
  async createLicense(license: InsertLicense): Promise<License> {
    const result = await db.insert(licenses).values(license).returning();
    return result[0];
  }
  async updateLicense(id: number, license: Partial<InsertLicense>): Promise<License | undefined> {
    // Ensure tenantId is present; fallback to default tenant (1) if missing
    const safeLicense = {
      ...license,
      tenantId: (license as any).tenantId ?? 1,
    };
    const result = await db.update(licenses).set(safeLicense).where(eq(licenses.id, id)).returning();
    return result[0];
  }
  async deleteLicense(id: number): Promise<void> {
    await db.delete(licenses).where(eq(licenses.id, id));
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomers(tenantId?: number): Promise<Customer[]> {
    if (tenantId) {
      return await db.select().from(customers).where(eq(customers.tenantId, tenantId));
    }
    return await db.select().from(customers);
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    try {
      // Encrypt sensitive data
      const encryptedCustomer = await DataEncryption.encryptObject(customer, SENSITIVE_FIELDS.customers);
      const [newCustomer] = await db.insert(customers).values(encryptedCustomer).returning();
      return newCustomer;
    } catch (error) {
      console.error('Error creating customer:', error);
      // If encryption fails, try without encryption
      try {
        const [newCustomer] = await db.insert(customers).values(customer).returning();
        return newCustomer;
      } catch (fallbackError) {
        console.error('Error creating customer (fallback):', fallbackError);
        throw new Error('Failed to create customer');
      }
    }
  }

  async updateCustomer(id: number, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    try {
      // Encrypt sensitive data
      const encryptedCustomerData = await DataEncryption.encryptObject(customerData, SENSITIVE_FIELDS.customers);
      const [updatedCustomer] = await db.update(customers).set(encryptedCustomerData).where(eq(customers.id, id)).returning();
      return updatedCustomer;
    } catch (error) {
      console.error('Error updating customer:', error);
      // If encryption fails, try without encryption
      try {
        const [updatedCustomer] = await db.update(customers).set(customerData).where(eq(customers.id, id)).returning();
        return updatedCustomer;
      } catch (fallbackError) {
        console.error('Error updating customer (fallback):', fallbackError);
        throw new Error('Failed to update customer');
      }
    }
  }

  async deleteCustomer(id: number): Promise<void> {
    // Nullify customerId on related invoices to avoid FK constraint violation
    await db.update(invoices).set({ customerId: null }).where(eq(invoices.customerId, id));
    await db.delete(customers).where(eq(customers.id, id));
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoices(tenantId?: number): Promise<Invoice[]> {
    if (tenantId) {
      return await db.select().from(invoices).where(eq(invoices.tenantId, tenantId));
    }
    return await db.select().from(invoices);
  }

  async createInvoice(invoice: InsertInvoice & { items?: InsertInvoiceItem[] }): Promise<Invoice> {
    try {
      const { items, ...invoiceData } = invoice;
      const [newInvoice] = await db.insert(invoices).values(invoiceData).returning();
      
      // Create invoice items if provided
      if (items && items.length > 0) {
        for (const item of items) {
          await db.insert(invoiceItems).values({
            ...item,
            invoiceId: newInvoice.id
          });
        }
      }
      
      return newInvoice;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw new Error('Failed to create invoice');
    }
  }

  async updateInvoice(id: number, invoiceData: Partial<InsertInvoice> & { items?: InsertInvoiceItem[] }): Promise<Invoice | undefined> {
    try {
      const { items, ...updateData } = invoiceData;
      const [updatedInvoice] = await db.update(invoices).set(updateData).where(eq(invoices.id, id)).returning();

      if (items !== undefined) {
        await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
        if (items.length > 0) {
          for (const item of items) {
            await db.insert(invoiceItems).values({
              ...item,
              invoiceId: id
            });
          }
        }
      }

      return updatedInvoice;
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw new Error('Failed to update invoice');
    }
  }

  async deleteInvoice(id: number): Promise<void> {
    // Delete all related records to avoid FK constraint violations
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    await db.delete(payments).where(eq(payments.invoiceId, id));
    await db.delete(invoiceDesigns).where(eq(invoiceDesigns.invoiceId, id));
    // Then delete the invoice
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  async getInvoiceItemsByInvoiceId(invoiceId: number): Promise<InvoiceItem[]> {
    return await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  }

  async createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem> {
    const [newItem] = await db.insert(invoiceItems).values(item).returning();
    return newItem;
  }

  async updateInvoiceItem(id: number, itemData: Partial<InsertInvoiceItem>): Promise<InvoiceItem | undefined> {
    const [updatedItem] = await db.update(invoiceItems).set(itemData).where(eq(invoiceItems.id, id)).returning();
    return updatedItem;
  }

  async deleteInvoiceItem(id: number): Promise<void> {
    await db.delete(invoiceItems).where(eq(invoiceItems.id, id));
  }

  async getPayment(id: number): Promise<Payment | undefined> { return undefined; }
  async getPaymentsByInvoiceId(invoiceId: number): Promise<Payment[]> { return []; }
  async createPayment(payment: InsertPayment): Promise<Payment> { throw new Error('Not implemented'); }
  async updatePayment(id: number, payment: Partial<InsertPayment>): Promise<Payment | undefined> { return undefined; }
  async deletePayment(id: number): Promise<void> { }

  async getExpiringDocuments(daysThreshold: number, tenantId?: number): Promise<any[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const thresholdDate = new Date(today);
      thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

      const tenantFilter = tenantId ? eq(companyDocuments.tenantId, tenantId) : undefined;

      const rows = await db
        .select({
          id: companyDocuments.id,
          documentType: companyDocuments.documentType,
          title: companyDocuments.title,
          issueDate: companyDocuments.issueDate,
          expiryDate: companyDocuments.expiryDate,
          notes: companyDocuments.notes,
        })
        .from(companyDocuments)
        .where(and(
          tenantFilter,
          isNotNull(companyDocuments.expiryDate),
          gt(companyDocuments.expiryDate, today),
          lte(companyDocuments.expiryDate, thresholdDate)
        ))
        .orderBy(companyDocuments.expiryDate);

      return rows.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        title: doc.title,
        name: doc.title,
        issueDate: doc.issueDate ? new Date(doc.issueDate).toISOString() : null,
        expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString() : null,
        daysUntilExpiry: doc.expiryDate
          ? Math.ceil((new Date(doc.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
        notes: doc.notes || "",
      }));
    } catch (error) {
      console.error('Error fetching expiring documents:', error);
      return [];
    }
  }

  async getDashboardStats(tenantId?: number): Promise<any> {
    const referenceDate = new Date();
    const today = startOfDay(referenceDate);
    const thirtyDaysFromNow = startOfDay(referenceDate);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    let licenseExpiryQuery = db.select({ count: sql<number>`count(*)` }).from(licenses);
    if (tenantId !== undefined) {
      licenseExpiryQuery = licenseExpiryQuery.where(
        and(
          eq(licenses.tenantId, tenantId),
          isNotNull(licenses.expiryDate),
          gte(licenses.expiryDate, today),
          lte(licenses.expiryDate, thirtyDaysFromNow)
        )
      );
    } else {
      licenseExpiryQuery = licenseExpiryQuery.where(
        and(
          isNotNull(licenses.expiryDate),
          gte(licenses.expiryDate, today),
          lte(licenses.expiryDate, thirtyDaysFromNow)
        )
      );
    }
    const licenseExpiryRow = await licenseExpiryQuery;

    let employeeCountQuery = db.select({ count: sql<number>`count(*)` }).from(employees);
    if (tenantId !== undefined) {
      employeeCountQuery = employeeCountQuery.where(eq(employees.tenantId, tenantId));
    }
    const employeeCountRow = await employeeCountQuery;

    let passportExpiryCountQuery = db.select({ count: sql<number>`count(*)` }).from(employees);
    const passportExpiryConditions = and(
      isNotNull(employees.passportExpiry),
      lte(employees.passportExpiry, thirtyDaysFromNow)
    );
    if (tenantId !== undefined) {
      passportExpiryCountQuery = passportExpiryCountQuery.where(
        and(eq(employees.tenantId, tenantId), passportExpiryConditions)
      );
    } else {
      passportExpiryCountQuery = passportExpiryCountQuery.where(passportExpiryConditions);
    }
    const passportExpiryCountRow = await passportExpiryCountQuery;

    let visaExpiryCountQuery = db.select({ count: sql<number>`count(*)` }).from(employees);
    const visaExpiryConditions = and(
      isNotNull(employees.visaExpiry),
      lte(employees.visaExpiry, thirtyDaysFromNow)
    );
    if (tenantId !== undefined) {
      visaExpiryCountQuery = visaExpiryCountQuery.where(
        and(eq(employees.tenantId, tenantId), visaExpiryConditions)
      );
    } else {
      visaExpiryCountQuery = visaExpiryCountQuery.where(visaExpiryConditions);
    }
    const visaExpiryCountRow = await visaExpiryCountQuery;

    let dependentPassportExpiryCountQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(dependents)
      .innerJoin(employees, eq(dependents.employeeId, employees.id));
    const depPassportConditions = and(
      isNotNull(dependents.passportExpiry),
      lte(dependents.passportExpiry, thirtyDaysFromNow)
    );
    if (tenantId !== undefined) {
      dependentPassportExpiryCountQuery = dependentPassportExpiryCountQuery.where(
        and(eq(employees.tenantId, tenantId), depPassportConditions)
      );
    } else {
      dependentPassportExpiryCountQuery = dependentPassportExpiryCountQuery.where(depPassportConditions);
    }
    const dependentPassportExpiryCountRow = await dependentPassportExpiryCountQuery;

    let dependentVisaExpiryCountQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(dependents)
      .innerJoin(employees, eq(dependents.employeeId, employees.id));
    const depVisaConditions = and(
      isNotNull(dependents.visaExpiry),
      lte(dependents.visaExpiry, thirtyDaysFromNow)
    );
    if (tenantId !== undefined) {
      dependentVisaExpiryCountQuery = dependentVisaExpiryCountQuery.where(
        and(eq(employees.tenantId, tenantId), depVisaConditions)
      );
    } else {
      dependentVisaExpiryCountQuery = dependentVisaExpiryCountQuery.where(depVisaConditions);
    }
    const dependentVisaExpiryCountRow = await dependentVisaExpiryCountQuery;

    let assetCountQuery = db.select({ count: sql<number>`count(*)` }).from(assets);
    if (tenantId !== undefined) {
      assetCountQuery = assetCountQuery.where(eq(assets.tenantId, tenantId));
    }
    const assetCountRow = await assetCountQuery;

    let vendorCountQuery = db.select({ count: sql<number>`count(*)` }).from(vendors);
    if (tenantId !== undefined) {
      vendorCountQuery = vendorCountQuery.where(eq(vendors.tenantId, tenantId));
    }
    const vendorCountRow = await vendorCountQuery;

    let customerCountQuery = db.select({ count: sql<number>`count(*)` }).from(customers);
    if (tenantId !== undefined) {
      customerCountQuery = customerCountQuery.where(eq(customers.tenantId, tenantId));
    }
    const customerCountRow = await customerCountQuery;

    let assignmentCountQuery = db.select({ count: sql<number>`count(*)` }).from(assetAssignments);
    if (tenantId !== undefined) {
      assignmentCountQuery = assignmentCountQuery.where(eq(assetAssignments.tenantId, tenantId));
    }
    const assignmentCountRow = await assignmentCountQuery;

    let assetDistributionQuery = db
      .select({
        type: assets.type,
        count: sql<number>`count(*)`,
      })
      .from(assets)
      .groupBy(assets.type)
      .orderBy(desc(sql`count(*)`));
    if (tenantId !== undefined) {
      assetDistributionQuery = assetDistributionQuery.where(eq(assets.tenantId, tenantId));
    }
    const assetDistributionRows = await assetDistributionQuery;

    let recentEmployeeQuery = db
      .select({
        id: employees.id,
        name: employees.name,
        createdAt: employees.createdAt,
      })
      .from(employees);
    if (tenantId !== undefined) {
      recentEmployeeQuery = recentEmployeeQuery.where(eq(employees.tenantId, tenantId));
    }
    const recentEmployeeRows = await recentEmployeeQuery
      .orderBy(desc(employees.createdAt))
      .limit(3);

    let recentAssignmentQuery = db
      .select({
        id: assetAssignments.id,
        dateAssigned: assetAssignments.dateAssigned,
        dateReturned: assetAssignments.dateReturned,
        assetId: assets.id,
        assetType: assets.type,
        assetTag: assets.tag,
        assetSerial: assets.serial,
        employeeId: employees.id,
        employeeName: employees.name,
        employeeDepartment: employees.department,
      })
      .from(assetAssignments)
      .leftJoin(assets, eq(assetAssignments.assetId, assets.id))
      .leftJoin(employees, eq(assetAssignments.employeeId, employees.id));
    if (tenantId !== undefined) {
      recentAssignmentQuery = recentAssignmentQuery.where(
        or(
          eq(assetAssignments.tenantId, tenantId),
          and(isNull(assetAssignments.tenantId), eq(employees.tenantId, tenantId))
        )
      );
    }
    const recentAssignmentRows = await recentAssignmentQuery
      .orderBy(desc(assetAssignments.dateAssigned))
      .limit(3);

    let companyDocsQuery = db
      .select({
        id: companyDocuments.id,
        documentType: companyDocuments.documentType,
        title: companyDocuments.title,
        expiryDate: companyDocuments.expiryDate,
      })
      .from(companyDocuments);
    if (tenantId !== undefined) {
      companyDocsQuery = companyDocsQuery.where(eq(companyDocuments.tenantId, tenantId));
    }
    const companyDocs = await companyDocsQuery;

    const docStats = computeDocumentExpiryStats(companyDocs, referenceDate);
    const totalDocuments = docStats.total;

    const expiringRecords = await this.getDocumentExpiryRecords("expiring", tenantId);
    const expiredRecords = await this.getDocumentExpiryRecords("expired", tenantId);
    const expiringSoonDocuments = expiringRecords.length;
    const expiredDocuments = expiredRecords.length;
    const validDocuments = docStats.valid;

    const expiringDocumentRows = filterExpiringSoonDocuments(companyDocs, referenceDate).sort(
      (a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime()
    );
    const expiredDocumentRows = filterExpiredDocuments(companyDocs, referenceDate).sort(
      (a, b) => new Date(b.expiryDate!).getTime() - new Date(a.expiryDate!).getTime()
    );

    const totalEmployees = Number(employeeCountRow[0]?.count || 0);
    const totalAssets = Number(assetCountRow[0]?.count || 0);
    const totalVendors = Number(vendorCountRow[0]?.count || 0);
    const totalCustomers = Number(customerCountRow[0]?.count || 0);
    const totalAssignments = Number(assignmentCountRow[0]?.count || 0);
    const licenseExpiry = Number(licenseExpiryRow[0]?.count || 0);

    const distributionWithPercentage = assetDistributionRows.map((item) => ({
      type: item.type || "Unknown",
      count: Number(item.count || 0),
      percentage: totalAssets > 0 ? Math.round((Number(item.count || 0) / totalAssets) * 100) : 0,
    }));

    const docsWithExpiry = validDocuments + expiringSoonDocuments + expiredDocuments;
    const validPercentage =
      docsWithExpiry > 0 ? Math.round((validDocuments / docsWithExpiry) * 100) : 0;
    const expiringSoonPercentage =
      docsWithExpiry > 0 ? Math.round((expiringSoonDocuments / docsWithExpiry) * 100) : 0;
    const expiredPercentage =
      docsWithExpiry > 0 ? Math.round((expiredDocuments / docsWithExpiry) * 100) : 0;

    const recentActivities = [
      ...recentEmployeeRows.map((employee) => ({
        id: employee.id,
        type: "system" as const,
        message: `New employee added: ${employee.name}`,
        timestamp: employee.createdAt ? new Date(employee.createdAt).toLocaleString() : "",
        sortTime: employee.createdAt ? new Date(employee.createdAt).getTime() : 0,
      })),
      ...recentAssignmentRows.map((assignment) => ({
        id: assignment.id,
        type: "assignment" as const,
        message: `${assignment.assetType || "Asset"} assigned to ${assignment.employeeName || "employee"}`,
        timestamp: assignment.dateAssigned ? new Date(assignment.dateAssigned).toLocaleString() : "",
        sortTime: assignment.dateAssigned ? new Date(assignment.dateAssigned).getTime() : 0,
      })),
    ]
      .sort((a, b) => b.sortTime - a.sortTime)
      .slice(0, 5)
      .map(({ sortTime, ...activity }) => activity);

    const recentAssignments = recentAssignmentRows.map((assignment) => ({
      id: assignment.id,
      assetId: assignment.assetId,
      employeeId: assignment.employeeId,
      dateAssigned: assignment.dateAssigned ? new Date(assignment.dateAssigned).toLocaleDateString() : "",
      status: assignment.dateReturned ? "returned" : "active",
      asset: {
        id: assignment.assetId || 0,
        name:
          assignment.assetTag ||
          (assignment.assetType
            ? assignment.assetType.charAt(0).toUpperCase() + assignment.assetType.slice(1)
            : "Unknown"),
        type: assignment.assetType || "Unknown",
        tag: assignment.assetTag || "",
        serial: assignment.assetSerial || "",
      },
      employee: {
        id: assignment.employeeId || 0,
        name: assignment.employeeName || "Unknown",
        department: assignment.employeeDepartment || "Unknown",
      },
    }));

    const expiringDocuments = expiringDocumentRows.map((doc) => ({
      id: doc.id,
      type: doc.documentType,
      name: doc.title || "Unknown",
      daysUntilExpiry: getDaysUntilExpiry(doc.expiryDate, referenceDate) ?? 0,
    }));

    const expiredDocumentsList = expiredDocumentRows.map((doc) => ({
      id: doc.id,
      type: doc.documentType,
      name: doc.title || "Unknown",
      daysUntilExpiry: getDaysUntilExpiry(doc.expiryDate, referenceDate) ?? 0,
    }));

    return {
      counts: {
        employees: totalEmployees,
        assets: totalAssets,
        vendors: totalVendors,
        customers: totalCustomers,
        assignments: totalAssignments,
        documents: totalDocuments,
        expiringDocuments: expiringSoonDocuments,
        expiredDocuments,
        licenseExpiry: expiringRecords.filter((r) => r.reminderType === "license").length,
      },
      assetDistribution: distributionWithPercentage,
      documentStatus: {
        valid: {
          count: validDocuments,
          percentage: validPercentage,
        },
        expiringSoon: {
          count: expiringSoonDocuments,
          percentage: expiringSoonPercentage,
        },
        expired: {
          count: expiredDocuments,
          percentage: expiredPercentage,
        },
      },
      recentActivities,
      recentAssignments,
      expiringDocuments,
      expiredDocuments: expiredDocumentsList,
    };
  }

  private normalizeAssetDates(asset: Partial<InsertAsset>): Partial<InsertAsset> {
    const normalized: Partial<InsertAsset> = { ...asset };

    for (const field of ["purchaseDate", "warrantyExpiry"] as const) {
      const value = normalized[field];

      if (value === undefined || value === null || value === "") {
        continue;
      }

      if (typeof value === "string") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          normalized[field] = parsed as any;
        }
      }
    }

    return normalized;
  }
}

// Export storage instance
export const storage = new DatabaseStorage(); 

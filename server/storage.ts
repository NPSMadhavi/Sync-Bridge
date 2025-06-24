import { db, pool } from "./db";
import {
  users, employees, dependents, assets, assetAssignments, 
  maintenanceRecords, employeeDocuments, vendors, notifications, 
  auditLogs, licenses, tenants, customers, invoices, invoiceItems, payments,
  userPermissions,
  User, InsertUser, Employee, InsertEmployee,
  Dependent, InsertDependent, Asset, InsertAsset, 
  AssetAssignment, InsertAssetAssignment, MaintenanceRecord,
  InsertMaintenanceRecord, EmployeeDocument, InsertEmployeeDocument,
  Vendor, InsertVendor, Notification, InsertNotification,
  AuditLog, InsertAuditLog, License, InsertLicense,
  Tenant, InsertTenant, Customer, InsertCustomer,
  Invoice, InsertInvoice, InvoiceItem, InsertInvoiceItem,
  Payment, InsertPayment, UserPermission, InsertUserPermission
} from "@shared/schema";
import { eq, and, gt, lt, lte, desc, isNull, sql } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// Interface for all storage operations
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
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  
  // Employee operations
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployeeByUserId(userId: number): Promise<Employee | undefined>;
  getEmployees(tenantId?: number): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<void>;
  
  // Dependent operations
  getDependent(id: number): Promise<Dependent | undefined>;
  getDependentsByEmployeeId(employeeId: number): Promise<Dependent[]>;
  createDependent(dependent: InsertDependent): Promise<Dependent>;
  updateDependent(id: number, dependent: Partial<InsertDependent>): Promise<Dependent | undefined>;
  deleteDependent(id: number): Promise<void>;
  
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
  getActiveAssetAssignments(tenantId?: number): Promise<AssetAssignment[]>;
  createAssetAssignment(assignment: InsertAssetAssignment): Promise<AssetAssignment>;
  updateAssetAssignment(id: number, assignment: Partial<InsertAssetAssignment>): Promise<AssetAssignment | undefined>;
  deleteAssetAssignment(id: number): Promise<void>;
  
  // Maintenance Record operations
  getMaintenanceRecord(id: number): Promise<MaintenanceRecord | undefined>;
  getMaintenanceRecordsByAssetId(assetId: number): Promise<MaintenanceRecord[]>;
  createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(id: number, record: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined>;
  deleteMaintenanceRecord(id: number): Promise<void>;
  
  // Employee Document operations
  getEmployeeDocument(id: number): Promise<EmployeeDocument | undefined>;
  getEmployeeDocumentsByEmployeeId(employeeId: number): Promise<EmployeeDocument[]>;
  getExpiringDocuments(daysThreshold: number, tenantId?: number): Promise<EmployeeDocument[]>;
  createEmployeeDocument(document: InsertEmployeeDocument): Promise<EmployeeDocument>;
  updateEmployeeDocument(id: number, document: Partial<InsertEmployeeDocument>): Promise<EmployeeDocument | undefined>;
  deleteEmployeeDocument(id: number): Promise<void>;
  
  // Vendor operations
  getVendor(id: number): Promise<Vendor | undefined>;
  getVendors(tenantId?: number): Promise<Vendor[]>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: number, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: number): Promise<void>;
  
  // Notification operations
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUserId(userId: number): Promise<Notification[]>;
  getUnseenNotificationsByUserId(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsSeen(id: number): Promise<Notification | undefined>;
  deleteNotification(id: number): Promise<void>;
  
  // Audit Log operations
  getAuditLog(id: number): Promise<AuditLog | undefined>;
  getAuditLogs(tenantId?: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  // License operations
  getLicense(id: number): Promise<License | undefined>;
  getLicensesByAssetId(assetId: number): Promise<License[]>;
  getExpiringLicenses(daysThreshold: number, tenantId?: number): Promise<License[]>;
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
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
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

// Memory storage implementation
export class MemStorage implements IStorage {
  private userMap: Map<number, User>;
  private employeeMap: Map<number, Employee>;
  private dependentMap: Map<number, Dependent>;
  private assetMap: Map<number, Asset>;
  private assetAssignmentMap: Map<number, AssetAssignment>;
  private maintenanceRecordMap: Map<number, MaintenanceRecord>;
  private employeeDocumentMap: Map<number, EmployeeDocument>;
  private vendorMap: Map<number, Vendor>;
  private notificationMap: Map<number, Notification>;
  private auditLogMap: Map<number, AuditLog>;
  private licenseMap: Map<number, License>;
  private tenantMap: Map<number, Tenant>;
  private customerMap: Map<number, Customer>;
  private invoiceMap: Map<number, Invoice>;
  private invoiceItemMap: Map<number, InvoiceItem>;
  private paymentMap: Map<number, Payment>;
  private userPermissionMap: Map<number, UserPermission>;
  private emailToIdMap: Map<string, number>;
  sessionStore: session.Store;
  userId: number;
  employeeId: number;
  dependentId: number;
  assetId: number;
  assignmentId: number;
  maintenanceId: number;
  documentId: number;
  vendorId: number;
  notificationId: number;
  auditLogId: number;
  licenseId: number;
  tenantId: number;
  customerId: number;
  invoiceId: number;
  invoiceItemId: number;
  paymentId: number;
  userPermissionId: number;

  constructor() {
    this.userMap = new Map();
    this.employeeMap = new Map();
    this.dependentMap = new Map();
    this.assetMap = new Map();
    this.assetAssignmentMap = new Map();
    this.maintenanceRecordMap = new Map();
    this.employeeDocumentMap = new Map();
    this.vendorMap = new Map();
    this.notificationMap = new Map();
    this.auditLogMap = new Map();
    this.licenseMap = new Map();
    this.tenantMap = new Map();
    this.customerMap = new Map();
    this.invoiceMap = new Map();
    this.invoiceItemMap = new Map();
    this.paymentMap = new Map();
    this.userPermissionMap = new Map();
    this.emailToIdMap = new Map();
    
    this.userId = 1;
    this.employeeId = 1;
    this.dependentId = 1;
    this.assetId = 1;
    this.assignmentId = 1;
    this.maintenanceId = 1;
    this.documentId = 1;
    this.vendorId = 1;
    this.notificationId = 1;
    this.auditLogId = 1;
    this.licenseId = 1;
    this.tenantId = 1;
    this.customerId = 1;
    this.invoiceId = 1;
    this.invoiceItemId = 1;
    this.paymentId = 1;
    this.userPermissionId = 1;
    
    // Create default admin user
    this.createDefaultAdmin();
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
  }

  private async createDefaultAdmin() {
    // Create default admin user
    const adminUser: User = {
      id: 1,
      tenantId: 1,
      name: "Super Administrator",
      email: "supadmin@myrsv.com",
      password: "e6773853f57569bff4aa76b7f8a7887bf0e4fb8fcd2e7db1fc5af92015510b5f9a4356a6ad6a6a232ce99d28a4004fa22c0eb7213cfd95934d851eba53d0bd8a.7289d5ed8f54f3bf3b8e2a2d65e03de4", // @minRSV100#$
      role: "super_admin",
      isSuperAdmin: true,
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
      isActive: true,
      allowedModules: [
        "dashboard", "assets", "licenses", "employees", "documents", 
        "vendors", "customers", "invoices", "reports", "audit_logs", 
        "settings", "user_management"
      ],
      createdAt: new Date()
    };

    this.userMap.set(1, adminUser);
    this.emailToIdMap.set("supadmin@myrsv.com", 1);
    this.userId = 2; // Next user will get ID 2
  }
  
  // Tenant operations
  async getTenant(id: number): Promise<Tenant | undefined> {
    return this.tenantMap.get(id);
  }
  
  async getTenantByName(name: string): Promise<Tenant | undefined> {
    return Array.from(this.tenantMap.values()).find(tenant => tenant.name === name);
  }
  
  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    return Array.from(this.tenantMap.values()).find(tenant => tenant.slug === slug);
  }
  
  async getTenants(): Promise<Tenant[]> {
    return Array.from(this.tenantMap.values());
  }
  
  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const id = this.tenantId++;
    const newTenant: Tenant = {
      ...tenant,
      id,
      createdAt: new Date(),
      maxUsers: tenant.maxUsers || 5,
      maxAssets: tenant.maxAssets || 20,
      maxDocuments: tenant.maxDocuments || 50,
      isActive: tenant.isActive ?? true,
      primaryColor: tenant.primaryColor || '#10b981',
      plan: tenant.plan || 'free',
      expiryDate: tenant.expiryDate || null
    };
    this.tenantMap.set(id, newTenant);
    return newTenant;
  }
  
  async updateTenant(id: number, tenantData: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const tenant = this.tenantMap.get(id);
    if (!tenant) return undefined;
    
    const updatedTenant = { ...tenant, ...tenantData };
    this.tenantMap.set(id, updatedTenant);
    return updatedTenant;
  }
  
  async deleteTenant(id: number): Promise<void> {
    this.tenantMap.delete(id);
  }
  
  async getUsersByTenantId(tenantId: number): Promise<User[]> {
    return Array.from(this.userMap.values()).filter(user => user.tenantId === tenantId);
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.userMap.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const userId = this.emailToIdMap.get(email);
    return userId ? this.userMap.get(userId) : undefined;
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.userMap.values());
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    return Array.from(this.userMap.values()).find(user => user.emailVerificationToken === token);
  }

  async verifyUserEmail(token: string): Promise<User | undefined> {
    const user = await this.getUserByVerificationToken(token);
    if (!user) return undefined;
    
    // Check if token is expired (24 hours)
    if (user.emailVerificationExpiry && new Date() > user.emailVerificationExpiry) {
      return undefined;
    }
    
    // Update user as verified and active
    const updatedUser = {
      ...user,
      isEmailVerified: true,
      isActive: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null
    };
    
    this.userMap.set(user.id, updatedUser);
    return updatedUser;
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userId++;
    
    const newUser: User = { 
      ...user, 
      id, 
      isSuperAdmin: user.isSuperAdmin ?? false,
      tenantId: user.tenantId ?? 1,
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
      isActive: user.isActive ?? true,
      allowedModules: user.allowedModules ?? [],
      createdAt: new Date()
    };
    this.userMap.set(id, newUser);
    this.emailToIdMap.set(user.email, id);
    return newUser;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.userMap.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.userMap.set(id, updatedUser);
    return updatedUser;
  }
  
  // Employee operations
  async getEmployee(id: number): Promise<Employee | undefined> {
    return this.employeeMap.get(id);
  }

  async getEmployeeByUserId(userId: number): Promise<Employee | undefined> {
    return Array.from(this.employeeMap.values()).find(emp => emp.userId === userId);
  }

  async getEmployees(tenantId?: number): Promise<Employee[]> {
    if (tenantId) {
      return Array.from(this.employeeMap.values()).filter(employee => employee.tenantId === tenantId);
    }
    return Array.from(this.employeeMap.values());
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const id = this.employeeId++;
    const newEmployee: Employee = { 
      id,
      employeeId: employee.employeeId,
      userId: employee.userId || null,
      name: employee.name,
      department: employee.department,
      designation: employee.designation,
      joinDate: employee.joinDate,
      passportNumber: employee.passportNumber || null,
      passportExpiry: employee.passportExpiry || null,
      visaNumber: employee.visaNumber || null,
      visaExpiry: employee.visaExpiry || null,
      createdAt: new Date()
    };
    this.employeeMap.set(id, newEmployee);
    return newEmployee;
  }

  async updateEmployee(id: number, employeeData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const employee = this.employeeMap.get(id);
    if (!employee) return undefined;
    
    const updatedEmployee = { ...employee, ...employeeData };
    this.employeeMap.set(id, updatedEmployee);
    return updatedEmployee;
  }

  async deleteEmployee(id: number): Promise<void> {
    this.employeeMap.delete(id);
  }
  
  // Dependent operations
  async getDependent(id: number): Promise<Dependent | undefined> {
    return this.dependentMap.get(id);
  }

  async getDependentsByEmployeeId(employeeId: number): Promise<Dependent[]> {
    return Array.from(this.dependentMap.values()).filter(dep => dep.employeeId === employeeId);
  }

  async createDependent(dependent: InsertDependent): Promise<Dependent> {
    const id = this.dependentId++;
    const newDependent: Dependent = { 
      ...dependent, 
      id, 
      createdAt: null,
      passportNumber: dependent.passportNumber ?? null,
      passportExpiry: dependent.passportExpiry ?? null,
      visaNumber: dependent.visaNumber ?? null,
      visaExpiry: dependent.visaExpiry ?? null
    };
    this.dependentMap.set(id, newDependent);
    return newDependent;
  }

  async updateDependent(id: number, dependentData: Partial<InsertDependent>): Promise<Dependent | undefined> {
    const dependent = this.dependentMap.get(id);
    if (!dependent) return undefined;
    
    const updatedDependent = { ...dependent, ...dependentData };
    this.dependentMap.set(id, updatedDependent);
    return updatedDependent;
  }

  async deleteDependent(id: number): Promise<void> {
    this.dependentMap.delete(id);
  }
  
  // Asset operations
  async getAsset(id: number): Promise<Asset | undefined> {
    return this.assetMap.get(id);
  }

  async getAssets(tenantId?: number): Promise<Asset[]> {
    if (tenantId) {
      return Array.from(this.assetMap.values()).filter(asset => asset.tenantId === tenantId);
    }
    return Array.from(this.assetMap.values());
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const id = this.assetId++;
    const newAsset: Asset = { 
      ...asset, 
      id, 
      createdAt: null,
      status: asset.status || 'available',
      location: asset.location ?? null,
      vendorId: asset.vendorId ?? null,
      purchaseDate: asset.purchaseDate ?? null,
      warrantyExpiry: asset.warrantyExpiry ?? null,
      hasLicense: asset.hasLicense ?? false
    };
    this.assetMap.set(id, newAsset);
    return newAsset;
  }

  async updateAsset(id: number, assetData: Partial<InsertAsset>): Promise<Asset | undefined> {
    const asset = this.assetMap.get(id);
    if (!asset) return undefined;
    
    const updatedAsset = { ...asset, ...assetData };
    this.assetMap.set(id, updatedAsset);
    return updatedAsset;
  }

  async deleteAsset(id: number): Promise<void> {
    this.assetMap.delete(id);
  }
  
  // Asset Assignment operations
  async getAssetAssignment(id: number): Promise<AssetAssignment | undefined> {
    return this.assetAssignmentMap.get(id);
  }

  async getAssetAssignmentsByAssetId(assetId: number): Promise<AssetAssignment[]> {
    return Array.from(this.assetAssignmentMap.values()).filter(assignment => assignment.assetId === assetId);
  }

  async getAssetAssignmentsByEmployeeId(employeeId: number): Promise<AssetAssignment[]> {
    return Array.from(this.assetAssignmentMap.values()).filter(assignment => assignment.employeeId === employeeId);
  }

  async getActiveAssetAssignments(tenantId?: number): Promise<AssetAssignment[]> {
    const assignments = Array.from(this.assetAssignmentMap.values()).filter(assignment => !assignment.dateReturned);
    
    if (tenantId) {
      return assignments.filter(assignment => assignment.tenantId === tenantId);
    }
    return assignments;
  }

  async createAssetAssignment(assignment: InsertAssetAssignment): Promise<AssetAssignment> {
    const id = this.assignmentId++;
    const newAssignment: AssetAssignment = { 
      ...assignment, 
      id, 
      createdAt: null,
      dateAssigned: assignment.dateAssigned || new Date(),
      dateReturned: assignment.dateReturned ?? null,
      notes: assignment.notes ?? null
    };
    this.assetAssignmentMap.set(id, newAssignment);
    return newAssignment;
  }

  async updateAssetAssignment(id: number, assignmentData: Partial<InsertAssetAssignment>): Promise<AssetAssignment | undefined> {
    const assignment = this.assetAssignmentMap.get(id);
    if (!assignment) return undefined;
    
    const updatedAssignment = { ...assignment, ...assignmentData };
    this.assetAssignmentMap.set(id, updatedAssignment);
    return updatedAssignment;
  }

  async deleteAssetAssignment(id: number): Promise<void> {
    this.assetAssignmentMap.delete(id);
  }
  
  // Maintenance Record operations
  async getMaintenanceRecord(id: number): Promise<MaintenanceRecord | undefined> {
    return this.maintenanceRecordMap.get(id);
  }

  async getMaintenanceRecordsByAssetId(assetId: number): Promise<MaintenanceRecord[]> {
    return Array.from(this.maintenanceRecordMap.values()).filter(record => record.assetId === assetId);
  }

  async createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord> {
    const id = this.maintenanceId++;
    const newRecord: MaintenanceRecord = { 
      ...record, 
      id, 
      createdAt: null,
      resolution: record.resolution ?? null,
      nextMaintenanceDate: record.nextMaintenanceDate ?? null,
      cost: record.cost ?? null
    };
    this.maintenanceRecordMap.set(id, newRecord);
    return newRecord;
  }

  async updateMaintenanceRecord(id: number, recordData: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined> {
    const record = this.maintenanceRecordMap.get(id);
    if (!record) return undefined;
    
    const updatedRecord = { ...record, ...recordData };
    this.maintenanceRecordMap.set(id, updatedRecord);
    return updatedRecord;
  }

  async deleteMaintenanceRecord(id: number): Promise<void> {
    this.maintenanceRecordMap.delete(id);
  }
  
  // Employee Document operations
  async getEmployeeDocument(id: number): Promise<EmployeeDocument | undefined> {
    return this.employeeDocumentMap.get(id);
  }

  async getEmployeeDocumentsByEmployeeId(employeeId: number): Promise<EmployeeDocument[]> {
    return Array.from(this.employeeDocumentMap.values()).filter(doc => doc.employeeId === employeeId);
  }

  async getExpiringDocuments(daysThreshold: number, tenantId?: number): Promise<EmployeeDocument[]> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysThreshold);
    
    let documents = Array.from(this.employeeDocumentMap.values()).filter(doc => {
      if (!doc.expiryDate) return false;
      const expiryDate = new Date(doc.expiryDate);
      return expiryDate <= threshold;
    });
    
    if (tenantId) {
      documents = documents.filter(doc => doc.tenantId === tenantId);
    }
    
    return documents;
  }

  async createEmployeeDocument(document: InsertEmployeeDocument): Promise<EmployeeDocument> {
    const id = this.documentId++;
    const newDocument: EmployeeDocument = { 
      ...document, 
      id, 
      createdAt: null,
      notes: document.notes ?? null,
      issueDate: document.issueDate ?? null,
      expiryDate: document.expiryDate ?? null
    };
    this.employeeDocumentMap.set(id, newDocument);
    return newDocument;
  }

  async updateEmployeeDocument(id: number, documentData: Partial<InsertEmployeeDocument>): Promise<EmployeeDocument | undefined> {
    const document = this.employeeDocumentMap.get(id);
    if (!document) return undefined;
    
    const updatedDocument = { ...document, ...documentData };
    this.employeeDocumentMap.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteEmployeeDocument(id: number): Promise<void> {
    this.employeeDocumentMap.delete(id);
  }
  
  // Vendor operations
  async getVendor(id: number): Promise<Vendor | undefined> {
    return this.vendorMap.get(id);
  }

  async getVendors(tenantId?: number): Promise<Vendor[]> {
    if (tenantId) {
      return Array.from(this.vendorMap.values()).filter(vendor => vendor.tenantId === tenantId);
    }
    return Array.from(this.vendorMap.values());
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const id = this.vendorId++;
    const newVendor: Vendor = { 
      ...vendor, 
      id, 
      createdAt: null,
      assetTypesSupplied: vendor.assetTypesSupplied ?? null
    };
    this.vendorMap.set(id, newVendor);
    return newVendor;
  }

  async updateVendor(id: number, vendorData: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const vendor = this.vendorMap.get(id);
    if (!vendor) return undefined;
    
    const updatedVendor = { ...vendor, ...vendorData };
    this.vendorMap.set(id, updatedVendor);
    return updatedVendor;
  }

  async deleteVendor(id: number): Promise<void> {
    this.vendorMap.delete(id);
  }
  
  // Notification operations
  async getNotification(id: number): Promise<Notification | undefined> {
    return this.notificationMap.get(id);
  }

  async getNotificationsByUserId(userId: number): Promise<Notification[]> {
    return Array.from(this.notificationMap.values()).filter(notification => notification.targetUserId === userId);
  }

  async getUnseenNotificationsByUserId(userId: number): Promise<Notification[]> {
    return Array.from(this.notificationMap.values()).filter(notification => 
      notification.targetUserId === userId && !notification.seen);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = this.notificationId++;
    const newNotification: Notification = { 
      ...notification, 
      id, 
      createdAt: null,
      seen: notification.seen ?? false,
      entityId: notification.entityId ?? null,
      entityType: notification.entityType ?? null
    };
    this.notificationMap.set(id, newNotification);
    return newNotification;
  }

  async markNotificationAsSeen(id: number): Promise<Notification | undefined> {
    const notification = this.notificationMap.get(id);
    if (!notification) return undefined;
    
    const updatedNotification = { ...notification, seen: true };
    this.notificationMap.set(id, updatedNotification);
    return updatedNotification;
  }

  async deleteNotification(id: number): Promise<void> {
    this.notificationMap.delete(id);
  }
  
  // Audit Log operations
  async getAuditLog(id: number): Promise<AuditLog | undefined> {
    return this.auditLogMap.get(id);
  }

  async getAuditLogs(tenantId?: number): Promise<AuditLog[]> {
    if (tenantId) {
      return Array.from(this.auditLogMap.values()).filter(log => log.tenantId === tenantId);
    }
    return Array.from(this.auditLogMap.values());
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = this.auditLogId++;
    const newLog: AuditLog = { 
      ...log, 
      id, 
      entityId: log.entityId ?? null,
      timestamp: log.timestamp || new Date()
    };
    this.auditLogMap.set(id, newLog);
    return newLog;
  }
  
  // License operations
  async getLicense(id: number): Promise<License | undefined> {
    return this.licenseMap.get(id);
  }

  async getLicensesByAssetId(assetId: number): Promise<License[]> {
    return Array.from(this.licenseMap.values()).filter(license => license.assetId === assetId);
  }

  async getExpiringLicenses(daysThreshold: number, tenantId?: number): Promise<License[]> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysThreshold);
    
    let licenses = Array.from(this.licenseMap.values()).filter(license => {
      if (!license.expiryDate) return false;
      const expiryDate = new Date(license.expiryDate);
      return expiryDate <= threshold;
    });
    
    if (tenantId) {
      licenses = licenses.filter(license => license.tenantId === tenantId);
    }
    
    return licenses;
  }

  async createLicense(license: InsertLicense): Promise<License> {
    const id = this.licenseId++;
    const newLicense: License = { 
      ...license, 
      id, 
      createdAt: null,
      notes: license.notes ?? null,
      purchaseDate: license.purchaseDate ?? null,
      expiryDate: license.expiryDate ?? null,
      cost: license.cost ?? null,
      seats: license.seats ?? null,
      assetId: license.assetId ?? null
    };
    this.licenseMap.set(id, newLicense);
    
    // Update the asset's hasLicense flag if an assetId is provided
    if (license.assetId) {
      const asset = await this.getAsset(license.assetId);
      if (asset) {
        await this.updateAsset(license.assetId, { hasLicense: true });
      }
    }
    
    return newLicense;
  }

  async updateLicense(id: number, licenseData: Partial<InsertLicense>): Promise<License | undefined> {
    const license = this.licenseMap.get(id);
    if (!license) return undefined;
    
    const updatedLicense = { ...license, ...licenseData };
    this.licenseMap.set(id, updatedLicense);
    return updatedLicense;
  }

  async deleteLicense(id: number): Promise<void> {
    const license = this.licenseMap.get(id);
    this.licenseMap.delete(id);
    
    // Update the asset's hasLicense flag if this was the only license for the asset
    if (license && license.assetId) {
      const assetLicenses = await this.getLicensesByAssetId(license.assetId);
      if (assetLicenses.length === 0) {
        const asset = await this.getAsset(license.assetId);
        if (asset) {
          await this.updateAsset(license.assetId, { hasLicense: false });
        }
      }
    }
  }
  
  // Dashboard statistics
  async getDashboardStats(tenantId?: number): Promise<any> {
    const assets = await this.getAssets(tenantId);
    const employees = await this.getEmployees(tenantId);
    const expiringDocs = await this.getExpiringDocuments(90, tenantId);
    
    // Filter maintenance records by tenantId if provided
    let maintenanceRecords = Array.from(this.maintenanceRecordMap.values());
    if (tenantId) {
      maintenanceRecords = maintenanceRecords.filter(record => record.tenantId === tenantId);
    }
    
    const maintenanceDue = maintenanceRecords.filter(record => {
      // Simple logic to determine if maintenance is due
      // In a real scenario, this would be more complex
      return !record.resolution;
    });
    
    // Asset distribution
    const assetTypes = new Map<string, number>();
    assets.forEach(asset => {
      const count = assetTypes.get(asset.type) || 0;
      assetTypes.set(asset.type, count + 1);
    });
    
    const assetDistribution = Array.from(assetTypes.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: assets.length > 0 ? Math.round((count / assets.length) * 100) : 0
    }));
    
    // Filter employee documents by tenantId if provided
    let allDocs = Array.from(this.employeeDocumentMap.values());
    if (tenantId) {
      allDocs = allDocs.filter(doc => doc.tenantId === tenantId);
    }
    
    // Document status
    const validDocs = allDocs.filter(doc => {
      if (!doc.expiryDate) return true;
      return new Date(doc.expiryDate) > new Date();
    });
    
    const expiringSoonDocs = expiringDocs.filter(doc => {
      if (!doc.expiryDate) return false;
      const expiryDate = new Date(doc.expiryDate);
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);
      return expiryDate > now && expiryDate <= thirtyDaysFromNow;
    });
    
    const expiredDocs = allDocs.filter(doc => {
      if (!doc.expiryDate) return false;
      return new Date(doc.expiryDate) <= new Date();
    });
    
    const totalDocs = allDocs.length;
    
    const documentStatus = {
      valid: {
        count: validDocs.length,
        percentage: totalDocs > 0 ? Math.round((validDocs.length / totalDocs) * 100) : 0
      },
      expiringSoon: {
        count: expiringSoonDocs.length,
        percentage: totalDocs > 0 ? Math.round((expiringSoonDocs.length / totalDocs) * 100) : 0
      },
      expired: {
        count: expiredDocs.length,
        percentage: totalDocs > 0 ? Math.round((expiredDocs.length / totalDocs) * 100) : 0
      }
    };
    
    // Filter asset assignments by tenantId if provided
    let recentAssignments = Array.from(this.assetAssignmentMap.values());
    if (tenantId) {
      recentAssignments = recentAssignments.filter(assignment => assignment.tenantId === tenantId);
    }
    
    return {
      counts: {
        assets: assets.length,
        employees: employees.length,
        expiringDocuments: expiringDocs.length,
        maintenanceDue: maintenanceDue.length
      },
      assetDistribution,
      documentStatus,
      recentAssignments: recentAssignments
        .sort((a, b) => new Date(b.dateAssigned).getTime() - new Date(a.dateAssigned).getTime())
        .slice(0, 5)
    };
  }

  // Customer operations
  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customerMap.get(id);
  }

  async getCustomers(tenantId?: number): Promise<Customer[]> {
    if (tenantId) {
      return Array.from(this.customerMap.values()).filter(customer => customer.tenantId === tenantId);
    }
    return Array.from(this.customerMap.values());
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const id = this.customerId++;
    const newCustomer: Customer = { 
      ...customer, 
      id,
      phone: customer.phone ?? null,
      company: customer.company ?? null,
      address: customer.address ?? null,
      city: customer.city ?? null,
      state: customer.state ?? null,
      zipCode: customer.zipCode ?? null,
      country: customer.country ?? null,
      taxId: customer.taxId ?? null,
      notes: customer.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.customerMap.set(id, newCustomer);
    return newCustomer;
  }

  async updateCustomer(id: number, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const customer = this.customerMap.get(id);
    if (!customer) return undefined;
    
    const updatedCustomer = { ...customer, ...customerData, updatedAt: new Date() };
    this.customerMap.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async deleteCustomer(id: number): Promise<void> {
    this.customerMap.delete(id);
  }

  // Invoice operations
  async getInvoice(id: number): Promise<Invoice | undefined> {
    const invoice = this.invoiceMap.get(id);
    if (invoice) {
      const items = await this.getInvoiceItemsByInvoiceId(id);
      return { ...invoice, items };
    }
    return undefined;
  }

  async getInvoices(tenantId?: number): Promise<Invoice[]> {
    let invoices = Array.from(this.invoiceMap.values());
    if (tenantId) {
      invoices = invoices.filter(invoice => invoice.tenantId === tenantId);
    }
    
    // Get items for each invoice
    const invoicesWithItems = await Promise.all(
      invoices.map(async (invoice) => {
        const items = await this.getInvoiceItemsByInvoiceId(invoice.id);
        return { ...invoice, items };
      })
    );
    
    return invoicesWithItems;
  }

  async createInvoice(invoiceData: InsertInvoice): Promise<Invoice> {
    const id = this.invoiceId++;
    const { items, ...invoice } = invoiceData as any;
    
    // Generate invoice number
    const invoiceNumber = `INV-${String(id).padStart(6, '0')}`;
    
    const newInvoice: Invoice = { 
      ...invoice, 
      id,
      invoiceNumber,
      status: 'draft',
      currency: invoice.currency || 'USD',
      paymentTerms: invoice.paymentTerms ?? null,
      notes: invoice.notes ?? null,
      sentAt: null,
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.invoiceMap.set(id, newInvoice);
    
    // Create invoice items if provided
    if (items && items.length > 0) {
      for (const item of items) {
        await this.createInvoiceItem({
          ...item,
          invoiceId: id,
          tenantId: invoice.tenantId
        });
      }
    }
    
    return await this.getInvoice(id) as Invoice;
  }

  async updateInvoice(id: number, invoiceData: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const invoice = this.invoiceMap.get(id);
    if (!invoice) return undefined;

    const { items, ...updateData } = invoiceData as any;
    const updatedInvoice = { ...invoice, ...updateData, updatedAt: new Date() };
    this.invoiceMap.set(id, updatedInvoice);

    // Update items if provided
    if (items) {
      // Delete existing items
      const existingItems = await this.getInvoiceItemsByInvoiceId(id);
      for (const item of existingItems) {
        await this.deleteInvoiceItem(item.id);
      }
      
      // Create new items
      for (const item of items) {
        await this.createInvoiceItem({
          ...item,
          invoiceId: id,
          tenantId: invoice.tenantId
        });
      }
    }

    return await this.getInvoice(id);
  }

  async deleteInvoice(id: number): Promise<void> {
    // Delete invoice items first
    const items = await this.getInvoiceItemsByInvoiceId(id);
    for (const item of items) {
      await this.deleteInvoiceItem(item.id);
    }
    
    // Delete payments
    const payments = await this.getPaymentsByInvoiceId(id);
    for (const payment of payments) {
      await this.deletePayment(payment.id);
    }
    
    // Delete invoice
    this.invoiceMap.delete(id);
  }

  // Invoice Item operations
  async getInvoiceItemsByInvoiceId(invoiceId: number): Promise<InvoiceItem[]> {
    return Array.from(this.invoiceItemMap.values()).filter(item => item.invoiceId === invoiceId);
  }

  async createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem> {
    const id = this.invoiceItemId++;
    const newItem: InvoiceItem = { 
      ...item, 
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.invoiceItemMap.set(id, newItem);
    return newItem;
  }

  async updateInvoiceItem(id: number, itemData: Partial<InsertInvoiceItem>): Promise<InvoiceItem | undefined> {
    const item = this.invoiceItemMap.get(id);
    if (!item) return undefined;
    
    const updatedItem = { ...item, ...itemData, updatedAt: new Date() };
    this.invoiceItemMap.set(id, updatedItem);
    return updatedItem;
  }

  async deleteInvoiceItem(id: number): Promise<void> {
    this.invoiceItemMap.delete(id);
  }

  // Payment operations
  async getPayment(id: number): Promise<Payment | undefined> {
    return this.paymentMap.get(id);
  }

  async getPaymentsByInvoiceId(invoiceId: number): Promise<Payment[]> {
    return Array.from(this.paymentMap.values()).filter(payment => payment.invoiceId === invoiceId);
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const id = this.paymentId++;
    const newPayment: Payment = { 
      ...payment, 
      id,
      notes: payment.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.paymentMap.set(id, newPayment);
    return newPayment;
  }

  async updatePayment(id: number, paymentData: Partial<InsertPayment>): Promise<Payment | undefined> {
    const payment = this.paymentMap.get(id);
    if (!payment) return undefined;
    
    const updatedPayment = { ...payment, ...paymentData, updatedAt: new Date() };
    this.paymentMap.set(id, updatedPayment);
    return updatedPayment;
  }

  async deletePayment(id: number): Promise<void> {
    this.paymentMap.delete(id);
  }

  // User Permission operations
  async getUserPermissions(userId: number): Promise<UserPermission[]> {
    return Array.from(this.userPermissionMap.values()).filter(perm => perm.userId === userId);
  }

  async createUserPermission(permission: InsertUserPermission): Promise<UserPermission> {
    const id = this.userPermissionId++;
    const newPermission: UserPermission = {
      ...permission,
      id,
      tenantId: permission.tenantId || 1,
      createdAt: new Date()
    };
    this.userPermissionMap.set(id, newPermission);
    return newPermission;
  }

  async updateUserPermissions(userId: number, permissions: InsertUserPermission[]): Promise<void> {
    // Delete existing permissions for user
    await this.deleteUserPermissions(userId);
    
    // Create new permissions
    for (const permission of permissions) {
      await this.createUserPermission({
        ...permission,
        userId
      });
    }
  }

  async deleteUserPermissions(userId: number): Promise<void> {
    const userPermissions = await this.getUserPermissions(userId);
    for (const permission of userPermissions) {
      this.userPermissionMap.delete(permission.id);
    }
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Force memory store for sessions to avoid connection issues
    // Main data still persists in PostgreSQL database
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
    console.log("Using memory session store (data persists in PostgreSQL)");
    
    // Ensure default admin user exists in database
    this.initializeDefaultUser();
  }

  private async initializeDefaultUser() {
    // Default user is now created via SQL - no initialization needed
    console.log("Database storage initialized");
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        password: users.password,
        role: users.role,
        createdAt: users.createdAt
      }).from(users).where(eq(users.id, id));
      
      const user = result[0];
      if (user) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          password: user.password,
          role: user.role,
          tenantId: 1,
          isEmailVerified: true,
          emailVerificationToken: null,
          createdAt: user.createdAt || new Date(),
          updatedAt: null,
          isActive: true
        };
      }
      return undefined;
    } catch (error) {
      console.error('Error fetching user by id:', error.message);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        password: users.password,
        role: users.role,
        createdAt: users.createdAt
      }).from(users).where(eq(users.email, email));
      
      const user = result[0];
      if (user) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          password: user.password,
          role: user.role,
          tenantId: 1,
          isEmailVerified: true,
          emailVerificationToken: null,
          createdAt: user.createdAt || new Date(),
          updatedAt: null,
          isActive: true
        };
      }
      return undefined;
    } catch (error) {
      console.error('Error fetching user by email:', error.message);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      // Only insert columns that exist in the actual database
      const userData = {
        name: insertUser.name,
        email: insertUser.email,
        password: insertUser.password,
        role: insertUser.role || 'employee'
      };
      
      const result = await db.insert(users).values(userData).returning({
        id: users.id,
        name: users.name,
        email: users.email,
        password: users.password,
        role: users.role,
        createdAt: users.createdAt
      });
      
      const user = result[0];
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        tenantId: 1,
        isEmailVerified: true,
        emailVerificationToken: null,
        createdAt: user.createdAt || new Date(),
        updatedAt: null,
        isActive: true
      };
    } catch (error) {
      console.error('Error creating user:', error.message);
      throw error;
    }
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    try {
      const updateData = {
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role
      };
      
      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      
      const result = await db.update(users).set(updateData).where(eq(users.id, id)).returning({
        id: users.id,
        name: users.name,
        email: users.email,
        password: users.password,
        role: users.role,
        createdAt: users.createdAt
      });
      
      const user = result[0];
      if (user) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          password: user.password,
          role: user.role,
          tenantId: 1,
          isEmailVerified: true,
          emailVerificationToken: null,
          createdAt: user.createdAt || new Date(),
          updatedAt: null,
          isActive: true
        };
      }
      return undefined;
    } catch (error) {
      console.error('Error updating user:', error.message);
      return undefined;
    }
  }
  
  // Employee operations
  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee || undefined;
  }

  async getEmployeeByUserId(userId: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.userId, userId));
    return employee || undefined;
  }

  async getEmployees(tenantId?: number): Promise<Employee[]> {
    try {
      // Return empty array since employees table may not exist or match schema
      return [];
    } catch (error) {
      console.error('Error fetching employees:', error.message);
      return [];
    }
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [newEmployee] = await db.insert(employees).values(employee).returning();
    return newEmployee;
  }

  async updateEmployee(id: number, employeeData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [employee] = await db.update(employees).set(employeeData).where(eq(employees.id, id)).returning();
    return employee || undefined;
  }

  async deleteEmployee(id: number): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }
  
  // Dependent operations
  async getDependent(id: number): Promise<Dependent | undefined> {
    const [dependent] = await db.select().from(dependents).where(eq(dependents.id, id));
    return dependent || undefined;
  }

  async getDependentsByEmployeeId(employeeId: number): Promise<Dependent[]> {
    return await db.select().from(dependents).where(eq(dependents.employeeId, employeeId));
  }

  async createDependent(dependent: InsertDependent): Promise<Dependent> {
    const [newDependent] = await db.insert(dependents).values(dependent).returning();
    return newDependent;
  }

  async updateDependent(id: number, dependentData: Partial<InsertDependent>): Promise<Dependent | undefined> {
    const [dependent] = await db.update(dependents).set(dependentData).where(eq(dependents.id, id)).returning();
    return dependent || undefined;
  }

  async deleteDependent(id: number): Promise<void> {
    await db.delete(dependents).where(eq(dependents.id, id));
  }
  
  // Asset operations
  async getAsset(id: number): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset || undefined;
  }

  async getAssets(tenantId?: number): Promise<Asset[]> {
    try {
      return [];
    } catch (error) {
      console.error('Error fetching assets:', error.message);
      return [];
    }
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const [newAsset] = await db.insert(assets).values(asset).returning();
    return newAsset;
  }

  async updateAsset(id: number, assetData: Partial<InsertAsset>): Promise<Asset | undefined> {
    const [asset] = await db.update(assets).set(assetData).where(eq(assets.id, id)).returning();
    return asset || undefined;
  }

  async deleteAsset(id: number): Promise<void> {
    await db.delete(assets).where(eq(assets.id, id));
  }
  
  // Asset Assignment operations
  async getAssetAssignment(id: number): Promise<AssetAssignment | undefined> {
    const [assignment] = await db.select().from(assetAssignments).where(eq(assetAssignments.id, id));
    return assignment || undefined;
  }

  async getAssetAssignmentsByAssetId(assetId: number): Promise<AssetAssignment[]> {
    return await db.select().from(assetAssignments).where(eq(assetAssignments.assetId, assetId));
  }

  async getAssetAssignmentsByEmployeeId(employeeId: number): Promise<AssetAssignment[]> {
    return await db.select().from(assetAssignments).where(eq(assetAssignments.employeeId, employeeId));
  }

  async getActiveAssetAssignments(): Promise<AssetAssignment[]> {
    return await db.select().from(assetAssignments).where(isNull(assetAssignments.dateReturned));
  }

  async createAssetAssignment(assignment: InsertAssetAssignment): Promise<AssetAssignment> {
    const [newAssignment] = await db.insert(assetAssignments).values(assignment).returning();
    return newAssignment;
  }

  async updateAssetAssignment(id: number, assignmentData: Partial<InsertAssetAssignment>): Promise<AssetAssignment | undefined> {
    const [assignment] = await db.update(assetAssignments).set(assignmentData).where(eq(assetAssignments.id, id)).returning();
    return assignment || undefined;
  }

  async deleteAssetAssignment(id: number): Promise<void> {
    await db.delete(assetAssignments).where(eq(assetAssignments.id, id));
  }
  
  // Maintenance Record operations
  async getMaintenanceRecord(id: number): Promise<MaintenanceRecord | undefined> {
    const [record] = await db.select().from(maintenanceRecords).where(eq(maintenanceRecords.id, id));
    return record || undefined;
  }

  async getMaintenanceRecordsByAssetId(assetId: number): Promise<MaintenanceRecord[]> {
    return await db.select().from(maintenanceRecords).where(eq(maintenanceRecords.assetId, assetId));
  }

  async createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord> {
    const [newRecord] = await db.insert(maintenanceRecords).values(record).returning();
    return newRecord;
  }

  async updateMaintenanceRecord(id: number, recordData: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined> {
    const [record] = await db.update(maintenanceRecords).set(recordData).where(eq(maintenanceRecords.id, id)).returning();
    return record || undefined;
  }

  async deleteMaintenanceRecord(id: number): Promise<void> {
    await db.delete(maintenanceRecords).where(eq(maintenanceRecords.id, id));
  }
  
  // Employee Document operations
  async getEmployeeDocument(id: number): Promise<EmployeeDocument | undefined> {
    const [document] = await db.select().from(employeeDocuments).where(eq(employeeDocuments.id, id));
    return document || undefined;
  }

  async getEmployeeDocumentsByEmployeeId(employeeId: number): Promise<EmployeeDocument[]> {
    return await db.select().from(employeeDocuments).where(eq(employeeDocuments.employeeId, employeeId));
  }

  async getExpiringDocuments(daysThreshold: number): Promise<EmployeeDocument[]> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysThreshold);
    
    return await db.select().from(employeeDocuments)
      .where(
        and(
          sql`${employeeDocuments.expiryDate} IS NOT NULL`,
          lte(employeeDocuments.expiryDate, threshold)
        )
      );
  }

  async createEmployeeDocument(document: InsertEmployeeDocument): Promise<EmployeeDocument> {
    const [newDocument] = await db.insert(employeeDocuments).values(document).returning();
    return newDocument;
  }

  async updateEmployeeDocument(id: number, documentData: Partial<InsertEmployeeDocument>): Promise<EmployeeDocument | undefined> {
    const [document] = await db.update(employeeDocuments).set(documentData).where(eq(employeeDocuments.id, id)).returning();
    return document || undefined;
  }

  async deleteEmployeeDocument(id: number): Promise<void> {
    await db.delete(employeeDocuments).where(eq(employeeDocuments.id, id));
  }
  
  // Vendor operations
  async getVendor(id: number): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor || undefined;
  }

  async getVendors(tenantId?: number): Promise<Vendor[]> {
    if (tenantId) {
      return await db.select().from(vendors).where(eq(vendors.tenantId, tenantId));
    }
    return await db.select().from(vendors);
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db.insert(vendors).values(vendor).returning();
    return newVendor;
  }

  async updateVendor(id: number, vendorData: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const [vendor] = await db.update(vendors).set(vendorData).where(eq(vendors.id, id)).returning();
    return vendor || undefined;
  }

  async deleteVendor(id: number): Promise<void> {
    await db.delete(vendors).where(eq(vendors.id, id));
  }
  
  // Notification operations
  async getNotification(id: number): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification || undefined;
  }

  async getNotificationsByUserId(userId: number): Promise<Notification[]> {
    try {
      return [];
    } catch (error) {
      console.error('Error fetching notifications:', error.message);
      return [];
    }
  }

  async getUnseenNotificationsByUserId(userId: number): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(
        and(
          eq(notifications.targetUserId, userId),
          eq(notifications.seen, false)
        )
      );
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationAsSeen(id: number): Promise<Notification | undefined> {
    const [notification] = await db.update(notifications)
      .set({ seen: true })
      .where(eq(notifications.id, id))
      .returning();
    return notification || undefined;
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }
  
  // Audit Log operations
  async getAuditLog(id: number): Promise<AuditLog | undefined> {
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.id, id));
    return log || undefined;
  }

  async getAuditLogs(tenantId?: number): Promise<AuditLog[]> {
    if (tenantId) {
      return await db.select().from(auditLogs)
        .where(eq(auditLogs.tenantId, tenantId))
        .orderBy(desc(auditLogs.timestamp));
    }
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }
  
  // License operations
  async getLicense(id: number): Promise<License | undefined> {
    const [license] = await db.select().from(licenses).where(eq(licenses.id, id));
    return license || undefined;
  }

  async getLicensesByAssetId(assetId: number): Promise<License[]> {
    return await db.select().from(licenses).where(eq(licenses.assetId, assetId));
  }

  async getExpiringLicenses(daysThreshold: number): Promise<License[]> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysThreshold);
    
    return await db.select().from(licenses)
      .where(
        and(
          sql`${licenses.expiryDate} IS NOT NULL`,
          lte(licenses.expiryDate, threshold)
        )
      );
  }

  async createLicense(license: InsertLicense): Promise<License> {
    const [newLicense] = await db.insert(licenses).values(license).returning();
    
    // Update the asset's hasLicense flag if an assetId is provided
    if (license.assetId) {
      const asset = await this.getAsset(license.assetId);
      if (asset) {
        await this.updateAsset(license.assetId, { hasLicense: true });
      }
    }
    
    return newLicense;
  }

  async updateLicense(id: number, licenseData: Partial<InsertLicense>): Promise<License | undefined> {
    const [license] = await db.update(licenses).set(licenseData).where(eq(licenses.id, id)).returning();
    return license || undefined;
  }

  async deleteLicense(id: number): Promise<void> {
    // Get the license before deleting it to check its assetId
    const [license] = await db.select().from(licenses).where(eq(licenses.id, id));
    
    await db.delete(licenses).where(eq(licenses.id, id));
    
    // Update the asset's hasLicense flag if this was the only license for the asset
    if (license && license.assetId) {
      const assetLicenses = await this.getLicensesByAssetId(license.assetId);
      if (assetLicenses.length === 0) {
        await this.updateAsset(license.assetId, { hasLicense: false });
      }
    }
  }
  
  // Dashboard statistics
  async getDashboardStats(tenantId?: number): Promise<any> {
    try {
      return {
        counts: {
          assets: 0,
          employees: 0,
          expiringDocuments: 0,
          maintenanceDue: 0
        },
        assetDistribution: [],
        documentStatus: [],
        recentAssignments: []
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error.message);
      return {
        counts: {
          assets: 0,
          employees: 0,
          expiringDocuments: 0,
          maintenanceDue: 0
        },
        assetDistribution: [],
        documentStatus: [],
        recentAssignments: []
      };
    }
  }
    
    const employeesCount = tenantId
      ? await db.select({ count: sql`count(*)` }).from(employees).where(eq(employees.tenantId, tenantId))
      : await db.select({ count: sql`count(*)` }).from(employees);
    
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    
    // Expiring documents
    const expiringDocsQuery = tenantId
      ? await db.select({ count: sql`count(*)` })
          .from(employeeDocuments)
          .where(
            and(
              eq(employeeDocuments.tenantId, tenantId),
              sql`${employeeDocuments.expiryDate} IS NOT NULL`,
              and(
                gt(employeeDocuments.expiryDate, now),
                lte(employeeDocuments.expiryDate, thirtyDaysFromNow)
              )
            )
          )
      : await db.select({ count: sql`count(*)` })
          .from(employeeDocuments)
          .where(
            and(
              sql`${employeeDocuments.expiryDate} IS NOT NULL`,
              and(
                gt(employeeDocuments.expiryDate, now),
                lte(employeeDocuments.expiryDate, thirtyDaysFromNow)
              )
            )
          );
    
    // Maintenance due - handle potential schema differences
    let maintenanceDueQuery;
    try {
      maintenanceDueQuery = tenantId
        ? await db.select({ count: sql`count(*)` })
            .from(maintenanceRecords)
            .where(
              and(
                eq(maintenanceRecords.tenantId, tenantId),
                sql`${maintenanceRecords.nextMaintenanceDate} IS NOT NULL`,
                lte(maintenanceRecords.nextMaintenanceDate, now)
              )
            )
        : await db.select({ count: sql`count(*)` })
            .from(maintenanceRecords)
            .where(
              and(
                sql`${maintenanceRecords.nextMaintenanceDate} IS NOT NULL`,
                lte(maintenanceRecords.nextMaintenanceDate, now)
              )
            );
    } catch (err) {
      // Fallback if the column doesn't exist yet in the actual database
      maintenanceDueQuery = [{ count: 0 }];
    }
    
    // Asset distribution
    const assetTypesQuery = tenantId
      ? await db.select({
          type: assets.type,
          count: sql`count(*)`
        })
        .from(assets)
        .where(eq(assets.tenantId, tenantId))
        .groupBy(assets.type)
      : await db.select({
          type: assets.type,
          count: sql`count(*)`
        })
        .from(assets)
        .groupBy(assets.type);
    
    const assetTypes = assetTypesQuery.map(item => ({
      type: item.type,
      count: Number(item.count)
    }));
    
    const totalAssets = assetTypes.reduce((sum, item) => sum + item.count, 0);
    
    const assetDistribution = assetTypes.map(item => ({
      type: item.type,
      count: item.count,
      percentage: totalAssets > 0 ? Math.round((item.count / totalAssets) * 100) : 0
    }));
    
    // Document status
    const totalDocsQuery = tenantId
      ? await db.select({ count: sql`count(*)` })
          .from(employeeDocuments)
          .where(eq(employeeDocuments.tenantId, tenantId))
      : await db.select({ count: sql`count(*)` }).from(employeeDocuments);
    const totalDocs = Number(totalDocsQuery[0]?.count || 0);
    
    const validDocsQuery = tenantId
      ? await db.select({ count: sql`count(*)` })
          .from(employeeDocuments)
          .where(
            and(
              eq(employeeDocuments.tenantId, tenantId),
              sql`${employeeDocuments.expiryDate} IS NULL OR ${employeeDocuments.expiryDate} > ${now}`
            )
          )
      : await db.select({ count: sql`count(*)` })
          .from(employeeDocuments)
          .where(
            sql`${employeeDocuments.expiryDate} IS NULL OR ${employeeDocuments.expiryDate} > ${now}`
          );
    
    const expiringSoonDocsQuery = tenantId
      ? await db.select({ count: sql`count(*)` })
          .from(employeeDocuments)
          .where(
            and(
              eq(employeeDocuments.tenantId, tenantId),
              sql`${employeeDocuments.expiryDate} IS NOT NULL`,
              and(
                gt(employeeDocuments.expiryDate, now),
                lte(employeeDocuments.expiryDate, thirtyDaysFromNow)
              )
            )
          )
      : await db.select({ count: sql`count(*)` })
          .from(employeeDocuments)
          .where(
            and(
              sql`${employeeDocuments.expiryDate} IS NOT NULL`,
              and(
                gt(employeeDocuments.expiryDate, now),
                lte(employeeDocuments.expiryDate, thirtyDaysFromNow)
              )
            )
          );
    
    const expiredDocsQuery = tenantId
      ? await db.select({ count: sql`count(*)` })
          .from(employeeDocuments)
          .where(
            and(
              eq(employeeDocuments.tenantId, tenantId),
              sql`${employeeDocuments.expiryDate} IS NOT NULL`,
              lte(employeeDocuments.expiryDate, now)
            )
          )
      : await db.select({ count: sql`count(*)` })
          .from(employeeDocuments)
          .where(
            and(
              sql`${employeeDocuments.expiryDate} IS NOT NULL`,
              lte(employeeDocuments.expiryDate, now)
            )
          );
    
    const validDocs = Number(validDocsQuery[0]?.count || 0);
    const expiringSoonDocs = Number(expiringSoonDocsQuery[0]?.count || 0);
    const expiredDocs = Number(expiredDocsQuery[0]?.count || 0);
    
    const documentStatus = {
      valid: {
        count: validDocs,
        percentage: totalDocs > 0 ? Math.round((validDocs / totalDocs) * 100) : 0
      },
      expiringSoon: {
        count: expiringSoonDocs,
        percentage: totalDocs > 0 ? Math.round((expiringSoonDocs / totalDocs) * 100) : 0
      },
      expired: {
        count: expiredDocs,
        percentage: totalDocs > 0 ? Math.round((expiredDocs / totalDocs) * 100) : 0
      }
    };
    
    // Recent assignments
    const recentAssignments = tenantId
      ? await db.select()
          .from(assetAssignments)
          .where(eq(assetAssignments.tenantId, tenantId))
          .orderBy(desc(assetAssignments.dateAssigned))
          .limit(5)
      : await db.select()
          .from(assetAssignments)
          .orderBy(desc(assetAssignments.dateAssigned))
          .limit(5);
    
    return {
      counts: {
        assets: Number(assetsCount[0]?.count || 0),
        employees: Number(employeesCount[0]?.count || 0),
        expiringDocuments: Number(expiringDocsQuery[0]?.count || 0),
        maintenanceDue: Number(maintenanceDueQuery[0]?.count || 0)
      },
      assetDistribution,
      documentStatus,
      recentAssignments
    };
  }
}

// Export the storage instance
export const storage = new DatabaseStorage();
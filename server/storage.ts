import { db } from "./db";
import {
  users, employees, dependents, assets, assetAssignments, 
  maintenanceRecords, employeeDocuments, vendors, notifications, 
  auditLogs, User, InsertUser, Employee, InsertEmployee,
  Dependent, InsertDependent, Asset, InsertAsset, 
  AssetAssignment, InsertAssetAssignment, MaintenanceRecord,
  InsertMaintenanceRecord, EmployeeDocument, InsertEmployeeDocument,
  Vendor, InsertVendor, Notification, InsertNotification,
  AuditLog, InsertAuditLog
} from "@shared/schema";
import { eq, and, gt, lt, lte, desc, isNull, sql } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import pg from "pg";
const { Pool } = pg;

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Interface for all storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  
  // Employee operations
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployeeByUserId(userId: number): Promise<Employee | undefined>;
  getEmployees(): Promise<Employee[]>;
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
  getAssets(): Promise<Asset[]>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: number, asset: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(id: number): Promise<void>;
  
  // Asset Assignment operations
  getAssetAssignment(id: number): Promise<AssetAssignment | undefined>;
  getAssetAssignmentsByAssetId(assetId: number): Promise<AssetAssignment[]>;
  getAssetAssignmentsByEmployeeId(employeeId: number): Promise<AssetAssignment[]>;
  getActiveAssetAssignments(): Promise<AssetAssignment[]>;
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
  getExpiringDocuments(daysThreshold: number): Promise<EmployeeDocument[]>;
  createEmployeeDocument(document: InsertEmployeeDocument): Promise<EmployeeDocument>;
  updateEmployeeDocument(id: number, document: Partial<InsertEmployeeDocument>): Promise<EmployeeDocument | undefined>;
  deleteEmployeeDocument(id: number): Promise<void>;
  
  // Vendor operations
  getVendor(id: number): Promise<Vendor | undefined>;
  getVendors(): Promise<Vendor[]>;
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
  getAuditLogs(): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  // Dashboard statistics
  getDashboardStats(): Promise<any>;
  
  // Session store
  sessionStore: any; // Use any type for sessionStore
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
  sessionStore: any; // Use any type for sessionStore
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
    this.sessionStore = new MemoryStore({ checkPeriod: 86400000 });
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
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.userMap.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.userMap.values()).find(user => user.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userId++;
    // Ensure role is not undefined
    const role = user.role || 'employee';
    const newUser = { ...user, id, role, createdAt: new Date() } as User;
    this.userMap.set(id, newUser);
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

  async getEmployees(): Promise<Employee[]> {
    return Array.from(this.employeeMap.values());
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const id = this.employeeId++;
    const newEmployee = { ...employee, id, createdAt: new Date() };
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
    const newDependent = { ...dependent, id, createdAt: new Date() };
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

  async getAssets(): Promise<Asset[]> {
    return Array.from(this.assetMap.values());
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const id = this.assetId++;
    const newAsset = { ...asset, id, createdAt: new Date() };
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

  async getActiveAssetAssignments(): Promise<AssetAssignment[]> {
    return Array.from(this.assetAssignmentMap.values()).filter(assignment => !assignment.dateReturned);
  }

  async createAssetAssignment(assignment: InsertAssetAssignment): Promise<AssetAssignment> {
    const id = this.assignmentId++;
    const newAssignment = { ...assignment, id, createdAt: new Date() };
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
    const newRecord = { ...record, id, createdAt: new Date() };
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

  async getExpiringDocuments(daysThreshold: number): Promise<EmployeeDocument[]> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysThreshold);
    
    return Array.from(this.employeeDocumentMap.values()).filter(doc => {
      if (!doc.expiryDate) return false;
      const expiryDate = new Date(doc.expiryDate);
      return expiryDate <= threshold;
    });
  }

  async createEmployeeDocument(document: InsertEmployeeDocument): Promise<EmployeeDocument> {
    const id = this.documentId++;
    const newDocument = { ...document, id, createdAt: new Date() };
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

  async getVendors(): Promise<Vendor[]> {
    return Array.from(this.vendorMap.values());
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const id = this.vendorId++;
    const newVendor = { ...vendor, id, createdAt: new Date() };
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
    const newNotification = { ...notification, id, createdAt: new Date() };
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

  async getAuditLogs(): Promise<AuditLog[]> {
    return Array.from(this.auditLogMap.values());
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = this.auditLogId++;
    const newLog = { ...log, id };
    this.auditLogMap.set(id, newLog);
    return newLog;
  }
  
  // Dashboard statistics
  async getDashboardStats(): Promise<any> {
    const assets = await this.getAssets();
    const employees = await this.getEmployees();
    const expiringDocs = await this.getExpiringDocuments(90);
    const maintenanceRecords = Array.from(this.maintenanceRecordMap.values());
    
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
    
    // Document status
    const validDocs = Array.from(this.employeeDocumentMap.values()).filter(doc => {
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
    
    const expiredDocs = Array.from(this.employeeDocumentMap.values()).filter(doc => {
      if (!doc.expiryDate) return false;
      return new Date(doc.expiryDate) <= new Date();
    });
    
    const totalDocs = this.employeeDocumentMap.size;
    
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
    
    return {
      counts: {
        assets: assets.length,
        employees: employees.length,
        expiringDocuments: expiringDocs.length,
        maintenanceDue: maintenanceDue.length
      },
      assetDistribution,
      documentStatus,
      recentAssignments: Array.from(this.assetAssignmentMap.values())
        .sort((a, b) => new Date(b.dateAssigned).getTime() - new Date(a.dateAssigned).getTime())
        .slice(0, 5)
    };
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore: any; // Use any type for sessionStore

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Ensure role is not undefined
    const userData = {
      ...insertUser,
      role: insertUser.role || 'employee'
    };
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(userData).where(eq(users.id, id)).returning();
    return user || undefined;
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

  async getEmployees(): Promise<Employee[]> {
    return await db.select().from(employees);
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

  async getAssets(): Promise<Asset[]> {
    return await db.select().from(assets);
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

  async getVendors(): Promise<Vendor[]> {
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
    return await db.select().from(notifications).where(eq(notifications.targetUserId, userId));
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

  async getAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }
  
  // Dashboard statistics
  async getDashboardStats(): Promise<any> {
    // Get counts
    const assetsCount = await db.select({ count: sql`count(*)` }).from(assets);
    const employeesCount = await db.select({ count: sql`count(*)` }).from(employees);
    
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    
    // Expiring documents
    const expiringDocsQuery = await db.select({ count: sql`count(*)` })
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
      maintenanceDueQuery = await db.select({ count: sql`count(*)` })
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
    const assetTypesQuery = await db.select({
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
    const totalDocsQuery = await db.select({ count: sql`count(*)` }).from(employeeDocuments);
    const totalDocs = Number(totalDocsQuery[0]?.count || 0);
    
    const validDocsQuery = await db.select({ count: sql`count(*)` })
      .from(employeeDocuments)
      .where(
        sql`${employeeDocuments.expiryDate} IS NULL OR ${employeeDocuments.expiryDate} > ${now}`
      );
    
    const expiringSoonDocsQuery = await db.select({ count: sql`count(*)` })
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
    
    const expiredDocsQuery = await db.select({ count: sql`count(*)` })
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
    const recentAssignments = await db.select()
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

// Export the storage instance (switch to DatabaseStorage)
export const storage = new DatabaseStorage();

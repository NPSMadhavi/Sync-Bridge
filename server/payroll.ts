import { Request, Response, Router } from 'express';
import { db } from './db';
import { employeePayroll, payrollRecords, employees, tenants, companies } from '@shared/schema';
import { and, eq, desc, gte, lte, sql, isNull } from 'drizzle-orm';
import { insertEmployeePayrollSchema, insertPayrollRecordSchema } from '@shared/schema';
import { sendEmail } from './email';
import dayjs from 'dayjs';
import { calculateSingaporePayroll } from './singapore-payroll-calculator';
import { mapEmployeeResidency } from '@shared/singapore-payroll';
import {
  generatePayslipPdf,
  generateCombinedPayslipPdf,
  savePayslipPdf,
  getPayslipDownloadFileName,
  buildPayslipHtml,
  buildCombinedPayslipHtml,
  type PayslipData,
} from './payslip-generator';
import {
  createPayslipZipArchive,
  getPayslipZipFileName,
  registerSessionPayslipZip,
  sendPayslipZipFile,
} from './payslip-zip';
import {
  BatchPayrollSummary,
  derivePayrollMonthYear,
  findPayrollRecordForPeriod,
  formatPayrollMonthLabel,
  getBatchZipNameFromPeriod,
  getMonthEndDay,
  getPayPeriodForMonth,
  hasPayrollConfigChanged,
  hasPayrollInputsChanged,
  normalizePayPeriodDate,
  parseForceOverwriteFlag,
  resolvePayrollMonthYearFromRecord,
  upsertPayrollRecord,
  buildPayrollRecordPayload,
  syncEmployeeSalaryFromPayrollConfig,
  syncPayrollConfigFromEmployee,
  syncPayrollConfigsWithCompanySalaries,
  resolvePayrollConfigsForProcessing,
  purgeStalePayrollRecordsForMonth,
  reconcilePayrollRecordsBeforeProcessing,
  getCurrentEmployeeCompanyIds,
} from './payroll-process-service';
import {
  buildPayrollEmployeeSnapshot,
  findPayrollRecordsForMonth,
  isHistoricalPayrollRecord,
  payrollRecordSnapshotSelect,
  type PayrollRecordWithSnapshot,
} from './payroll-snapshot-service';
import {
  getSalaryMonthReferenceDate,
  resolveCompanyForPayrollDate,
  resolveCompanyIdForDate,
  resolveCompanyIdForDateStrict,
  resolveReferenceDateFromPayPeriod,
  getEarliestPayslipEligibilityDate,
  isPayslipMonthEligible,
} from './employee-company-history-service';
import { resolveCompanySalariesForPayslip } from './employee-company-salary-service';
import { DataEncryption } from './utils/encryption';

// Utility to get CPF rate based on citizenship and PR years
type CpfRateArgs = { nationality?: string; joinDate?: Date | string; now?: Date; pr2ndYearRate?: number };
function getEmployeeCpfRate({ nationality, joinDate, now = new Date(), pr2ndYearRate = 13 }: CpfRateArgs) {
  if (!nationality) return 0;
  if (nationality.toLowerCase() === 'singaporean' || nationality.toLowerCase() === 'singapore citizen') {
    return 20;
  }
  if (nationality.toLowerCase() === 'pr' || nationality.toLowerCase() === 'permanent resident') {
    if (!joinDate) return pr2ndYearRate;
    const years = dayjs(now).diff(dayjs(joinDate), 'year', true);
    if (years < 1) return 7;
    if (years < 2) return pr2ndYearRate;
    return 20;
  }
  // Foreigner
  return 0;
}

// Utility to check if employee is eligible for CPF (Citizens and PRs only)
function isEmployeeCpfEligible(nationality?: string): boolean {
  if (!nationality) return false;
  const lowerNationality = nationality.toLowerCase();
  
  // Only Singapore Citizens and PRs are eligible for CPF
  return lowerNationality === 'singaporean' || 
         lowerNationality === 'singapore citizen' ||
         lowerNationality === 'pr' ||
         lowerNationality === 'permanent resident';
}



// Get all employee payroll configurations
export async function getEmployeePayrollConfigs(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    
    let query = db
      .select({
        id: employeePayroll.id,
        employeeId: employeePayroll.employeeId,
        companyId: employeePayroll.companyId,
        companyName: companies.companyName,
        employeeName: employees.name,
        department: employees.department,
        designation: employees.designation,
        joinDate: employees.joinDate,
        nationality: employees.nationality,
        dateOfBirth: employees.dateOfBirth,
        monthlySalary: employees.salary,
        baseSalary: employeePayroll.baseSalary,
        payrollPeriod: employeePayroll.payrollPeriod,
        noOfWorkingDays: employeePayroll.noOfWorkingDays,
        hourlyRate: employeePayroll.hourlyRate,
        overtimeRate: employeePayroll.overtimeRate,
        allowances: employeePayroll.allowances,
        deductions: employeePayroll.deductions,
        taxRate: employeePayroll.taxRate,
        taxAmount: employeePayroll.taxAmount,
        cpfRate: employeePayroll.cpfRate,
        cpfAmount: employeePayroll.cpfAmount,
        employerCpfRate: employeePayroll.employerCpfRate,
        employerCpfAmount: employeePayroll.employerCpfAmount,
        incomeTax: employeePayroll.incomeTax,
        netSalary: employeePayroll.netSalary,
        prStatus: employees.prStatus,
        isActive: employeePayroll.isActive,
        effectiveFrom: employeePayroll.effectiveFrom,
        effectiveTo: employeePayroll.effectiveTo,
        createdAt: employeePayroll.createdAt,
        updatedAt: employeePayroll.updatedAt,
      })
      .from(employeePayroll)
      .leftJoin(employees, eq(employeePayroll.employeeId, employees.id))
      .leftJoin(companies, eq(employeePayroll.companyId, companies.id));

    const employeeIdFilter = req.query.employeeId ? Number(req.query.employeeId) : null;
    const effectiveTenantId = tenant?.id || user?.tenantId || null;

    const whereConditions = [];
    if (user?.role === 'super_admin' || user?.isSuperAdmin) {
      if (effectiveTenantId) {
        whereConditions.push(eq(employeePayroll.tenantId, effectiveTenantId));
      }
    } else {
      if (!effectiveTenantId) {
        return res.status(400).json({ message: 'Tenant context required for regular users' });
      }
      whereConditions.push(eq(employeePayroll.tenantId, effectiveTenantId));
    }
    if (employeeIdFilter && Number.isFinite(employeeIdFilter)) {
      whereConditions.push(eq(employeePayroll.employeeId, employeeIdFilter));
    }
    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }

    const configs = await query.orderBy(desc(employeePayroll.createdAt));

    const syncedConfigs = await Promise.all(
      configs.map(async (config) => {
        const empMonthly = config.monthlySalary != null ? Number(config.monthlySalary) : null;
        const configMonthly = Number(config.baseSalary);
        const salaryOutOfSync =
          empMonthly != null &&
          !Number.isNaN(empMonthly) &&
          empMonthly > 0 &&
          Math.abs(empMonthly - configMonthly) > 0.01;

        if (!salaryOutOfSync) {
          return config;
        }

        const [employee] = await db!
          .select()
          .from(employees)
          .where(eq(employees.id, config.employeeId))
          .limit(1);

        if (!employee) {
          return config;
        }

        const synced = await syncPayrollConfigFromEmployee(employee, config.id);
        if (!synced) {
          return config;
        }

        return {
          ...config,
          baseSalary: synced.baseSalary,
          cpfRate: synced.cpfRate,
          cpfAmount: synced.cpfAmount,
          employerCpfRate: synced.employerCpfRate,
          employerCpfAmount: synced.employerCpfAmount,
          netSalary: synced.netSalary,
          updatedAt: synced.updatedAt,
        };
      })
    );

    res.json(syncedConfigs);
  } catch (error) {
    console.error('Error fetching employee payroll configs:', error);
    res.status(500).json({ message: 'Failed to fetch employee payroll configurations' });
  }
}

async function resolvePayrollTenantId(
  effectiveTenantId: number | null,
  employeeId: number
): Promise<number | null> {
  let resolvedTenantId = effectiveTenantId;
  if (!resolvedTenantId) {
    const [emp] = await db
      .select({ tenantId: employees.tenantId })
      .from(employees)
      .where(eq(employees.id, employeeId));
    resolvedTenantId = emp?.tenantId ?? null;
  }
  if (!resolvedTenantId) {
    const [firstTenant] = await db.select({ id: tenants.id }).from(tenants).limit(1);
    resolvedTenantId = firstTenant?.id ?? null;
  }
  return resolvedTenantId;
}

function normalizePayrollConfigBody(reqBody: Record<string, unknown>, userId: number) {
  const bodyPayload: Record<string, unknown> = {
    ...reqBody,
    createdBy: userId,
    companyId:
      reqBody.companyId != null && reqBody.companyId !== ''
        ? Number(reqBody.companyId)
        : undefined,
    baseSalary: Number(reqBody.baseSalary),
    hourlyRate: reqBody.hourlyRate ? Number(reqBody.hourlyRate) : null,
    overtimeRate: reqBody.overtimeRate ? Number(reqBody.overtimeRate) : null,
    taxRate: reqBody.taxRate ? Number(reqBody.taxRate) : 0,
    cpfRate: reqBody.cpfRate ? Number(reqBody.cpfRate) : 20,
    allowances: reqBody.allowances || {},
    deductions: reqBody.deductions || {},
    effectiveTo:
      reqBody.effectiveTo && String(reqBody.effectiveTo).trim() !== ''
        ? reqBody.effectiveTo
        : null,
  };

  if (reqBody.noOfWorkingDays != null && reqBody.noOfWorkingDays !== '') {
    bodyPayload.noOfWorkingDays = Math.trunc(Number(reqBody.noOfWorkingDays));
  }

  return bodyPayload;
}

async function findExistingPayrollConfigForUpsert(
  resolvedTenantId: number,
  employeeId: number,
  companyId?: number | null,
  configId?: number | null
) {
  if (configId) {
    const [byId] = await db
      .select()
      .from(employeePayroll)
      .where(
        and(
          eq(employeePayroll.id, Number(configId)),
          eq(employeePayroll.tenantId, resolvedTenantId)
        )
      )
      .limit(1);
    if (byId) return byId;
  }

  if (companyId) {
    const [byCompany] = await db
      .select()
      .from(employeePayroll)
      .where(
        and(
          eq(employeePayroll.tenantId, resolvedTenantId),
          eq(employeePayroll.employeeId, employeeId),
          eq(employeePayroll.isActive, true),
          eq(employeePayroll.companyId, Number(companyId))
        )
      )
      .limit(1);
    if (byCompany) return byCompany;

    const legacyRows = await db
      .select()
      .from(employeePayroll)
      .where(
        and(
          eq(employeePayroll.tenantId, resolvedTenantId),
          eq(employeePayroll.employeeId, employeeId),
          eq(employeePayroll.isActive, true),
          isNull(employeePayroll.companyId)
        )
      );
    if (legacyRows.length === 1) return legacyRows[0];
    return null;
  }

  const [legacyOnly] = await db
    .select()
    .from(employeePayroll)
    .where(
      and(
        eq(employeePayroll.tenantId, resolvedTenantId),
        eq(employeePayroll.employeeId, employeeId),
        eq(employeePayroll.isActive, true),
        isNull(employeePayroll.companyId)
      )
    )
    .limit(1);
  return legacyOnly ?? null;
}

async function upsertEmployeePayrollConfigRecord(
  resolvedTenantId: number,
  validatedData: Record<string, unknown>,
  options?: { configId?: number | null; companyId?: number | null; employeeId?: number }
) {
  const employeeId = Number(options?.employeeId ?? validatedData.employeeId);
  const companyId =
    options?.companyId != null
      ? Number(options.companyId)
      : validatedData.companyId != null
        ? Number(validatedData.companyId)
        : null;

  const existing = await findExistingPayrollConfigForUpsert(
    resolvedTenantId,
    employeeId,
    companyId,
    options?.configId
  );

  if (existing) {
    const [updatedConfig] = await db
      .update(employeePayroll)
      .set({ ...validatedData, tenantId: resolvedTenantId, updatedAt: new Date() })
      .where(eq(employeePayroll.id, existing.id))
      .returning();
    return updatedConfig;
  }

  const [newConfig] = await db
    .insert(employeePayroll)
    .values({ ...validatedData, tenantId: resolvedTenantId })
    .returning();
  return newConfig;
}

// Batch save payroll configs for all companies of one employee (single final save)
export async function batchSaveEmployeePayrollConfigs(req: Request, res: Response) {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;

    if (!user || !user.id) {
      return res.status(401).json({ message: 'User context not found' });
    }

    const effectiveTenantId = tenant?.id || user?.tenantId || null;
    if (!effectiveTenantId && !(user?.role === 'super_admin' || user?.isSuperAdmin)) {
      return res.status(401).json({ message: 'Tenant context not found' });
    }

    const { employeeId, configs } = req.body as {
      employeeId?: number;
      configs?: Array<Record<string, unknown>>;
    };

    const employeeIdNum = Number(employeeId);
    if (!employeeIdNum || !Array.isArray(configs) || configs.length === 0) {
      return res.status(400).json({ message: 'employeeId and at least one company config are required' });
    }

    const resolvedTenantId = await resolvePayrollTenantId(effectiveTenantId, employeeIdNum);
    if (!resolvedTenantId) {
      return res.status(400).json({ message: 'No tenant found. Please create a tenant first.' });
    }

    const savedConfigs = [];
    const savedCompanyIds = new Set<number>();
    for (const config of configs) {
      const bodyPayload = normalizePayrollConfigBody(
        { ...config, employeeId: employeeIdNum },
        user.id
      );
      const validatedData = insertEmployeePayrollSchema.omit({ tenantId: true }).parse(bodyPayload);
      const companyId =
        config.companyId != null ? Number(config.companyId) : validatedData.companyId ?? null;
      if (companyId) savedCompanyIds.add(companyId);
      const saved = await upsertEmployeePayrollConfigRecord(resolvedTenantId, validatedData, {
        configId: config.configId != null ? Number(config.configId) : null,
        companyId,
        employeeId: employeeIdNum,
      });
      savedConfigs.push(saved);
    }

    const existingConfigs = await db
      .select()
      .from(employeePayroll)
      .where(
        and(
          eq(employeePayroll.tenantId, resolvedTenantId),
          eq(employeePayroll.employeeId, employeeIdNum)
        )
      );

    for (const existing of existingConfigs) {
      const existingCompanyId =
        existing.companyId != null ? Number(existing.companyId) : null;
      if (
        savedCompanyIds.size > 0 &&
        existingCompanyId != null &&
        !savedCompanyIds.has(existingCompanyId) &&
        existing.isActive
      ) {
        await db
          .update(employeePayroll)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(employeePayroll.id, existing.id));
      }
    }

    res.status(200).json({ configs: savedConfigs });
  } catch (error) {
    console.error('Error batch saving employee payroll configs:', error);
    if (error && typeof error === 'object' && 'issues' in error) {
      const issues = (error as { issues: Array<{ message: string }> }).issues;
      return res.status(400).json({ message: issues.map((i) => i.message).join(', ') });
    }
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to save payroll configurations' });
    }
  }
}

// Create employee payroll configuration
export async function createEmployeePayrollConfig(req: Request, res: Response) {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;

    if (!user || !user.id) {
      return res.status(401).json({ message: 'User context not found' });
    }

    // Allow super_admin and admin without tenant; regular users must have tenant
    const effectiveTenantId = tenant?.id || user?.tenantId || null;
    if (!effectiveTenantId && !(user?.role === 'super_admin' || user?.isSuperAdmin)) {
      return res.status(401).json({ message: 'Tenant context not found' });
    }
    
    const bodyPayload = normalizePayrollConfigBody(req.body, user.id);

    const validatedData = insertEmployeePayrollSchema.omit({ tenantId: true }).parse(bodyPayload);

    const resolvedTenantId = await resolvePayrollTenantId(effectiveTenantId, validatedData.employeeId);
    if (!resolvedTenantId) {
      return res.status(400).json({ message: 'No tenant found. Please create a tenant first.' });
    }

    const saved = await upsertEmployeePayrollConfigRecord(resolvedTenantId, validatedData, {
      configId: req.body.configId != null ? Number(req.body.configId) : null,
      companyId: validatedData.companyId ?? null,
      employeeId: validatedData.employeeId,
    });

    res.status(200).json(saved);
  } catch (error) {
    console.error('Error creating employee payroll config:', error);
    if (error && typeof error === 'object' && 'issues' in error) {
      const issues = (error as { issues: Array<{ message: string }> }).issues;
      return res.status(400).json({ message: issues.map((i) => i.message).join(', ') });
    }
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to create employee payroll configuration' });
    }
  }
}

// Update employee payroll configuration
export async function updateEmployeePayrollConfig(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const tenant = (req as any).tenant;
    const user = (req as any).user;

    if (!user || !user.id) {
      return res.status(401).json({ message: 'User context not found' });
    }

    const effectiveTenantId = tenant?.id || user?.tenantId || null;

    const num = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v));

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (req.body.companyId !== undefined) {
      updateData.companyId = req.body.companyId ? Number(req.body.companyId) : null;
    }
    if (req.body.baseSalary !== undefined) updateData.baseSalary = String(num(req.body.baseSalary) ?? req.body.baseSalary);
    if (req.body.payrollPeriod !== undefined) updateData.payrollPeriod = req.body.payrollPeriod;
    if (req.body.noOfWorkingDays !== undefined) {
      updateData.noOfWorkingDays =
        req.body.noOfWorkingDays != null && req.body.noOfWorkingDays !== ''
          ? Math.trunc(Number(req.body.noOfWorkingDays))
          : null;
    }
    if (req.body.hourlyRate !== undefined) updateData.hourlyRate = req.body.hourlyRate != null ? String(num(req.body.hourlyRate) ?? 0) : null;
    if (req.body.overtimeRate !== undefined) updateData.overtimeRate = req.body.overtimeRate != null ? String(num(req.body.overtimeRate) ?? 0) : null;
    if (req.body.allowances !== undefined) updateData.allowances = req.body.allowances;
    if (req.body.deductions !== undefined) updateData.deductions = req.body.deductions;
    if (req.body.taxRate !== undefined) updateData.taxRate = String(num(req.body.taxRate) ?? 0);
    if (req.body.taxAmount !== undefined) updateData.taxAmount = String(num(req.body.taxAmount) ?? 0);
    if (req.body.cpfRate !== undefined) updateData.cpfRate = String(num(req.body.cpfRate) ?? 0);
    if (req.body.cpfAmount !== undefined) updateData.cpfAmount = String(num(req.body.cpfAmount) ?? 0);
    if (req.body.employerCpfRate !== undefined) updateData.employerCpfRate = String(num(req.body.employerCpfRate) ?? 0);
    if (req.body.employerCpfAmount !== undefined) updateData.employerCpfAmount = String(num(req.body.employerCpfAmount) ?? 0);
    if (req.body.incomeTax !== undefined) updateData.incomeTax = String(num(req.body.incomeTax) ?? 0);
    if (req.body.netSalary !== undefined) updateData.netSalary = String(num(req.body.netSalary) ?? 0);
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
    if (req.body.effectiveFrom !== undefined) updateData.effectiveFrom = req.body.effectiveFrom;
    if (req.body.effectiveTo !== undefined) {
      updateData.effectiveTo = req.body.effectiveTo && String(req.body.effectiveTo).trim() !== '' ? req.body.effectiveTo : null;
    }

    const [updatedConfig] = await db
      .update(employeePayroll)
      .set(updateData)
      .where(
        and(
          eq(employeePayroll.id, parseInt(id)),
          effectiveTenantId ? eq(employeePayroll.tenantId, effectiveTenantId) : undefined
        )
      )
      .returning();

    if (!updatedConfig) {
      return res.status(404).json({ message: 'Payroll configuration not found' });
    }

    if (updateData.baseSalary !== undefined) {
      try {
        await syncEmployeeSalaryFromPayrollConfig(updatedConfig);
      } catch (syncError) {
        console.error('Failed to sync employee salary from payroll config:', syncError);
      }
    }

    res.json(updatedConfig);
  } catch (error) {
    console.error('Error updating employee payroll config:', error);
    res.status(500).json({ message: 'Failed to update employee payroll configuration' });
  }
}

// Add the delete handler:
export async function deleteEmployeePayrollConfig(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const force = req.query.force === 'true';
    const effectiveTenantId = tenant?.id || user?.tenantId || null;
    // Check for related payroll records
    const relatedRecords = await db
      .select()
      .from(payrollRecords)
      .where(and(
        eq(payrollRecords.payrollConfigId, parseInt(id)),
        effectiveTenantId ? eq(payrollRecords.tenantId, effectiveTenantId) : undefined
      ));
    if (relatedRecords.length > 0 && !force) {
      return res.status(409).json({ message: 'Payroll config has related payroll records' });
    }
    if (force && relatedRecords.length > 0) {
      await db.delete(payrollRecords)
        .where(and(
          eq(payrollRecords.payrollConfigId, parseInt(id)),
          effectiveTenantId ? eq(payrollRecords.tenantId, effectiveTenantId) : undefined
        ));
    }
    const deleted = await db.delete(employeePayroll)
      .where(and(
        eq(employeePayroll.id, parseInt(id)),
        effectiveTenantId ? eq(employeePayroll.tenantId, effectiveTenantId) : undefined
      ))
      .returning();
    if (!deleted.length) {
      return res.status(404).json({ message: 'Payroll configuration not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting payroll config:', error);
    res.status(500).json({ message: 'Failed to delete payroll configuration' });
  }
}

// Get payroll records
export async function getPayrollRecords(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    const { employeeId, status, startDate, endDate } = req.query;

    let query = db
      .select({
        id: payrollRecords.id,
        employeeId: payrollRecords.employeeId,
        payrollConfigId: payrollRecords.payrollConfigId,
        payrollMonth: payrollRecords.payrollMonth,
        payrollYear: payrollRecords.payrollYear,
        companyId: payrollRecords.companyId,
        employeeName: payrollRecords.employeeName,
        employeeCode: payrollRecords.employeeCode,
        employeeEmail: payrollRecords.employeeEmail,
        department: payrollRecords.department,
        designation: payrollRecords.designation,
        companyName: payrollRecords.companyName,
        companyAddress: payrollRecords.companyAddress,
        monthlySalary: payrollRecords.monthlySalary,
        annualSalary: payrollRecords.annualSalary,
        payPeriodStart: payrollRecords.payPeriodStart,
        payPeriodEnd: payrollRecords.payPeriodEnd,
        baseSalary: payrollRecords.baseSalary,
        overtimeHours: payrollRecords.overtimeHours,
        overtimePay: payrollRecords.overtimePay,
        allowances: payrollRecords.allowances,
        deductions: payrollRecords.deductions,
        grossPay: payrollRecords.grossPay,
        taxDeduction: payrollRecords.taxDeduction,
        cpfDeduction: payrollRecords.cpfDeduction,
        netPay: payrollRecords.netPay,
        employerCpfAmount: payrollRecords.employerCpfAmount,
        noOfWorkingDays: payrollRecords.noOfWorkingDays,
        status: payrollRecords.status,
        paymentDate: payrollRecords.paymentDate,
        notes: payrollRecords.notes,
        createdAt: payrollRecords.createdAt,
        updatedAt: payrollRecords.updatedAt,
      })
      .from(payrollRecords);

    const effectiveTenantId = tenant?.id || user?.tenantId || null;
    // Apply tenant filter based on user role
    let conditions = [];
    if (user?.role === 'super_admin' || user?.isSuperAdmin) {
      if (effectiveTenantId) {
        conditions.push(eq(payrollRecords.tenantId, effectiveTenantId));
      }
      // If no tenant, fetch all (global access for super admin)
    } else {
      if (!effectiveTenantId) {
        return res.status(400).json({ message: 'Tenant context required for regular users' });
      }
      conditions.push(eq(payrollRecords.tenantId, effectiveTenantId));
    }
    
    // Apply additional filters
    if (employeeId) {
      conditions.push(eq(payrollRecords.employeeId, parseInt(employeeId as string)));
    }
    
    if (status) {
      conditions.push(eq(payrollRecords.status, status as any));
    }
    
    if (startDate) {
      conditions.push(gte(payrollRecords.payPeriodStart, startDate as string));
    }
    
    if (endDate) {
      conditions.push(lte(payrollRecords.payPeriodEnd, endDate as string));
    }

    const records = await query
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(payrollRecords.createdAt));

    res.json(records);
  } catch (error) {
    console.error('Error fetching payroll records:', error);
    res.status(500).json({ message: 'Failed to fetch payroll records' });
  }
}

// Create payroll record
export async function createPayrollRecord(req: Request, res: Response) {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;

    if (!user || !user.id) {
      return res.status(401).json({ message: 'User context not found' });
    }

    const effectiveTenantId = tenant?.id || user?.tenantId || null;
    
    // Extract and validate input data
    const { 
      employeeId, 
      payrollConfigId,
      payPeriodStart, 
      payPeriodEnd, 
      baseSalary,
      overtimeHours = 0,
      overtimePay = 0,
      allowances = {},
      deductions = {},
      grossPay,
      taxDeduction = 0,
      cpfDeduction = 0,
      netPay,
      notes = '',
      forceOverwrite = false,
    } = req.body;

    // Validate required fields
    if (!employeeId || !payrollConfigId || !payPeriodStart || !payPeriodEnd || 
        baseSalary === undefined || grossPay === undefined || netPay === undefined) {
      return res.status(400).json({ 
        message: 'Missing required fields: employeeId, payrollConfigId, payPeriodStart, payPeriodEnd, baseSalary, grossPay, netPay' 
      });
    }

    // Fetch employee for nationality and joinDate
    const employee = await db.select().from(employees).where(eq(employees.id, Number(employeeId))).then((r: any[]) => r[0]);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    
    // Fetch payroll config to get tax rate
    const payrollConfig = await db.select().from(employeePayroll).where(eq(employeePayroll.id, Number(payrollConfigId))).then((r: any[]) => r[0]);
    if (!payrollConfig) return res.status(404).json({ message: 'Payroll configuration not found' });

    const resolvedTenantId = tenant?.id || user?.tenantId || payrollConfig.tenantId || employee.tenantId || null;
    if (!resolvedTenantId) {
      return res.status(400).json({ message: 'Tenant context not found' });
    }

    // Use Singapore payroll calculator (Board-aligned CPF — tax not deducted)
    const normalizedStart = normalizePayPeriodDate(payPeriodStart);
    const normalizedEnd = normalizePayPeriodDate(payPeriodEnd);
    const { month: payrollMonth, year: payrollYear } = derivePayrollMonthYear(normalizedStart);
    const { residencyType, prYear } = mapEmployeeResidency(employee);

    const calculationResult = calculateSingaporePayroll({
      grossSalary: Number(baseSalary),
      dateOfBirth: employee.dateOfBirth,
      contributionMonth: payrollMonth,
      contributionYear: payrollYear,
      citizenshipStatus: residencyType,
      prYear: residencyType === "pr" ? prYear : null,
      prRateType: "GG",
      cpfStatus: "ordinary",
      monthlyAllowances: allowances || {},
      monthlyDeductions: deductions || {},
      overtimeHours: Number(overtimeHours) || 0,
      overtimeRate: Number(overtimePay) / (Number(overtimeHours) || 1) || 0,
    });
    
    // Tax reference (not applied): calculationResult.monthlyTaxDeduction
    const calculatedTaxDeduction = 0;
    const calculatedCpfDeduction = calculationResult.employeeCpf;

    const referenceDate = resolveReferenceDateFromPayPeriod(
      normalizedStart,
      normalizedEnd,
      payrollMonth,
      payrollYear
    );
    const companyId =
      payrollConfig.companyId ??
      (await resolveCompanyIdForDate(employee.id, referenceDate));

    const snapshot = await buildPayrollEmployeeSnapshot(
      employee,
      payrollConfig,
      companyId,
      referenceDate
    );

    // Ensure all numeric fields are properly converted to numbers
    const payload = {
      tenantId: resolvedTenantId,
      employeeId: Number(employeeId),
      payrollConfigId: Number(payrollConfigId),
      payPeriodStart: normalizedStart,
      payPeriodEnd: normalizedEnd,
      payrollMonth,
      payrollYear,
      baseSalary: Number(baseSalary),
      overtimeHours: Number(overtimeHours),
      overtimePay: Number(overtimePay),
      allowances: allowances || {},
      deductions: deductions || {},
      grossPay: Number(grossPay),
      taxDeduction: calculatedTaxDeduction,
      cpfDeduction: calculatedCpfDeduction,
      netPay: Number(netPay),
      companyId,
      status: 'pending',
      notes: notes || '',
      createdBy: user.id,
      ...snapshot,
    };

    const validatedData = insertPayrollRecordSchema.omit({ tenantId: true }).parse({
      ...payload,
      tenantId: undefined,
    });

    const existingRecord = await findPayrollRecordForPeriod(
      Number(employeeId),
      normalizedStart,
      normalizedEnd,
      companyId
    );

    if (existingRecord) {
      const forceUpdate = parseForceOverwriteFlag(forceOverwrite);
      const configChanged = hasPayrollConfigChanged(
        payrollConfig,
        existingRecord,
        Number(overtimeHours) || 0
      );
      const overtimeChanged =
        Number(overtimeHours) !== Number(existingRecord.overtimeHours ?? 0);

      if (!forceUpdate) {
        const startDate = normalizePayPeriodDate(payPeriodStart);
        const { monthLabel } = derivePayrollMonthYear(startDate);
        return res.status(409).json({
          message: configChanged || overtimeChanged
            ? `Payroll for ${monthLabel} has already been processed. Use force overwrite to update this record.`
            : `Payroll for ${monthLabel} has already been processed.`,
          action: 'skipped',
          dataChanged: configChanged || overtimeChanged,
          record: existingRecord,
        });
      }

      const [updatedRecord] = await db
        .update(payrollRecords)
        .set({
          ...validatedData,
          tenantId: resolvedTenantId,
          updatedAt: new Date(),
        })
        .where(eq(payrollRecords.id, existingRecord.id))
        .returning();

      try {
        await sendEmail({
          to: 'shakuntalahavanoor@gmail.com',
          subject: 'Payroll Reprocessed',
          text: `A payroll record has been updated.\n\nEmployee: ${updatedRecord.employeeId}\nPay Period: ${updatedRecord.payPeriodStart} to ${updatedRecord.payPeriodEnd}\nNet Pay: $${updatedRecord.netPay}`,
          html: `<h2>Payroll Reprocessed</h2><p><strong>Employee:</strong> ${updatedRecord.employeeId}<br/><strong>Pay Period:</strong> ${updatedRecord.payPeriodStart} to ${updatedRecord.payPeriodEnd}<br/><strong>Net Pay:</strong> $${updatedRecord.netPay}</p>`
        });
      } catch (emailErr) {
        console.error('Failed to send payroll reprocessed email:', emailErr);
      }

      return res.status(200).json({ ...updatedRecord, action: 'updated' });
    }

    const [newRecord] = await db
      .insert(payrollRecords)
      .values({ ...validatedData, tenantId: resolvedTenantId })
      .returning();

    // Send notification email after payroll is processed
    try {
      await sendEmail({
        to: 'shakuntalahavanoor@gmail.com',
        subject: 'Payroll Processed',
        text: `A payroll record has been processed.\n\nEmployee: ${newRecord.employeeName || newRecord.employeeId}\nPay Period: ${newRecord.payPeriodStart} to ${newRecord.payPeriodEnd}\nNet Pay: $${newRecord.netPay}`,
        html: `<h2>Payroll Processed</h2><p><strong>Employee:</strong> ${newRecord.employeeName || newRecord.employeeId}<br/><strong>Pay Period:</strong> ${newRecord.payPeriodStart} to ${newRecord.payPeriodEnd}<br/><strong>Net Pay:</strong> $${newRecord.netPay}</p>`
      });
    } catch (emailErr) {
      console.error('Failed to send payroll processed email:', emailErr);
    }

    res.status(201).json({ ...newRecord, action: 'created' });
  } catch (error) {
    console.error('Error creating payroll record:', error);
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to create payroll record' });
    }
  }
}

// Update payroll record status
export async function updatePayrollRecordStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const tenant = (req as any).tenant;
    const user = (req as any).user;

    if (!user || !user.id) {
      return res.status(401).json({ message: 'User context not found' });
    }

    const effectiveTenantId = tenant?.id || user?.tenantId || null;

    const updateData: any = {
      status,
      notes: notes || '',
      updatedAt: new Date(),
    };

    // If approving, add approval details
    if (status === 'approved') {
      updateData.approvedBy = user.id;
      updateData.approvedAt = new Date();
    }

    // If marking as paid, add payment date
    if (status === 'paid') {
      updateData.paymentDate = new Date().toISOString().split('T')[0];
    }

    const [updatedRecord] = await db
      .update(payrollRecords)
      .set(updateData)
      .where(
        and(
          eq(payrollRecords.id, parseInt(id)),
          effectiveTenantId ? eq(payrollRecords.tenantId, effectiveTenantId) : undefined
        )
      )
      .returning();

    if (!updatedRecord) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    res.json(updatedRecord);
  } catch (error) {
    console.error('Error updating payroll record status:', error);
    res.status(500).json({ message: 'Failed to update payroll record status' });
  }
}

// Get payroll summary/dashboard
export async function getPayrollSummary(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    const { month, year } = req.query;

    const effectiveTenantId = tenant?.id || user?.tenantId || null;
    // Build tenant condition based on user role
    let tenantCondition;
    if (user?.role === 'super_admin' || user?.isSuperAdmin) {
      if (effectiveTenantId) {
        tenantCondition = eq(employees.tenantId, effectiveTenantId);
      }
      // If no tenant, fetch all (global access for super admin)
    } else {
      if (!effectiveTenantId) {
        return res.status(400).json({ message: 'Tenant context required for regular users' });
      }
      tenantCondition = eq(employees.tenantId, effectiveTenantId);
    }

    // Get total employees with payroll configs
    let totalEmployeesQuery = db
      .select({
        count: sql<number>`count(distinct ${employees.id})`
      })
      .from(employees)
      .leftJoin(employeePayroll, eq(employees.id, employeePayroll.employeeId))
      .where(
        and(
          tenantCondition || undefined,
          eq(employees.status, 'active')
        )
      );

    const totalEmployees = await totalEmployeesQuery;

    // Get payroll records summary for the period
    let payrollQuery = db
      .select({
        totalGrossPay: sql<string>`sum(${payrollRecords.grossPay})`,
        totalNetPay: sql<string>`sum(${payrollRecords.netPay})`,
        totalTaxDeduction: sql<string>`sum(${payrollRecords.taxDeduction})`,
        totalCpfDeduction: sql<string>`sum(${payrollRecords.cpfDeduction})`,
        paidRecords: sql<number>`count(case when ${payrollRecords.status} = 'paid' then 1 end)`,
        pendingRecords: sql<number>`count(case when ${payrollRecords.status} = 'pending' then 1 end)`,
        draftRecords: sql<number>`count(case when ${payrollRecords.status} = 'draft' then 1 end)`,
      })
      .from(payrollRecords);

    // Apply tenant filter
    let payrollConditions = [];
    if (user?.role === 'super_admin' || user?.isSuperAdmin) {
      if (effectiveTenantId) {
        payrollConditions.push(eq(payrollRecords.tenantId, effectiveTenantId));
      }
      // If no tenant, fetch all (global access for super admin)
    } else {
      if (!effectiveTenantId) {
        return res.status(400).json({ message: 'Tenant context required for regular users' });
      }
      payrollConditions.push(eq(payrollRecords.tenantId, effectiveTenantId));
    }

    // Add date filters if provided
    if (month && year) {
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${String(getMonthEndDay(year, month)).padStart(2, '0')}`;
      payrollConditions.push(
        gte(payrollRecords.payPeriodStart, startDate),
        lte(payrollRecords.payPeriodEnd, endDate)
      );
    }

    const [summary] = await payrollQuery.where(
      payrollConditions.length > 0 ? and(...payrollConditions) : undefined
    );

    res.json({
      totalEmployees: totalEmployees[0]?.count || 0,
      totalGrossPay: parseFloat(summary?.totalGrossPay || '0'),
      totalNetPay: parseFloat(summary?.totalNetPay || '0'),
      totalTaxDeduction: parseFloat(summary?.totalTaxDeduction || '0'),
      totalCpfDeduction: parseFloat(summary?.totalCpfDeduction || '0'),
      paidRecords: summary?.paidRecords || 0,
      pendingRecords: summary?.pendingRecords || 0,
      draftRecords: summary?.draftRecords || 0,
    });
  } catch (error) {
    console.error('Error fetching payroll summary:', error);
    res.status(500).json({ message: 'Failed to fetch payroll summary' });
  }
}

// Preview payroll calculation (no DB write, just calculation)
export async function previewPayrollCalculation(req: Request, res: Response) {
  try {
    // Extract and validate input from req.body
    const {
      grossSalary,
      age,
      citizenshipStatus,
      cpfStatus,
      monthlyAllowances,
      monthlyDeductions,
      overtimeHours,
      overtimeRate,
    } = req.body;

    // Validate required fields
    if (!grossSalary || grossSalary <= 0) {
      return res.status(400).json({ message: 'Valid gross salary is required' });
    }

    // Use Singapore payroll calculator for accurate calculations
    const calculationResult = calculateSingaporePayroll({
      grossSalary: Number(grossSalary),
      age: Number(age) || undefined,
      citizenshipStatus: citizenshipStatus || "citizen",
      prYear: req.body.prYear ?? null,
      prRateType: req.body.prRateType ?? "GG",
      dateOfBirth: req.body.dateOfBirth,
      contributionMonth: req.body.contributionMonth,
      contributionYear: req.body.contributionYear,
      monthlyAllowances: monthlyAllowances || {},
      monthlyDeductions: monthlyDeductions || {},
      overtimeHours: Number(overtimeHours) || 0,
      overtimeRate: Number(overtimeRate) || 0,
      additionalWages: req.body.additionalWages,
      ordinaryWagesSubjectYtd: req.body.ordinaryWagesSubjectYtd,
      additionalWagesSubjectYtd: req.body.additionalWagesSubjectYtd,
      totalCpfPaidYtd: req.body.totalCpfPaidYtd,
    });

    res.json(calculationResult);
  } catch (error) {
    console.error('Error in payroll preview calculation:', error);
    res.status(500).json({ message: 'Failed to calculate payroll preview' });
  }
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function sumJsonValues(obj: Record<string, number> | null | undefined): number {
  if (!obj) return 0;
  return Object.values(obj).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

function resolveEmployeeIcNo(employee: {
  nricNumber: string | null;
  finNumber: string | null;
}): string {
  const nric = employee.nricNumber ? DataEncryption.decryptFully(employee.nricNumber) : '';
  const fin = employee.finNumber ? DataEncryption.decryptFully(employee.finNumber) : '';
  return nric || fin;
}

function buildPayslipFromProcessedRecord(
  record: PayrollRecordWithSnapshot,
  config: {
    noOfWorkingDays: number | null;
    employerCpfAmount: string | number | null;
  },
  employee: {
    id: number;
    employeeId: string;
    name: string;
    department: string;
    designation: string;
    nricNumber: string | null;
    finNumber: string | null;
  },
  company: {
    companyName: string | null;
    address: string | null;
  } | null,
  month: number,
  year: number,
  payPeriodStart: string,
  payPeriodEnd: string,
  options?: { historicalOnly?: boolean }
): PayslipData {
  const historical =
    options?.historicalOnly ?? isHistoricalPayrollRecord(record);
  const basicSalary = parseFloat(String(record.baseSalary));

  if (historical) {
    const snapshotBasicRate =
      record.monthlySalary != null && String(record.monthlySalary).trim() !== ''
        ? parseFloat(String(record.monthlySalary))
        : basicSalary;

    return {
      companyName: record.companyName ?? '',
      companyAddress: record.companyAddress ?? '',
      employeeName: record.employeeName ?? '',
      employeeDbId: employee.id,
      employeeCode: record.employeeCode ?? '',
      icNo: record.icNo ?? '',
      department: record.department ?? '',
      jobTitle: record.designation ?? '',
      month,
      year,
      payPeriodStart,
      payPeriodEnd,
      basicRate: snapshotBasicRate,
      workingDays: record.noOfWorkingDays ?? null,
      basicPay: basicSalary,
      overtime: parseFloat(String(record.overtimePay || 0)),
      allowance: sumJsonValues(record.allowances),
      grossPay: parseFloat(String(record.grossPay)),
      employeeCpf: parseFloat(String(record.cpfDeduction || 0)),
      netPay: parseFloat(String(record.netPay)),
      employerCpf: parseFloat(String(record.employerCpfAmount ?? 0)),
      otherDeductions: sumJsonValues(record.deductions),
    };
  }

  return {
    companyName: company?.companyName ?? '',
    companyAddress: company?.address ?? '',
    employeeName: employee.name,
    employeeDbId: employee.id,
    employeeCode: employee.employeeId,
    icNo: resolveEmployeeIcNo(employee),
    department: employee.department,
    jobTitle: employee.designation,
    month,
    year,
    payPeriodStart,
    payPeriodEnd,
    basicRate: basicSalary,
    workingDays: config.noOfWorkingDays,
    basicPay: basicSalary,
    overtime: parseFloat(String(record.overtimePay || 0)),
    allowance: sumJsonValues(record.allowances),
    grossPay: parseFloat(String(record.grossPay)),
    employeeCpf: parseFloat(String(record.cpfDeduction || 0)),
    netPay: parseFloat(String(record.netPay)),
    employerCpf: parseFloat(String(config.employerCpfAmount ?? 0)),
    otherDeductions: sumJsonValues(record.deductions),
  };
}

function sendPdfBuffer(
  res: Response,
  pdfBuffer: Buffer,
  filename: string,
  inline = false
): void {
  if (
    !Buffer.isBuffer(pdfBuffer) ||
    pdfBuffer.length < 4 ||
    pdfBuffer[0] !== 0x25 ||
    pdfBuffer[1] !== 0x50 ||
    pdfBuffer[2] !== 0x44 ||
    pdfBuffer[3] !== 0x46
  ) {
    throw new Error('Invalid PDF buffer');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
  );
  res.setHeader('Content-Length', String(pdfBuffer.length));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).end(pdfBuffer);
}

type GeneratedPayslipFile = {
  filename: string;
  downloadFilename: string;
  month: number;
  monthLabel: string;
  downloadUrl: string;
  relativePath: string;
  buffer: Buffer;
};

type SingleMonthPayslipResult =
  | {
      status: 'ok';
      payslipData: PayslipData;
      downloadFilename: string;
      monthLabel: string;
      payrollMonth: number;
      payrollYear: number;
    }
  | { status: 'ineligible'; monthLabel: string };

type CompanyPayslipOverride = {
  companyId: number;
  companyName: string;
  salary: string | null;
  annualSalary: string | null;
  address: string | null;
};

async function buildPayslipEntryFromStoredRecord(
  companyRecord: PayrollRecordWithSnapshot,
  config: typeof employeePayroll.$inferSelect,
  employee: {
    id: number;
    employeeId: string;
    name: string;
    department: string;
    designation: string;
    nricNumber: string | null;
    finNumber: string | null;
  },
  _fallbackCompany: { companyName: string | null; address: string | null } | null,
  _referenceDate: string
): Promise<PayslipData> {
  const recordStart = normalizePayPeriodDate(companyRecord.payPeriodStart);
  const recordEnd = normalizePayPeriodDate(companyRecord.payPeriodEnd);
  const { month: payrollMonth, year: payrollYear } = resolvePayrollMonthYearFromRecord({
    payrollMonth: companyRecord.payrollMonth,
    payrollYear: companyRecord.payrollYear,
    payPeriodStart: recordStart,
  });

  const configForPayslip = {
    noOfWorkingDays: companyRecord.noOfWorkingDays ?? null,
    employerCpfAmount: companyRecord.employerCpfAmount ?? null,
  };

  return buildPayslipFromProcessedRecord(
    companyRecord,
    configForPayslip,
    employee,
    null,
    payrollMonth,
    payrollYear,
    recordStart,
    recordEnd,
    { historicalOnly: true }
  );
}

async function buildPayslipDataListForMonth(
  config: typeof employeePayroll.$inferSelect,
  employee: {
    id: number;
    employeeId: string;
    name: string;
    department: string;
    designation: string;
    nricNumber: string | null;
    finNumber: string | null;
    dateOfBirth: string | Date | null;
    nationality: typeof employees.$inferSelect['nationality'];
    prStatus: typeof employees.$inferSelect['prStatus'];
    joinDate: string | Date | null;
  },
  fallbackCompany: { companyName: string | null; address: string | null } | null,
  yearNum: number,
  month: number,
  userId: number,
  options?: { storedOnly?: boolean }
): Promise<PayslipData[]> {
  const storedOnly = options?.storedOnly === true;
  const referenceDate = getSalaryMonthReferenceDate(yearNum, month);

  // Historical path: use stored payroll records (snapshots) — never live employee data
  const storedRecords = await findPayrollRecordsForMonth(config.employeeId, yearNum, month);
  if (storedRecords.length > 0) {
    const payslipDataList: PayslipData[] = [];
    for (const companyRecord of storedRecords) {
      payslipDataList.push(
        await buildPayslipEntryFromStoredRecord(
          companyRecord,
          config,
          employee,
          fallbackCompany,
          referenceDate
        )
      );
    }
    return payslipDataList;
  }

  // View/download must never fall back to live employee data for processed months
  if (storedOnly) {
    return [];
  }

  // Preview path: no processed payroll yet — derive from current employee/company config
  const companySalaries = await resolveCompanySalariesForPayslip(
    config.employeeId,
    referenceDate
  ).catch((err) => {
    console.warn('[payslip] Failed to load company salaries:', err);
    return [];
  });
  const targets = companySalaries.length > 0 ? companySalaries : [null];

  const payslipDataList: PayslipData[] = [];
  const fullEmployee = employee as typeof employees.$inferSelect;
  const { payPeriodStart, payPeriodEnd } = getPayPeriodForMonth(yearNum, month);

  for (const companySalary of targets) {
    const targetCompanyId = companySalary?.companyId ?? null;

    let configForCompany = config as typeof employeePayroll.$inferSelect;
    if (targetCompanyId) {
      const [matchedConfig] = await db
        .select()
        .from(employeePayroll)
        .where(
          and(
            eq(employeePayroll.employeeId, config.employeeId),
            eq(employeePayroll.companyId, targetCompanyId),
            eq(employeePayroll.isActive, true)
          )
        )
        .limit(1);
      if (matchedConfig) {
        configForCompany = matchedConfig;
      }
    }
    if (companySalary?.salary != null) {
      configForCompany = {
        ...configForCompany,
        baseSalary: String(companySalary.salary),
      };
    }

    const eligibilityStart = await getEarliestPayslipEligibilityDate(config.employeeId);
    if (!eligibilityStart || !isPayslipMonthEligible(yearNum, month, eligibilityStart)) {
      continue;
    }

    const companyId =
      targetCompanyId ??
      (await resolveCompanyIdForDateStrict(config.employeeId, referenceDate));

    if (!companyId) {
      continue;
    }

    const payslipRecord = buildPayrollRecordPayload(
      configForCompany,
      fullEmployee,
      payPeriodStart,
      payPeriodEnd,
      userId,
      config.tenantId ?? 0,
      '',
      0,
      companyId
    );

    const companyForPayslip = companySalary
      ? { companyName: companySalary.companyName, address: companySalary.address }
      : await resolveCompanyForPayrollDate(
          config.employeeId,
          referenceDate,
          targetCompanyId
        ).then((c) =>
          c ? { companyName: c.companyName, address: c.address } : fallbackCompany
        );

    payslipDataList.push(
      buildPayslipFromProcessedRecord(
        payslipRecord,
        configForCompany,
        employee,
        companyForPayslip,
        month,
        yearNum,
        payPeriodStart,
        payPeriodEnd,
        { historicalOnly: false }
      )
    );
  }

  return payslipDataList;
}

async function generateCombinedPayslipFileFromDataList(
  payslipDataList: PayslipData[],
  employeeName: string
): Promise<{
  pdfBuffer: Buffer;
  downloadFilename: string;
  saved: { filename: string; relativePath: string };
} | null> {
  if (payslipDataList.length === 0) return null;

  const pdfBuffer = await generateCombinedPayslipPdf(payslipDataList);
  const primary = payslipDataList[0];
  const saved = await savePayslipPdf(primary, pdfBuffer);
  const displayName = primary.employeeName?.trim() || employeeName;
  const downloadFilename = getPayslipDownloadFileName(
    displayName,
    primary.month,
    primary.year
  );

  return { pdfBuffer, downloadFilename, saved };
}

async function resolveSingleMonthPayslipData(
  config: typeof employeePayroll.$inferSelect,
  employee: {
    id: number;
    employeeId: string;
    name: string;
    department: string;
    designation: string;
    nricNumber: string | null;
    finNumber: string | null;
    dateOfBirth: string | Date | null;
    nationality: typeof employees.$inferSelect['nationality'];
    prStatus: typeof employees.$inferSelect['prStatus'];
    joinDate: string | Date | null;
  },
  company: { companyName: string | null; address: string | null } | null,
  yearNum: number,
  month: number,
  userId = 0,
  companyOverride?: CompanyPayslipOverride,
  includeCompanyInFilename = false
): Promise<SingleMonthPayslipResult> {
  const monthLabel = MONTH_NAMES[month - 1];
  const eligibilityStart = await getEarliestPayslipEligibilityDate(config.employeeId);

  if (!eligibilityStart || !isPayslipMonthEligible(yearNum, month, eligibilityStart)) {
    return { status: 'ineligible', monthLabel };
  }

  const monthStart = `${yearNum}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = dayjs(monthStart).endOf('month').format('YYYY-MM-DD');

  const recordConditions = [
    eq(payrollRecords.employeeId, config.employeeId),
    sql`${payrollRecords.payPeriodStart}::date <= ${monthEnd}::date`,
    sql`${payrollRecords.payPeriodEnd}::date >= ${monthStart}::date`,
  ];
  if (companyOverride?.companyId) {
    recordConditions.push(eq(payrollRecords.companyId, companyOverride.companyId));
  }

  const [record] = await db
    .select(payrollRecordSnapshotSelect)
    .from(payrollRecords)
    .where(and(...recordConditions))
    .orderBy(desc(payrollRecords.updatedAt), desc(payrollRecords.createdAt))
    .limit(1);

  if (record) {
    const referenceDate = getSalaryMonthReferenceDate(yearNum, month);
    const payslipData = await buildPayslipEntryFromStoredRecord(
      record,
      config,
      employee,
      company,
      referenceDate
    );
    const resolved = resolvePayrollMonthYearFromRecord({
      payrollMonth: record.payrollMonth,
      payrollYear: record.payrollYear,
      payPeriodStart: normalizePayPeriodDate(record.payPeriodStart),
    });

    return {
      status: 'ok',
      payslipData,
      downloadFilename: getPayslipDownloadFileName(
        payslipData.employeeName || employee.name,
        resolved.month,
        resolved.year,
        includeCompanyInFilename ? companyOverride?.companyName : undefined
      ),
      monthLabel: MONTH_NAMES[resolved.month - 1],
      payrollMonth: resolved.month,
      payrollYear: resolved.year,
    };
  }

  const { payPeriodStart, payPeriodEnd } = getPayPeriodForMonth(yearNum, month);
  const referenceDate = getSalaryMonthReferenceDate(yearNum, month);
  const companyId =
    companyOverride?.companyId ??
    (await resolveCompanyIdForDateStrict(config.employeeId, referenceDate));

  if (!companyId) {
    return { status: 'ineligible', monthLabel };
  }

  const configForCompany =
    companyOverride?.salary != null
      ? { ...config, baseSalary: String(companyOverride.salary) }
      : config;

  const previewRecord = buildPayrollRecordPayload(
    configForCompany,
    employee as typeof employees.$inferSelect,
    payPeriodStart,
    payPeriodEnd,
    userId,
    config.tenantId,
    '',
    0,
    companyId
  );

  const companyForPayslip = companyOverride
    ? {
        companyName: companyOverride.companyName,
        address: companyOverride.address,
      }
    : await resolveCompanyForPayrollDate(
        config.employeeId,
        referenceDate,
        companyId
      ).then((resolved) =>
        resolved
          ? { companyName: resolved.companyName, address: resolved.address }
          : company
      );

  const payslipData = buildPayslipFromProcessedRecord(
    previewRecord,
    configForCompany,
    employee,
    companyForPayslip,
    month,
    yearNum,
    payPeriodStart,
    payPeriodEnd,
    { historicalOnly: false }
  );

  return {
    status: 'ok',
    payslipData,
    downloadFilename: getPayslipDownloadFileName(
      employee.name,
      month,
      yearNum,
      includeCompanyInFilename ? companyOverride?.companyName : undefined
    ),
    monthLabel: MONTH_NAMES[month - 1],
    payrollMonth: month,
    payrollYear: yearNum,
  };
}

async function resolvePayslipContext(
  req: Request,
  payrollConfigIdNum: number
) {
  const user = (req as any).user;
  const tenant = (req as any).tenant;

  if (!user?.id) {
    return { error: { status: 401, body: { message: 'Not authenticated' } } };
  }

  const effectiveTenantId = tenant?.id || user?.tenantId || null;

  const [config] = await db
    .select()
    .from(employeePayroll)
    .where(eq(employeePayroll.id, payrollConfigIdNum));

  if (!config) {
    return { error: { status: 404, body: { message: 'Payroll configuration not found' } } };
  }

  if (
    effectiveTenantId &&
    config.tenantId !== effectiveTenantId &&
    !(user?.role === 'super_admin' || user?.isSuperAdmin)
  ) {
    return { error: { status: 403, body: { message: 'Access denied' } } };
  }

  const [employee] = await db
    .select({
      id: employees.id,
      employeeId: employees.employeeId,
      name: employees.name,
      department: employees.department,
      designation: employees.designation,
      nricNumber: employees.nricNumber,
      finNumber: employees.finNumber,
      companyId: employees.companyId,
      tenantId: employees.tenantId,
      dateOfBirth: employees.dateOfBirth,
      nationality: employees.nationality,
      prStatus: employees.prStatus,
      joinDate: employees.joinDate,
    })
    .from(employees)
    .where(eq(employees.id, config.employeeId));

  if (!employee) {
    return { error: { status: 404, body: { message: 'Employee not found' } } };
  }

  // Only use the company assigned to this employee — never fall back to a
  // tenant default / first company (that incorrectly labels unassigned employees).
  let company: { companyName: string | null; address: string | null } | null = null;
  if (employee.companyId) {
    [company] = await db
      .select({
        companyName: companies.companyName,
        address: companies.address,
      })
      .from(companies)
      .where(eq(companies.id, employee.companyId));
  }

  return { config, employee, company };
}

async function generatePayslipFilesForMonths(
  config: typeof employeePayroll.$inferSelect,
  employee: {
    id: number;
    employeeId: string;
    name: string;
    department: string;
    designation: string;
    nricNumber: string | null;
    finNumber: string | null;
    dateOfBirth: string | Date | null;
    nationality: typeof employees.$inferSelect['nationality'];
    prStatus: typeof employees.$inferSelect['prStatus'];
    joinDate: string | Date | null;
  },
  company: { companyName: string | null; address: string | null } | null,
  yearNum: number,
  validMonths: number[],
  userId = 0
): Promise<{
  generatedFiles: GeneratedPayslipFile[];
  missingMonths: string[];
  ineligibleMonths: string[];
}> {
  const generatedFiles: GeneratedPayslipFile[] = [];
  const missingMonths: string[] = [];
  const ineligibleMonths: string[] = [];

  for (const month of validMonths) {
    const monthLabel = MONTH_NAMES[month - 1];
    const payslipDataList = await buildPayslipDataListForMonth(
      config,
      employee,
      company,
      yearNum,
      month,
      userId,
      { storedOnly: true }
    );

    if (payslipDataList.length === 0) {
      missingMonths.push(monthLabel);
      continue;
    }

    const combined = await generateCombinedPayslipFileFromDataList(
      payslipDataList,
      payslipDataList[0]?.employeeName?.trim() || employee.name
    );
    if (!combined) {
      ineligibleMonths.push(monthLabel);
      continue;
    }

    const primary = payslipDataList[0];
    generatedFiles.push({
      filename: combined.saved.filename,
      downloadFilename: combined.downloadFilename,
      month: primary.month,
      monthLabel: MONTH_NAMES[primary.month - 1],
      downloadUrl: `/${combined.saved.relativePath.replace(/\\/g, '/')}`,
      relativePath: combined.saved.relativePath,
      buffer: combined.pdfBuffer,
    });
  }

  return { generatedFiles, missingMonths, ineligibleMonths };
}

export async function previewPayslip(req: Request, res: Response) {
  try {
    const { payrollConfigId, year, month } = req.body as {
      payrollConfigId?: number;
      year?: number;
      month?: number;
    };

    const payrollConfigIdNum = Number(payrollConfigId);
    const yearNum = Number(year);
    const monthNum = Number(month);

    if (!payrollConfigIdNum || !yearNum || !monthNum || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        message: 'payrollConfigId, year, and a valid month are required',
      });
    }

    const ctx = await resolvePayslipContext(req, payrollConfigIdNum);
    if ('error' in ctx && ctx.error) {
      return res.status(ctx.error.status).json(ctx.error.body);
    }

    const { config, employee, company } = ctx as Exclude<typeof ctx, { error: unknown }>;
    const user = (req as any).user;

    const payslipDataList = await buildPayslipDataListForMonth(
      config,
      employee,
      company,
      yearNum,
      monthNum,
      user?.id || 0,
      { storedOnly: true }
    );

    if (payslipDataList.length === 0) {
      return res.status(404).json({
        message: `Payslip cannot be generated for ${MONTH_NAMES[monthNum - 1]} ${yearNum}. Please process payroll for this month first.`,
      });
    }

    const html = buildCombinedPayslipHtml(payslipDataList);
    const primary = payslipDataList[0];
    const displayName = primary.employeeName?.trim() || employee.name;
    const title = `Payslip — ${displayName} — ${MONTH_NAMES[primary.month - 1]} ${yearNum}`;
    const downloadFilename = getPayslipDownloadFileName(
      displayName,
      primary.month,
      primary.year
    );

    res.json({
      html,
      title,
      downloadFilename,
      month: primary.month,
      monthLabel: MONTH_NAMES[primary.month - 1],
      year: primary.year,
    });
  } catch (error) {
    console.error('Error previewing payslip:', error);
    const message = error instanceof Error ? error.message : 'Failed to preview payslip';
    res.status(500).json({ message: `Failed to preview payslip: ${message}` });
  }
}

export async function viewPayslip(req: Request, res: Response) {
  try {
    const { payrollConfigId, year, month } = req.body as {
      payrollConfigId?: number;
      year?: number;
      month?: number;
    };

    const payrollConfigIdNum = Number(payrollConfigId);
    const yearNum = Number(year);
    const monthNum = Number(month);

    if (!payrollConfigIdNum || !yearNum || !monthNum || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        message: 'payrollConfigId, year, and a valid month are required',
      });
    }

    const ctx = await resolvePayslipContext(req, payrollConfigIdNum);
    if ('error' in ctx && ctx.error) {
      return res.status(ctx.error.status).json(ctx.error.body);
    }

    const { config, employee, company } = ctx as Exclude<typeof ctx, { error: unknown }>;
    const user = (req as any).user;
    const { generatedFiles, missingMonths, ineligibleMonths } = await generatePayslipFilesForMonths(
      config,
      employee,
      company,
      yearNum,
      [monthNum],
      user?.id || 0
    );

    if (generatedFiles.length === 0) {
      const monthLabel = MONTH_NAMES[monthNum - 1];
      if (ineligibleMonths.includes(monthLabel)) {
        return res.status(404).json({
          message: `Payslip cannot be generated for ${monthLabel} ${yearNum}. The employee was not yet assigned to a company in this month.`,
          ineligibleMonths,
        });
      }
      return res.status(404).json({
        message: `No processed payroll found for: ${missingMonths.join(', ') || 'selected month'}. Please process payroll first.`,
        missingMonths,
      });
    }

    const file = generatedFiles[0];
    sendPdfBuffer(res, file.buffer, file.downloadFilename, true);
  } catch (error) {
    console.error('Error viewing payslip:', error);
    const message = error instanceof Error ? error.message : 'Failed to view payslip';
    res.status(500).json({ message: `Failed to view payslip: ${message}` });
  }
}

export async function downloadPayslips(req: Request, res: Response) {
  try {
    const { payrollConfigId, year, months } = req.body as {
      payrollConfigId?: number;
      year?: number;
      months?: number[];
    };

    const payrollConfigIdNum = Number(payrollConfigId);
    const yearNum = Number(year);

    if (!payrollConfigIdNum || !yearNum || !Array.isArray(months) || months.length === 0) {
      return res.status(400).json({
        message: 'payrollConfigId, year, and at least one month are required',
      });
    }

    const validMonths = months
      .map((m) => Number(m))
      .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
    if (validMonths.length === 0) {
      return res.status(400).json({ message: 'Invalid month selection' });
    }

    const ctx = await resolvePayslipContext(req, payrollConfigIdNum);
    if ('error' in ctx && ctx.error) {
      return res.status(ctx.error.status).json(ctx.error.body);
    }

    const { config, employee, company } = ctx as Exclude<typeof ctx, { error: unknown }>;
    const user = (req as any).user;
    const { generatedFiles, missingMonths, ineligibleMonths } = await generatePayslipFilesForMonths(
      config,
      employee,
      company,
      yearNum,
      validMonths,
      user?.id || 0
    );

    if (generatedFiles.length === 0) {
      if (ineligibleMonths.length > 0) {
        return res.status(404).json({
          message: `Payslip cannot be generated for: ${ineligibleMonths.join(', ')}. The employee was not yet assigned to a company in those month(s).`,
          ineligibleMonths,
          missingMonths,
        });
      }
      return res.status(404).json({
        message: `No processed payroll found for: ${missingMonths.join(', ')}. Please process payroll for the selected month(s) first.`,
        missingMonths,
      });
    }

    if (generatedFiles.length === 1) {
      const file = generatedFiles[0];
      if (missingMonths.length > 0) {
        res.setHeader('X-Payslip-Missing-Months', missingMonths.join(', '));
      }
      sendPdfBuffer(res, file.buffer, file.downloadFilename);
      return;
    }

    const zipFilename = getPayslipZipFileName(employee.name, employee.id);
    const zipPath = await createPayslipZipArchive(
      generatedFiles.map(({ downloadFilename, buffer }) => ({
        filename: downloadFilename,
        buffer,
      }))
    );
    const sessionId = (req as any).session?.id as string | undefined;
    if (sessionId) {
      registerSessionPayslipZip(sessionId, zipPath);
    }
    if (missingMonths.length > 0) {
      res.setHeader('X-Payslip-Missing-Months', missingMonths.join(', '));
    }
    sendPayslipZipFile(res, zipPath, zipFilename, sessionId);
  } catch (error) {
    console.error('Error generating payslips:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to generate payslips';
    res.status(500).json({ message: `Failed to generate payslips: ${message}` });
  }
}

function getBatchPayslipZipFileName(payPeriodStart: string) {
  return getBatchZipNameFromPeriod(payPeriodStart);
}

async function generatePayslipBufferForRecord(
  record: PayrollRecordWithSnapshot,
  config: {
    employeeId: number;
    noOfWorkingDays: number | null;
    employerCpfAmount: string | number | null;
  },
  employee: {
    id: number;
    employeeId: string;
    name: string;
    department: string;
    designation: string;
    nricNumber: string | null;
    finNumber: string | null;
  },
  fallbackCompany: { companyName: string | null; address: string | null } | null
) {
  const payPeriodStart = normalizePayPeriodDate(record.payPeriodStart);
  const payPeriodEnd = normalizePayPeriodDate(record.payPeriodEnd);
  const { month, year } = resolvePayrollMonthYearFromRecord({
    payrollMonth: record.payrollMonth,
    payrollYear: record.payrollYear,
    payPeriodStart,
  });

  const payslipData = buildPayslipFromProcessedRecord(
    record,
    config,
    employee,
    null,
    month,
    year,
    payPeriodStart,
    payPeriodEnd,
    { historicalOnly: true }
  );
  const pdfBuffer = await generatePayslipPdf(payslipData);
  await savePayslipPdf(payslipData, pdfBuffer);
  const downloadFilename = getPayslipDownloadFileName(
    payslipData.employeeName || employee.name,
    month,
    year
  );
  return { pdfBuffer, downloadFilename, payslipData };
}

export async function processIndividualPayroll(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;

    if (!user?.id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      payrollConfigId,
      payPeriodStart,
      payPeriodEnd,
      overtimeHours = 0,
      notes = '',
      forceOverwrite = false,
    } = req.body as {
      payrollConfigId?: number;
      payPeriodStart?: string;
      payPeriodEnd?: string;
      overtimeHours?: number;
      notes?: string;
      forceOverwrite?: boolean;
    };

    const payrollConfigIdNum = Number(payrollConfigId);
    if (!payrollConfigIdNum || !payPeriodStart || !payPeriodEnd) {
      return res.status(400).json({
        message: 'payrollConfigId, payPeriodStart, and payPeriodEnd are required',
      });
    }

    const normalizedPayPeriodStart = normalizePayPeriodDate(payPeriodStart);
    const normalizedPayPeriodEnd = normalizePayPeriodDate(payPeriodEnd);

    if (!normalizedPayPeriodStart || !normalizedPayPeriodEnd) {
      return res.status(400).json({ message: 'Invalid pay period dates' });
    }

    if (normalizedPayPeriodEnd < normalizedPayPeriodStart) {
      return res.status(400).json({
        message: 'Pay period end must be on or after pay period start',
      });
    }

    const ctx = await resolvePayslipContext(req, payrollConfigIdNum);
    if ('error' in ctx && ctx.error) {
      return res.status(ctx.error.status).json(ctx.error.body);
    }

    const { config, employee, company } = ctx as Exclude<typeof ctx, { error: unknown }>;
    const effectiveTenantId =
      tenant?.id || user?.tenantId || config.tenantId || employee.tenantId;

    if (!effectiveTenantId) {
      return res.status(400).json({ message: 'Tenant context not found' });
    }

    const [fullConfig] = await db
      .select()
      .from(employeePayroll)
      .where(eq(employeePayroll.id, payrollConfigIdNum));

    if (!fullConfig) {
      return res.status(404).json({ message: 'Payroll configuration not found' });
    }

    const [fullEmployee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, config.employeeId));

    if (!fullEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const forceOverwriteFlag = parseForceOverwriteFlag(forceOverwrite);

    await syncPayrollConfigsWithCompanySalaries(fullEmployee, user.id);

    const { month: payrollMonth, year: payrollYear } = derivePayrollMonthYear(
      normalizedPayPeriodStart
    );
    const currentCompanyIds = await getCurrentEmployeeCompanyIds(fullEmployee.id);

    if (currentCompanyIds.length > 0) {
      await reconcilePayrollRecordsBeforeProcessing(
        fullEmployee.id,
        payrollYear,
        payrollMonth,
        currentCompanyIds,
        forceOverwriteFlag
      );
    }

    const configsToProcess = await resolvePayrollConfigsForProcessing(
      fullEmployee.id,
      effectiveTenantId
    );

    if (configsToProcess.length === 0) {
      return res.status(400).json({
        message:
          'No active payroll configuration found for this employee\'s current companies. Please save payroll config first.',
      });
    }

    const result = await db.transaction(async () => {
      let primaryResult: Awaited<ReturnType<typeof upsertPayrollRecord>> | null = null;

      for (const configRow of configsToProcess) {
        const upsertResult = await upsertPayrollRecord(
          configRow,
          fullEmployee,
          normalizedPayPeriodStart,
          normalizedPayPeriodEnd,
          user.id,
          effectiveTenantId,
          {
            notes,
            overtimeHours: Number(overtimeHours) || 0,
            allowReprocess: true,
            forceUpdate: forceOverwriteFlag,
            requireForceForReprocess: true,
          }
        );

        if (Number(configRow.id) === payrollConfigIdNum) {
          primaryResult = upsertResult;
        } else if (!primaryResult && upsertResult.action !== "skipped") {
          primaryResult = upsertResult;
        } else if (!primaryResult) {
          primaryResult = upsertResult;
        }
      }

      return primaryResult ?? { action: "skipped" as const, reason: "already_processed" as const };
    });

    if (result.action === 'skipped') {
      const dataChanged = result.reason === 'data_changed';
      const { monthLabel } = derivePayrollMonthYear(normalizedPayPeriodStart);
      return res.status(409).json({
        alreadyProcessed: true,
        dataChanged,
        message: dataChanged
          ? `Payroll for ${monthLabel} has already been processed. The payroll values have been modified.`
          : `Payroll for ${monthLabel} has already been processed. There are no changes to process.`,
        action: 'skipped',
        record: result.record,
      });
    }

    if (!result.record) {
      return res.status(500).json({ message: 'Failed to process payroll' });
    }

    const { month, year } = resolvePayrollMonthYearFromRecord({
      payrollMonth: result.record.payrollMonth,
      payrollYear: result.record.payrollYear,
      payPeriodStart: normalizePayPeriodDate(result.record.payPeriodStart),
    });

    const payslipDataList = await buildPayslipDataListForMonth(
      fullConfig,
      {
        id: fullEmployee.id,
        employeeId: fullEmployee.employeeId,
        name: fullEmployee.name,
        department: fullEmployee.department,
        designation: fullEmployee.designation,
        nricNumber: fullEmployee.nricNumber,
        finNumber: fullEmployee.finNumber,
        dateOfBirth: fullEmployee.dateOfBirth,
        nationality: fullEmployee.nationality,
        prStatus: fullEmployee.prStatus,
        joinDate: fullEmployee.joinDate,
      },
      company,
      year,
      month,
      user?.id || 0,
      { storedOnly: true }
    );

    if (payslipDataList.length === 0) {
      return res.status(500).json({
        message: 'Payroll was saved but payslip snapshot could not be loaded. Please download again from the payroll page.',
      });
    }

    let combined;
    try {
      combined = await generateCombinedPayslipFileFromDataList(
        payslipDataList,
        payslipDataList[0]?.employeeName?.trim() || employee.name
      );
    } catch (pdfError) {
      console.error('Error generating payslip PDF after payroll processing:', pdfError);
      return res.status(500).json({
        message:
          pdfError instanceof Error
            ? `Failed to generate payslip PDF: ${pdfError.message}`
            : 'Failed to generate payslip PDF.',
      });
    }

    if (!combined) {
      return res.status(500).json({ message: 'Failed to generate payslip PDF.' });
    }

    res.setHeader('X-Payroll-Action', result.action);
    sendPdfBuffer(res, combined.pdfBuffer, combined.downloadFilename);
  } catch (error) {
    console.error('Error processing individual payroll:', error);
    const message = error instanceof Error ? error.message : 'Failed to process payroll';
    res.status(500).json({ message });
  }
}

export async function batchProcessPayroll(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;

    if (!user?.id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { payPeriodStart, payPeriodEnd, year, month, payrollConfigIds, forceOverwrite = false, processScope } = req.body as {
      payPeriodStart?: string;
      payPeriodEnd?: string;
      year?: number;
      month?: number;
      payrollConfigIds?: number[];
      forceOverwrite?: boolean;
      processScope?: "pending" | "changed";
    };

    let resolvedPayPeriodStart = normalizePayPeriodDate(payPeriodStart);
    let resolvedPayPeriodEnd = normalizePayPeriodDate(payPeriodEnd);

    if (!resolvedPayPeriodStart || !resolvedPayPeriodEnd) {
      const yearNum = Number(year);
      const monthNum = Number(month);
      if (!yearNum || !monthNum || monthNum < 1 || monthNum > 12) {
        return res.status(400).json({
          message: 'Pay period start/end or valid year and month are required',
        });
      }
      const derived = getPayPeriodForMonth(yearNum, monthNum);
      resolvedPayPeriodStart = derived.payPeriodStart;
      resolvedPayPeriodEnd = derived.payPeriodEnd;
    }

    if (resolvedPayPeriodEnd < resolvedPayPeriodStart) {
      return res.status(400).json({
        message: 'Pay period end must be on or after pay period start',
      });
    }

    const effectiveTenantId = tenant?.id || user?.tenantId || null;

    let configs = effectiveTenantId
      ? await db
          .select()
          .from(employeePayroll)
          .where(
            and(
              eq(employeePayroll.isActive, true),
              eq(employeePayroll.tenantId, effectiveTenantId)
            )
          )
      : await db
          .select()
          .from(employeePayroll)
          .where(eq(employeePayroll.isActive, true));

    if (Array.isArray(payrollConfigIds) && payrollConfigIds.length > 0) {
      const idSet = new Set(payrollConfigIds.map(Number));
      configs = configs.filter((config) => idSet.has(config.id));
    }

    if (configs.length === 0) {
      return res.status(400).json({ message: 'No active payroll configurations to process' });
    }

    const forceOverwriteFlag = parseForceOverwriteFlag(forceOverwrite);
    const { month: batchMonth, year: batchYear } = derivePayrollMonthYear(resolvedPayPeriodStart);
    const uniqueEmployeeIds = [...new Set(configs.map((config) => config.employeeId))];
    const validConfigIdSet = new Set<number>();

    for (const employeeId of uniqueEmployeeIds) {
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId));

      if (!employee) continue;

      const tenantId = effectiveTenantId || employee.tenantId || null;
      if (!tenantId) continue;

      await syncPayrollConfigsWithCompanySalaries(employee, user.id);
      const currentCompanyIds = await getCurrentEmployeeCompanyIds(employeeId);

      if (currentCompanyIds.length > 0) {
        await reconcilePayrollRecordsBeforeProcessing(
          employeeId,
          batchYear,
          batchMonth,
          currentCompanyIds,
          forceOverwriteFlag
        );
      }

      const resolvedConfigs = await resolvePayrollConfigsForProcessing(employeeId, tenantId);
      for (const resolved of resolvedConfigs) {
        validConfigIdSet.add(resolved.id);
      }
    }

    configs = configs.filter((config) => validConfigIdSet.has(config.id));

    if (configs.length === 0) {
      return res.status(400).json({
        message: 'No payroll configurations match the current company assignments for selected employees.',
      });
    }

    const pendingConfigs: typeof configs = [];
    const changedConfigs: typeof configs = [];

    for (const config of configs) {
      const existing = await findPayrollRecordForPeriod(
        config.employeeId,
        resolvedPayPeriodStart,
        resolvedPayPeriodEnd,
        config.companyId
      );
      if (!existing) {
        pendingConfigs.push(config);
        continue;
      }
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, config.employeeId));
      if (
        employee &&
        hasPayrollInputsChanged(
          config,
          employee,
          existing,
          resolvedPayPeriodStart,
          resolvedPayPeriodEnd,
          0
        )
      ) {
        changedConfigs.push(config);
      }
    }

    const buildStatusSummary = (): BatchPayrollSummary => ({
      totalEmployees: configs.length,
      processedNew: 0,
      updated: 0,
      skipped: configs.length - pendingConfigs.length - changedConfigs.length,
      failures: [],
    });

    if (!processScope && !forceOverwriteFlag) {
      if (pendingConfigs.length > 0) {
        return res.json({
          needsPendingConfirmation: true,
          scenario: 'pending',
          message:
            'Payroll for the selected period has not been processed for some employees. Do you want to process payroll for all pending employees?',
          summary: buildStatusSummary(),
        });
      }

      if (changedConfigs.length > 0) {
        return res.json({
          needsOverwriteConfirmation: true,
          scenario: 'values-changed',
          alreadyProcessed: true,
          message:
            'Payroll for the selected period has already been processed. Payroll values have been modified for one or more employees. Do you want to overwrite the existing payslips and regenerate them?',
          summary: buildStatusSummary(),
        });
      }

      return res.json({
        needsOverwriteConfirmation: true,
        scenario: 'no-changes',
        alreadyProcessed: true,
        message:
          'Payroll for the selected period has already been processed. Do you want to overwrite the existing payslips and regenerate them?',
        summary: buildStatusSummary(),
      });
    }

    let configsToProcess: typeof configs = [];
    let useForceUpdate = forceOverwriteFlag;

    if (forceOverwriteFlag) {
      configsToProcess = configs;
      useForceUpdate = true;
    } else if (processScope === 'pending') {
      configsToProcess = pendingConfigs;
      useForceUpdate = false;
    } else if (processScope === 'changed') {
      configsToProcess = changedConfigs;
      useForceUpdate = true;
    } else {
      configsToProcess = [...pendingConfigs, ...changedConfigs];
    }

    if (configsToProcess.length === 0) {
      return res.json({
        needsOverwriteConfirmation: true,
        scenario: 'no-changes',
        alreadyProcessed: true,
        message:
          'Payroll for the selected period has already been processed. Do you want to overwrite the existing payslips and regenerate them?',
        summary: buildStatusSummary(),
      });
    }

    const summary: BatchPayrollSummary = {
      totalEmployees: configs.length,
      processedNew: 0,
      updated: 0,
      skipped: configs.length - configsToProcess.length,
      failures: [],
    };

    const processedConfigIds = new Set<number>();

    for (const config of configsToProcess) {
      const employeeName =
        (
          await db
            .select({ name: employees.name })
            .from(employees)
            .where(eq(employees.id, config.employeeId))
            .limit(1)
        )[0]?.name || `Employee ${config.employeeId}`;

      try {
        const [employee] = await db
          .select()
          .from(employees)
          .where(eq(employees.id, config.employeeId));

        if (!employee) {
          summary.failures.push({
            employeeName,
            message: 'Employee not found',
          });
          continue;
        }

        const tenantId =
          effectiveTenantId || config.tenantId || employee.tenantId || null;

        if (!tenantId) {
          summary.failures.push({
            employeeName,
            message: 'Tenant context not found',
          });
          continue;
        }

        const result = await db.transaction(async () =>
          upsertPayrollRecord(
            config,
            employee,
            resolvedPayPeriodStart,
            resolvedPayPeriodEnd,
            user.id,
            tenantId,
            {
              notes: 'Batch processed payroll',
              allowReprocess: true,
              forceUpdate: useForceUpdate,
              requireForceForReprocess: processScope === 'changed',
            }
          )
        );

        if (result.action === 'skipped') {
          summary.skipped++;
          continue;
        }

        if (!result.record) {
          summary.failures.push({
            employeeName,
            message: 'Failed to save payroll record',
          });
          continue;
        }

        processedConfigIds.add(config.id);

        if (result.action === 'created') {
          summary.processedNew++;
        } else if (result.action === 'updated') {
          summary.updated++;
        }
      } catch (error) {
        summary.failures.push({
          employeeName,
          message: error instanceof Error ? error.message : 'Processing failed',
        });
      }
    }

    const zipFiles: { filename: string; buffer: Buffer }[] = [];

    for (const config of configs.filter((item) => processedConfigIds.has(item.id))) {
      const employeeName =
        (
          await db
            .select({ name: employees.name })
            .from(employees)
            .where(eq(employees.id, config.employeeId))
            .limit(1)
        )[0]?.name || `Employee ${config.employeeId}`;

      try {
        const record = await findPayrollRecordForPeriod(
          config.employeeId,
          resolvedPayPeriodStart,
          resolvedPayPeriodEnd
        );
        if (!record) {
          continue;
        }

        const ctx = await resolvePayslipContext(req, config.id);
        if ('error' in ctx && ctx.error) {
          summary.failures.push({
            employeeName,
            message: 'Failed to resolve payslip context',
          });
          continue;
        }

        const { config: payslipConfig, employee: payslipEmployee, company } = ctx as Exclude<
          typeof ctx,
          { error: unknown }
        >;

        const { month, year } = resolvePayrollMonthYearFromRecord({
          payrollMonth: record.payrollMonth,
          payrollYear: record.payrollYear,
          payPeriodStart: normalizePayPeriodDate(record.payPeriodStart),
        });

        const { generatedFiles } = await generatePayslipFilesForMonths(
          payslipConfig,
          payslipEmployee,
          company,
          year,
          [month],
          user?.id || 0
        );

        if (generatedFiles.length === 0) {
          continue;
        }

        const file = generatedFiles[0];
        zipFiles.push({ filename: file.downloadFilename, buffer: file.buffer });
      } catch (error) {
        summary.failures.push({
          employeeName,
          message: error instanceof Error ? error.message : 'Failed to generate payslip',
        });
      }
    }

    if (zipFiles.length === 0) {
      return res.status(409).json({
        message: `No payslips generated. ${summary.skipped} employee(s) skipped.`,
        summary,
      });
    }

    const zipFilename = getBatchPayslipZipFileName(resolvedPayPeriodStart);
    const zipPath = await createPayslipZipArchive(zipFiles);
    const sessionId = (req as any).session?.id as string | undefined;
    if (sessionId) {
      registerSessionPayslipZip(sessionId, zipPath);
    }

    res.setHeader('X-Payroll-Summary', JSON.stringify(summary));
    sendPayslipZipFile(res, zipPath, zipFilename, sessionId);
  } catch (error) {
    console.error('Error in batch payroll processing:', error);
    const message = error instanceof Error ? error.message : 'Failed to batch process payroll';
    res.status(500).json({ message });
  }
}

// Create and export the payroll router
export function createPayrollRouter() {
  const router = Router();

  // Payroll configuration routes
  router.get('/configs', getEmployeePayrollConfigs);
  router.post('/configs/batch', batchSaveEmployeePayrollConfigs);
  router.post('/configs', createEmployeePayrollConfig);
  router.put('/configs/:id', updateEmployeePayrollConfig);
  router.delete('/configs/:id', deleteEmployeePayrollConfig);

  // Payroll records routes
  router.get('/records', getPayrollRecords);
  router.post('/records', createPayrollRecord);
  router.put('/records/:id/status', updatePayrollRecordStatus);
  router.post('/process/individual', processIndividualPayroll);
  router.post('/process/batch', batchProcessPayroll);

  // Payroll summary route
  router.get('/summary', getPayrollSummary);

  // Payroll preview calculation route
  router.post('/calculate', previewPayrollCalculation);

  // Payslip routes
  router.post('/payslips/preview', previewPayslip);
  router.post('/payslips/view', viewPayslip);
  router.post('/payslips/download', downloadPayslips);

  return router;
}

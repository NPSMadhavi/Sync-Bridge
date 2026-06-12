import { Request, Response, Router } from 'express';
import { db } from './db';
import { employeePayroll, payrollRecords, employees, tenants, companies } from '@shared/schema';
import { and, eq, desc, gte, lte, sql } from 'drizzle-orm';
import { insertEmployeePayrollSchema, insertPayrollRecordSchema } from '@shared/schema';
import { sendEmail } from './email';
import dayjs from 'dayjs';
import { calculateSingaporePayroll } from './singapore-payroll-calculator';
import {
  generatePayslipPdf,
  savePayslipPdf,
  getPayslipDownloadFileName,
  type PayslipData,
} from './payslip-generator';
import {
  createPayslipZipArchive,
  getPayslipZipFileName,
  registerSessionPayslipZip,
  sendPayslipZipFile,
} from './payslip-zip';

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
        employeeName: employees.name,
        department: employees.department,
        designation: employees.designation,
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
      .leftJoin(employees, eq(employeePayroll.employeeId, employees.id));

    const effectiveTenantId = tenant?.id || user?.tenantId || null;
    // Apply tenant filter based on user role
    if (user?.role === 'super_admin' || user?.isSuperAdmin || user?.role === 'admin') {
      if (effectiveTenantId) {
        query = query.where(eq(employeePayroll.tenantId, effectiveTenantId));
      }
      // If no tenant, fetch all (global access for super admin)
    } else {
      if (!effectiveTenantId) {
        return res.status(400).json({ message: 'Tenant context required for regular users' });
      }
      query = query.where(eq(employeePayroll.tenantId, effectiveTenantId));
    }

    const configs = await query.orderBy(desc(employeePayroll.createdAt));
    res.json(configs);
  } catch (error) {
    console.error('Error fetching employee payroll configs:', error);
    res.status(500).json({ message: 'Failed to fetch employee payroll configurations' });
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
    if (!effectiveTenantId && !(user?.role === 'super_admin' || user?.isSuperAdmin || user?.role === 'admin')) {
      return res.status(401).json({ message: 'Tenant context not found' });
    }
    
    // Ensure all numeric fields are properly converted to numbers
    const bodyPayload = {
      ...req.body,
      createdBy: user.id,
      baseSalary: Number(req.body.baseSalary),
      hourlyRate: req.body.hourlyRate ? Number(req.body.hourlyRate) : null,
      overtimeRate: req.body.overtimeRate ? Number(req.body.overtimeRate) : null,
      noOfWorkingDays: Number(req.body.noOfWorkingDays),
      taxRate: req.body.taxRate ? Number(req.body.taxRate) : 0,
      cpfRate: req.body.cpfRate ? Number(req.body.cpfRate) : 20,
      allowances: req.body.allowances || {},
      deductions: req.body.deductions || {},
      // Convert empty strings to null for optional date field
      effectiveTo: req.body.effectiveTo && req.body.effectiveTo.trim() !== '' ? req.body.effectiveTo : null,
    };

    // Parse without tenantId so null doesn't fail the notNull schema check
    const validatedData = insertEmployeePayrollSchema.omit({ tenantId: true }).parse(bodyPayload);

    // Resolve tenantId — for super_admin with no tenant context, derive from the employee
    // or fall back to the first available tenant in the system
    let resolvedTenantId = effectiveTenantId;
    if (!resolvedTenantId) {
      const [emp] = await db.select({ tenantId: employees.tenantId })
        .from(employees)
        .where(eq(employees.id, validatedData.employeeId));
      resolvedTenantId = emp?.tenantId ?? null;
    }
    if (!resolvedTenantId) {
      // Super_admin fallback: use the first tenant in the system
      const [firstTenant] = await db.select({ id: tenants.id }).from(tenants).limit(1);
      resolvedTenantId = firstTenant?.id ?? null;
    }
    if (!resolvedTenantId) {
      return res.status(400).json({ message: 'No tenant found. Please create a tenant first.' });
    }

    // Check if active payroll config already exists for this employee
    const existingConfig = await db
      .select()
      .from(employeePayroll)
      .where(
        and(
          eq(employeePayroll.tenantId, resolvedTenantId),
          eq(employeePayroll.employeeId, validatedData.employeeId),
          eq(employeePayroll.isActive, true)
        )
      );

    if (existingConfig.length > 0) {
      return res.status(400).json({ 
        message: 'Active payroll configuration already exists for this employee' 
      });
    }

    const [newConfig] = await db
      .insert(employeePayroll)
      .values({ ...validatedData, tenantId: resolvedTenantId })
      .returning();

    res.status(201).json(newConfig);
  } catch (error) {
    console.error('Error creating employee payroll config:', error);
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

    if (req.body.baseSalary !== undefined) updateData.baseSalary = String(num(req.body.baseSalary) ?? req.body.baseSalary);
    if (req.body.payrollPeriod !== undefined) updateData.payrollPeriod = req.body.payrollPeriod;
    if (req.body.noOfWorkingDays !== undefined) updateData.noOfWorkingDays = Math.trunc(Number(req.body.noOfWorkingDays));
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
        employeeName: employees.name,
        department: employees.department,
        designation: employees.designation,
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
        status: payrollRecords.status,
        paymentDate: payrollRecords.paymentDate,
        notes: payrollRecords.notes,
        createdAt: payrollRecords.createdAt,
        updatedAt: payrollRecords.updatedAt,
      })
      .from(payrollRecords)
      .leftJoin(employees, eq(payrollRecords.employeeId, employees.id));

    const effectiveTenantId = tenant?.id || user?.tenantId || null;
    // Apply tenant filter based on user role
    let conditions = [];
    if (user?.role === 'super_admin' || user?.isSuperAdmin || user?.role === 'admin') {
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
      notes = ''
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

    // Use Singapore payroll calculator (CPF only — tax not deducted)
    const calculationResult = calculateSingaporePayroll({
      grossSalary: Number(baseSalary),
      age: employee.age || 25,
      citizenshipStatus: employee.nationality?.toLowerCase().includes('singapore') ? 'citizen' : 
                        employee.nationality?.toLowerCase().includes('pr') ? 'pr' : 'foreigner',
      cpfStatus: 'ordinary',
      monthlyAllowances: allowances || {},
      monthlyDeductions: deductions || {},
      overtimeHours: Number(overtimeHours) || 0,
      overtimeRate: Number(overtimePay) / (Number(overtimeHours) || 1) || 0,
    });
    
    // Tax reference (not applied): calculationResult.monthlyTaxDeduction
    const calculatedTaxDeduction = 0;
    const calculatedCpfDeduction = calculationResult.employeeCpf;

    // Ensure all numeric fields are properly converted to numbers
    const payload = {
      tenantId: resolvedTenantId,
      employeeId: Number(employeeId),
      payrollConfigId: Number(payrollConfigId),
      payPeriodStart,
      payPeriodEnd,
      baseSalary: Number(baseSalary),
      overtimeHours: Number(overtimeHours),
      overtimePay: Number(overtimePay),
      allowances: allowances || {},
      deductions: deductions || {},
      grossPay: Number(grossPay),
      taxDeduction: calculatedTaxDeduction,
      cpfDeduction: calculatedCpfDeduction,
      netPay: Number(netPay),
      status: 'pending',
      notes: notes || '',
      createdBy: user.id,
    };

    const validatedData = insertPayrollRecordSchema.omit({ tenantId: true }).parse({
      ...payload,
      tenantId: undefined,
    });

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

    res.status(201).json(newRecord);
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
    if (user?.role === 'super_admin' || user?.isSuperAdmin || user?.role === 'admin') {
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
    if (user?.role === 'super_admin' || user?.isSuperAdmin || user?.role === 'admin') {
      if (effectiveTenantId) {
        payrollConditions.push(eq(payrollRecords.tenantId, effectiveTenantId));
      }
      // If no tenant, fetch all (global access for super admin)
    } else {
      if (effectiveTenantId) {
        payrollConditions.push(eq(payrollRecords.tenantId, effectiveTenantId));
      }
    }

    // Add date filters if provided
    if (month && year) {
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
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
      age: Number(age) || 25,
      citizenshipStatus: citizenshipStatus || 'citizen',
      prYear: req.body.prYear ?? null,
      monthlyAllowances: monthlyAllowances || {},
      monthlyDeductions: monthlyDeductions || {},
      overtimeHours: Number(overtimeHours) || 0,
      overtimeRate: Number(overtimeRate) || 0,
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

function buildPayslipFromProcessedRecord(
  record: {
    payPeriodStart: string;
    payPeriodEnd: string;
    baseSalary: string | number;
    overtimePay: string | number | null;
    allowances: Record<string, number> | null;
    deductions: Record<string, number> | null;
    grossPay: string | number;
    cpfDeduction: string | number | null;
    netPay: string | number;
  },
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
  payPeriodEnd: string
): PayslipData {
  return {
    companyName: company?.companyName || '',
    companyAddress: company?.address || '',
    employeeName: employee.name,
    employeeDbId: employee.id,
    employeeCode: employee.employeeId,
    icNo: employee.nricNumber || employee.finNumber || '',
    department: employee.department,
    jobTitle: employee.designation,
    month,
    year,
    payPeriodStart,
    payPeriodEnd,
    basicRate: parseFloat(String(record.baseSalary)),
    workingDays: config.noOfWorkingDays,
    basicPay: parseFloat(String(record.baseSalary)),
    overtime: parseFloat(String(record.overtimePay || 0)),
    allowance: sumJsonValues(record.allowances),
    grossPay: parseFloat(String(record.grossPay)),
    employeeCpf: parseFloat(String(record.cpfDeduction || 0)),
    netPay: parseFloat(String(record.netPay)),
    employerCpf: parseFloat(String(config.employerCpfAmount || 0)),
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
    .select({
      id: employeePayroll.id,
      employeeId: employeePayroll.employeeId,
      noOfWorkingDays: employeePayroll.noOfWorkingDays,
      employerCpfAmount: employeePayroll.employerCpfAmount,
      tenantId: employeePayroll.tenantId,
    })
    .from(employeePayroll)
    .where(eq(employeePayroll.id, payrollConfigIdNum));

  if (!config) {
    return { error: { status: 404, body: { message: 'Payroll configuration not found' } } };
  }

  if (
    effectiveTenantId &&
    config.tenantId !== effectiveTenantId &&
    !(user?.role === 'super_admin' || user?.isSuperAdmin || user?.role === 'admin')
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
    })
    .from(employees)
    .where(eq(employees.id, config.employeeId));

  if (!employee) {
    return { error: { status: 404, body: { message: 'Employee not found' } } };
  }

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

  if (!company?.companyName) {
    const tenantIdForLookup = config.tenantId || employee.tenantId;
    if (tenantIdForLookup) {
      const [tenantCompany] = await db
        .select({
          companyName: companies.companyName,
          address: companies.address,
        })
        .from(companies)
        .where(eq(companies.tenantId, tenantIdForLookup))
        .limit(1);
      if (tenantCompany) {
        company = tenantCompany;
      }
    }
  }

  if (!company?.companyName) {
    const tenantIdForLookup = config.tenantId || employee.tenantId;
    if (tenantIdForLookup) {
      const [tenantRow] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenantIdForLookup));
      if (tenantRow) {
        company = { companyName: tenantRow.name, address: company?.address || '' };
      }
    }
  }

  return { config, employee, company };
}

async function generatePayslipFilesForMonths(
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
  company: { companyName: string | null; address: string | null } | null,
  yearNum: number,
  validMonths: number[]
): Promise<{ generatedFiles: GeneratedPayslipFile[]; missingMonths: string[] }> {
  const generatedFiles: GeneratedPayslipFile[] = [];
  const missingMonths: string[] = [];

  for (const month of validMonths) {
    const monthStart = `${yearNum}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = dayjs(monthStart).endOf('month').format('YYYY-MM-DD');

    const [record] = await db
      .select({
        payPeriodStart: payrollRecords.payPeriodStart,
        payPeriodEnd: payrollRecords.payPeriodEnd,
        baseSalary: payrollRecords.baseSalary,
        overtimePay: payrollRecords.overtimePay,
        allowances: payrollRecords.allowances,
        deductions: payrollRecords.deductions,
        grossPay: payrollRecords.grossPay,
        cpfDeduction: payrollRecords.cpfDeduction,
        netPay: payrollRecords.netPay,
      })
      .from(payrollRecords)
      .where(
        and(
          eq(payrollRecords.employeeId, config.employeeId),
          sql`${payrollRecords.payPeriodStart}::date <= ${monthEnd}::date`,
          sql`${payrollRecords.payPeriodEnd}::date >= ${monthStart}::date`
        )
      )
      .orderBy(desc(payrollRecords.createdAt))
      .limit(1);

    if (!record) {
      missingMonths.push(`${MONTH_NAMES[month - 1]} ${yearNum}`);
      continue;
    }

    const payslipData = buildPayslipFromProcessedRecord(
      record,
      config,
      employee,
      company,
      month,
      yearNum,
      monthStart,
      monthEnd
    );

    const pdfBuffer = await generatePayslipPdf(payslipData);
    const saved = await savePayslipPdf(payslipData, pdfBuffer);
    const downloadFilename = getPayslipDownloadFileName(employee.name, month, yearNum);

    generatedFiles.push({
      filename: saved.filename,
      downloadFilename,
      month,
      monthLabel: MONTH_NAMES[month - 1],
      downloadUrl: `/${saved.relativePath.replace(/\\/g, '/')}`,
      relativePath: saved.relativePath,
      buffer: pdfBuffer,
    });
  }

  return { generatedFiles, missingMonths };
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
    const { generatedFiles, missingMonths } = await generatePayslipFilesForMonths(
      config,
      employee,
      company,
      yearNum,
      [monthNum]
    );

    if (generatedFiles.length === 0) {
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
    const { generatedFiles, missingMonths } = await generatePayslipFilesForMonths(
      config,
      employee,
      company,
      yearNum,
      validMonths
    );

    if (generatedFiles.length === 0) {
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

// Create and export the payroll router
export function createPayrollRouter() {
  const router = Router();

  // Payroll configuration routes
  router.get('/configs', getEmployeePayrollConfigs);
  router.post('/configs', createEmployeePayrollConfig);
  router.put('/configs/:id', updateEmployeePayrollConfig);
  router.delete('/configs/:id', deleteEmployeePayrollConfig);

  // Payroll records routes
  router.get('/records', getPayrollRecords);
  router.post('/records', createPayrollRecord);
  router.put('/records/:id/status', updatePayrollRecordStatus);

  // Payroll summary route
  router.get('/summary', getPayrollSummary);

  // Payroll preview calculation route
  router.post('/calculate', previewPayrollCalculation);

  // Payslip routes
  router.post('/payslips/view', viewPayslip);
  router.post('/payslips/download', downloadPayslips);

  return router;
}

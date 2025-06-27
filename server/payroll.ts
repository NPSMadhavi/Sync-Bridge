import { Request, Response } from 'express';
import { db } from './db';
import { employeePayroll, payrollRecords, employees } from '@shared/schema';
import { and, eq, desc, gte, lte, sql } from 'drizzle-orm';
import { insertEmployeePayrollSchema, insertPayrollRecordSchema } from '@shared/schema';

// Get all employee payroll configurations
export async function getEmployeePayrollConfigs(req: Request, res: Response) {
  try {
    const tenantId = 1; // Default tenant for now
    
    const configs = await db
      .select({
        id: employeePayroll.id,
        employeeId: employeePayroll.employeeId,
        employeeName: employees.name,
        employeeEmail: employees.email,
        department: employees.department,
        designation: employees.designation,
        baseSalary: employeePayroll.baseSalary,
        payrollPeriod: employeePayroll.payrollPeriod,
        hourlyRate: employeePayroll.hourlyRate,
        overtimeRate: employeePayroll.overtimeRate,
        allowances: employeePayroll.allowances,
        deductions: employeePayroll.deductions,
        taxRate: employeePayroll.taxRate,
        cpfRate: employeePayroll.cpfRate,
        isActive: employeePayroll.isActive,
        effectiveFrom: employeePayroll.effectiveFrom,
        effectiveTo: employeePayroll.effectiveTo,
        createdAt: employeePayroll.createdAt,
        updatedAt: employeePayroll.updatedAt,
      })
      .from(employeePayroll)
      .leftJoin(employees, eq(employeePayroll.employeeId, employees.id))
      .where(eq(employeePayroll.tenantId, tenantId))
      .orderBy(desc(employeePayroll.createdAt));

    res.json(configs);
  } catch (error) {
    console.error('Error fetching employee payroll configs:', error);
    res.status(500).json({ message: 'Failed to fetch employee payroll configurations' });
  }
}

// Create employee payroll configuration
export async function createEmployeePayrollConfig(req: Request, res: Response) {
  try {
    const tenantId = 1; // Default tenant for now
    const userId = req.user?.id || 1; // Default user for now
    
    const validatedData = insertEmployeePayrollSchema.parse({
      ...req.body,
      tenantId,
      createdBy: userId,
    });

    // Check if active payroll config already exists for this employee
    const existingConfig = await db
      .select()
      .from(employeePayroll)
      .where(
        and(
          eq(employeePayroll.tenantId, tenantId),
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
      .values(validatedData)
      .returning();

    res.status(201).json(newConfig);
  } catch (error) {
    console.error('Error creating employee payroll config:', error);
    res.status(500).json({ message: 'Failed to create employee payroll configuration' });
  }
}

// Update employee payroll configuration
export async function updateEmployeePayrollConfig(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const tenantId = 1; // Default tenant for now
    const userId = req.user?.id || 1; // Default user for now

    const updateData = {
      ...req.body,
      updatedAt: new Date(),
    };

    const [updatedConfig] = await db
      .update(employeePayroll)
      .set(updateData)
      .where(
        and(
          eq(employeePayroll.id, parseInt(id)),
          eq(employeePayroll.tenantId, tenantId)
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

// Get payroll records
export async function getPayrollRecords(req: Request, res: Response) {
  try {
    const tenantId = 1; // Default tenant for now
    const { employeeId, status, startDate, endDate } = req.query;

    let query = db
      .select({
        id: payrollRecords.id,
        employeeId: payrollRecords.employeeId,
        employeeName: employees.name,
        employeeEmail: employees.email,
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
      .leftJoin(employees, eq(payrollRecords.employeeId, employees.id))
      .where(eq(payrollRecords.tenantId, tenantId));

    // Apply filters
    const conditions = [eq(payrollRecords.tenantId, tenantId)];
    
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
      .where(and(...conditions))
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
    const tenantId = 1; // Default tenant for now
    const userId = req.user?.id || 1; // Default user for now
    
    // Calculate payroll automatically
    const { employeeId, payPeriodStart, payPeriodEnd, overtimeHours = 0 } = req.body;
    
    // Get employee payroll configuration
    const [config] = await db
      .select()
      .from(employeePayroll)
      .where(
        and(
          eq(employeePayroll.tenantId, tenantId),
          eq(employeePayroll.employeeId, employeeId),
          eq(employeePayroll.isActive, true)
        )
      );

    if (!config) {
      return res.status(400).json({ 
        message: 'No active payroll configuration found for this employee' 
      });
    }

    // Calculate payroll amounts
    const baseSalary = parseFloat(config.baseSalary);
    const overtimeRate = parseFloat(config.overtimeRate || '0');
    const taxRate = parseFloat(config.taxRate || '0');
    const cpfRate = parseFloat(config.cpfRate || '20');
    
    const overtimePay = overtimeHours * overtimeRate;
    
    // Calculate allowances total
    const allowancesTotal = Object.values(config.allowances || {}).reduce(
      (sum, amount) => sum + (amount as number), 0
    );
    
    // Calculate deductions total
    const deductionsTotal = Object.values(config.deductions || {}).reduce(
      (sum, amount) => sum + (amount as number), 0
    );
    
    const grossPay = baseSalary + overtimePay + allowancesTotal;
    const taxDeduction = (grossPay * taxRate) / 100;
    const cpfDeduction = (grossPay * cpfRate) / 100;
    const netPay = grossPay - taxDeduction - cpfDeduction - deductionsTotal;

    const validatedData = insertPayrollRecordSchema.parse({
      tenantId,
      employeeId,
      payrollConfigId: config.id,
      payPeriodStart,
      payPeriodEnd,
      baseSalary: baseSalary.toString(),
      overtimeHours: overtimeHours.toString(),
      overtimePay: overtimePay.toString(),
      allowances: config.allowances || {},
      deductions: config.deductions || {},
      grossPay: grossPay.toString(),
      taxDeduction: taxDeduction.toString(),
      cpfDeduction: cpfDeduction.toString(),
      netPay: netPay.toString(),
      status: 'draft',
      notes: req.body.notes,
      createdBy: userId,
    });

    const [newRecord] = await db
      .insert(payrollRecords)
      .values(validatedData)
      .returning();

    res.status(201).json(newRecord);
  } catch (error) {
    console.error('Error creating payroll record:', error);
    res.status(500).json({ message: 'Failed to create payroll record' });
  }
}

// Update payroll record status
export async function updatePayrollRecordStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const tenantId = 1; // Default tenant for now
    const userId = req.user?.id || 1; // Default user for now

    const updateData: any = {
      status,
      notes,
      updatedAt: new Date(),
    };

    // If approving, add approval details
    if (status === 'approved') {
      updateData.approvedBy = userId;
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
          eq(payrollRecords.tenantId, tenantId)
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
    const tenantId = 1; // Default tenant for now
    const { month, year } = req.query;
    
    // Get total employees with payroll configs
    const totalEmployees = await db
      .select({ count: sql<number>`count(*)` })
      .from(employeePayroll)
      .where(
        and(
          eq(employeePayroll.tenantId, tenantId),
          eq(employeePayroll.isActive, true)
        )
      );

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
      .from(payrollRecords)
      .where(eq(payrollRecords.tenantId, tenantId));

    // Add date filters if provided
    if (month && year) {
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
      payrollQuery = payrollQuery.where(
        and(
          eq(payrollRecords.tenantId, tenantId),
          gte(payrollRecords.payPeriodStart, startDate),
          lte(payrollRecords.payPeriodEnd, endDate)
        )
      );
    }

    const [summary] = await payrollQuery;

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
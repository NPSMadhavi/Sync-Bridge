import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'syncbridge',
  password: 'Welcome123',
  port: 5432,
});

const TENANT_SLUG = 'test-company'; // Change this if you want a different tenant

async function createPayrollConfigs() {
  try {
    // Get the tenant ID by slug
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', [TENANT_SLUG]);
    if (tenantResult.rows.length === 0) {
      console.warn(`No tenant found with slug '${TENANT_SLUG}'. Exiting.`);
      return;
    }
    const tenantId = tenantResult.rows[0].id;
    console.log('Using tenant ID:', tenantId);

    // Get all employees for this tenant
    const employeesResult = await pool.query('SELECT id, name, department, designation, tenant_id FROM employees WHERE tenant_id = $1', [tenantId]);
    const employees = employeesResult.rows;
    
    console.log('Found employees:', employees.length);
    employees.forEach(e => console.log(`Employee: id=${e.id}, name=${e.name}, tenantId=${e.tenant_id}`));

    // Create payroll configurations for each employee
    for (const employee of employees) {
      // Determine base salary based on department
      let baseSalary = 5000; // Default
      let overtimeRate = 15; // Default
      
      switch (employee.department.toLowerCase()) {
        case 'engineering':
          baseSalary = 8000;
          overtimeRate = 20;
          break;
        case 'hr':
          baseSalary = 7500;
          overtimeRate = 18;
          break;
        case 'sales':
          baseSalary = 6000;
          overtimeRate = 16;
          break;
        case 'marketing':
          baseSalary = 6500;
          overtimeRate = 17;
          break;
      }

      const payrollConfig = {
        employeeId: employee.id,
        baseSalary: baseSalary.toFixed(2),
        payrollPeriod: 'monthly',
        hourlyRate: (baseSalary / 160).toFixed(2), // Assuming 160 hours per month
        overtimeRate: overtimeRate.toFixed(2),
        allowances: JSON.stringify({
          transport: 300,
          meal: 200,
          phone: 100
        }),
        deductions: JSON.stringify({
          medical: 50,
          advance: 0
        }),
        taxRate: '10.00',
        cpfRate: '20.00',
        isActive: true,
        effectiveFrom: new Date().toISOString().split('T')[0],
        createdBy: 1 // Assuming user ID 1 exists
      };

      const result = await pool.query(
        `INSERT INTO employee_payroll (
          tenant_id, employee_id, base_salary, payroll_period, hourly_rate, 
          overtime_rate, allowances, deductions, tax_rate, cpf_rate, 
          is_active, effective_from, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()) RETURNING *`,
        [
          tenantId,
          payrollConfig.employeeId,
          payrollConfig.baseSalary,
          payrollConfig.payrollPeriod,
          payrollConfig.hourlyRate,
          payrollConfig.overtimeRate,
          payrollConfig.allowances,
          payrollConfig.deductions,
          payrollConfig.taxRate,
          payrollConfig.cpfRate,
          payrollConfig.isActive,
          payrollConfig.effectiveFrom,
          payrollConfig.createdBy
        ]
      );

      console.log('Created payroll config for:', {
        employeeName: employee.name,
        employeeId: employee.id,
        baseSalary: payrollConfig.baseSalary,
        department: employee.department,
        tenantId: tenantId
      });
    }

    console.log('Successfully created payroll configurations for', employees.length, 'employees');

  } catch (error) {
    console.error('Error creating payroll configurations:', error);
  } finally {
    await pool.end();
  }
}

createPayrollConfigs(); 
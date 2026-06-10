import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'syncbridge',
  password: 'Welcome123',
  port: 5432,
});

async function updateEmployees() {
  try {
    // Get the tenant ID
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', ['test-company']);
    const tenantId = tenantResult.rows[0].id;
    
    console.log('Using tenant ID:', tenantId);

    // Get all employees for this tenant
    const employeesResult = await pool.query('SELECT id, name, department FROM employees WHERE tenant_id = $1', [tenantId]);
    const employees = employeesResult.rows;
    
    console.log('Found employees:', employees.length);

    // Update employees with missing fields
    for (const employee of employees) {
      // Add visa type for payroll calculations
      const visaType = 'pr'; // Default to PR for Singapore payroll (closest to citizen)
      
      await pool.query(
        `UPDATE employees SET 
          visa_type = $1
        WHERE id = $2`,
        [visaType, employee.id]
      );

      console.log('Updated employee:', {
        id: employee.id,
        name: employee.name,
        department: employee.department,
        visaType
      });
    }

    console.log('Successfully updated', employees.length, 'employees');

  } catch (error) {
    console.error('Error updating employees:', error);
  } finally {
    await pool.end();
  }
}

updateEmployees(); 
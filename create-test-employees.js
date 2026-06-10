import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'syncbridge',
  password: 'Welcome123',
  port: 5432,
});

async function createTestEmployees() {
  try {
    // Get the tenant ID
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', ['test-company']);
    const tenantId = tenantResult.rows[0].id;
    
    console.log('Using tenant ID:', tenantId);

    // Create test employees
    const employees = [
      {
        employeeId: 'EMP001',
        name: 'John Doe',
        department: 'Engineering',
        designation: 'Senior Developer',
        joinDate: '2023-01-15',
        status: 'active'
      },
      {
        employeeId: 'EMP002',
        name: 'Jane Smith',
        department: 'HR',
        designation: 'HR Manager',
        joinDate: '2023-02-01',
        status: 'active'
      },
      {
        employeeId: 'EMP003',
        name: 'Mike Johnson',
        department: 'Sales',
        designation: 'Sales Executive',
        joinDate: '2023-03-10',
        status: 'active'
      },
      {
        employeeId: 'EMP004',
        name: 'Sarah Wilson',
        department: 'Marketing',
        designation: 'Marketing Specialist',
        joinDate: '2023-04-05',
        status: 'active'
      }
    ];

    for (const employee of employees) {
      const result = await pool.query(
        `INSERT INTO employees (
          employee_id, name, department, designation, join_date, status, tenant_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          employee.employeeId,
          employee.name,
          employee.department,
          employee.designation,
          employee.joinDate,
          employee.status,
          tenantId
        ]
      );

      console.log('Created employee:', {
        id: result.rows[0].id,
        employeeId: result.rows[0].employee_id,
        name: result.rows[0].name,
        department: result.rows[0].department
      });
    }

    console.log('Successfully created', employees.length, 'test employees');

  } catch (error) {
    console.error('Error creating test employees:', error);
  } finally {
    await pool.end();
  }
}

createTestEmployees(); 
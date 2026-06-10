const { Client } = require('pg');

async function checkEmployees() {
  const client = new Client({
    connectionString: 'postgresql://postgres:root@localhost:5432/syncbridge_backup'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check employees table
    const employeesResult = await client.query('SELECT * FROM employees ORDER BY id');
    console.log('\n=== EMPLOYEES TABLE ===');
    console.log(`Total employees: ${employeesResult.rows.length}`);
    
    if (employeesResult.rows.length > 0) {
      employeesResult.rows.forEach((emp, index) => {
        console.log(`\nEmployee ${index + 1}:`);
        console.log(`  ID: ${emp.id}`);
        console.log(`  Tenant ID: ${emp.tenant_id}`);
        console.log(`  Employee ID: ${emp.employee_id}`);
        console.log(`  Name: ${emp.name}`);
        console.log(`  Department: ${emp.department}`);
        console.log(`  Designation: ${emp.designation}`);
        console.log(`  Status: ${emp.status}`);
        console.log(`  Nationality: ${emp.nationality}`);
        console.log(`  Created: ${emp.created_at}`);
      });
    } else {
      console.log('No employees found in database');
    }

    // Check users table for vendor user
    const usersResult = await client.query("SELECT * FROM users WHERE email = 'aleemdough@syncbridge.com'");
    console.log('\n=== VENDOR USER ===');
    if (usersResult.rows.length > 0) {
      const user = usersResult.rows[0];
      console.log(`User ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);
      console.log(`Tenant ID: ${user.tenant_id}`);
      console.log(`Is Super Admin: ${user.is_super_admin}`);
    } else {
      console.log('Vendor user not found');
    }

    // Check tenants table
    const tenantsResult = await client.query('SELECT * FROM tenants ORDER BY id');
    console.log('\n=== TENANTS TABLE ===');
    console.log(`Total tenants: ${tenantsResult.rows.length}`);
    tenantsResult.rows.forEach((tenant, index) => {
      console.log(`\nTenant ${index + 1}:`);
      console.log(`  ID: ${tenant.id}`);
      console.log(`  Name: ${tenant.name}`);
      console.log(`  Slug: ${tenant.slug}`);
      console.log(`  Active: ${tenant.is_active}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkEmployees();
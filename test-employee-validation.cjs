const { Pool } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

async function testEmployeeValidation() {
  console.log('🔍 Testing Employee Validation...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Welcome123@localhost:5432/syncbridge'
  });
  
  try {
    // Test data that should pass validation
    const testEmployeeData = {
      employeeId: "EMP001",
      name: "Test Employee",
      department: "IT",
      designation: "Developer",
      joinDate: new Date().toISOString(),
      status: "active",
      nationality: "foreigner",
      finNumber: "F1234567A",
      passportNumber: "A12345678",
      passportExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
      visaNumber: "V1234567",
      visaExpiry: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(), // 2 years from now
      visaType: "employment_pass",
      visaRemarks: "Test remarks",
      tenantId: 1 // Assuming tenant ID 1 exists
    };
    
    console.log('📋 Test Employee Data:');
    console.log(JSON.stringify(testEmployeeData, null, 2));
    
    // Check if tenant exists
    const tenantCheck = await pool.query('SELECT id, name FROM tenants WHERE id = $1', [testEmployeeData.tenantId]);
    if (tenantCheck.rows.length === 0) {
      console.log('\n⚠️ Tenant ID 1 does not exist. Checking available tenants...');
      const tenants = await pool.query('SELECT id, name FROM tenants LIMIT 5');
      console.log('Available tenants:');
      tenants.rows.forEach(tenant => {
        console.log(`   ID: ${tenant.id}, Name: ${tenant.name}`);
      });
      
      if (tenants.rows.length > 0) {
        testEmployeeData.tenantId = tenants.rows[0].id;
        console.log(`\n✅ Using tenant ID: ${testEmployeeData.tenantId}`);
      } else {
        console.log('\n❌ No tenants found. Cannot test employee creation.');
        return;
      }
    }
    
    // Check required fields in employees table
    console.log('\n📊 Checking employees table structure...');
    const tableInfo = await pool.query(`
      SELECT column_name, is_nullable, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'employees' 
      ORDER BY ordinal_position
    `);
    
    console.log('Employees table columns:');
    tableInfo.rows.forEach(col => {
      const required = col.is_nullable === 'NO' ? 'REQUIRED' : 'OPTIONAL';
      console.log(`   ${col.column_name}: ${col.data_type} (${required})`);
    });
    
    // Check for any existing employees to see the data structure
    console.log('\n📋 Checking existing employees...');
    const existingEmployees = await pool.query('SELECT employee_id, name, department, designation FROM employees LIMIT 3');
    if (existingEmployees.rows.length > 0) {
      console.log('Sample existing employees:');
      existingEmployees.rows.forEach(emp => {
        console.log(`   ${emp.employee_id}: ${emp.name} - ${emp.department} - ${emp.designation}`);
      });
    } else {
      console.log('No existing employees found.');
    }
    
    // Test inserting the employee
    console.log('\n🔄 Testing employee insertion...');
    try {
      const insertResult = await pool.query(`
        INSERT INTO employees (
          employee_id, name, department, designation, join_date, status, 
          nationality, fin_number, passport_number, passport_expiry, 
          visa_number, visa_expiry, visa_type, visa_remarks, tenant_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, employee_id, name
      `, [
        testEmployeeData.employeeId,
        testEmployeeData.name,
        testEmployeeData.department,
        testEmployeeData.designation,
        testEmployeeData.joinDate,
        testEmployeeData.status,
        testEmployeeData.nationality,
        testEmployeeData.finNumber,
        testEmployeeData.passportNumber,
        testEmployeeData.passportExpiry,
        testEmployeeData.visaNumber,
        testEmployeeData.visaExpiry,
        testEmployeeData.visaType,
        testEmployeeData.visaRemarks,
        testEmployeeData.tenantId
      ]);
      
      console.log('✅ Employee created successfully!');
      console.log(`   ID: ${insertResult.rows[0].id}`);
      console.log(`   Employee ID: ${insertResult.rows[0].employee_id}`);
      console.log(`   Name: ${insertResult.rows[0].name}`);
      
      // Clean up - delete the test employee
      await pool.query('DELETE FROM employees WHERE id = $1', [insertResult.rows[0].id]);
      console.log('🧹 Test employee cleaned up.');
      
    } catch (insertError) {
      console.error('❌ Employee insertion failed:');
      console.error(`   Error: ${insertError.message}`);
      console.error(`   Code: ${insertError.code}`);
      
      if (insertError.code === '23505') {
        console.log('\n💡 This is a unique constraint violation. The employee ID might already exist.');
      } else if (insertError.code === '23502') {
        console.log('\n💡 This is a NOT NULL constraint violation. Check required fields.');
      } else if (insertError.code === '23503') {
        console.log('\n💡 This is a foreign key constraint violation. Check tenant ID.');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testEmployeeValidation().catch(console.error); 
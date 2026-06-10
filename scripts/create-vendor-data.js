import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { employees, vendors } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup';
const client = postgres(connectionString);
const db = drizzle(client);

async function createVendorData() {
  try {
    console.log('Creating sample data for vendor user...');

    // First, let's check if Aleem Dough exists and get his tenant ID
    const userResult = await client.query(
      "SELECT id, tenant_id FROM users WHERE email = 'aleemdough@syncbridge.com'"
    );

    if (userResult.rows.length === 0) {
      console.log('Vendor user aleemdough@syncbridge.com not found');
      return;
    }

    const user = userResult.rows[0];
    console.log('Found vendor user:', user);

    // Create sample employees for the vendor's tenant
    const sampleEmployees = [
      {
        employee_id: 'EMP001',
        first_name: 'John',
        last_name: 'Smith',
        email: 'john.smith@company.com',
        phone: '+65 9123 4567',
        position: 'Software Engineer',
        department: 'Engineering',
        hire_date: '2024-01-15',
        salary: 75000,
        status: 'active',
        nationality: 'Singaporean',
        passport_number: 'E12345678A',
        work_permit_number: '',
        tenant_id: user.tenant_id
      },
      {
        employee_id: 'EMP002',
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah.johnson@company.com',
        phone: '+65 9234 5678',
        position: 'Marketing Manager',
        department: 'Marketing',
        hire_date: '2024-02-20',
        salary: 85000,
        status: 'active',
        nationality: 'Malaysian',
        passport_number: 'A98765432B',
        work_permit_number: 'WP1234567',
        tenant_id: user.tenant_id
      },
      {
        employee_id: 'EMP003',
        first_name: 'Michael',
        last_name: 'Chen',
        email: 'michael.chen@company.com',
        phone: '+65 9345 6789',
        position: 'Sales Representative',
        department: 'Sales',
        hire_date: '2024-03-10',
        salary: 65000,
        status: 'active',
        nationality: 'Singaporean',
        passport_number: 'S87654321C',
        work_permit_number: '',
        tenant_id: user.tenant_id
      }
    ];

    // Insert sample employees
    for (const employee of sampleEmployees) {
      const existingEmployee = await db.select().from(employees).where(eq(employees.employee_id, employee.employee_id));
      if (existingEmployee.length === 0) {
        await db.insert(employees).values(employee);
        console.log(`Created employee: ${employee.first_name} ${employee.last_name}`);
      } else {
        console.log(`Employee ${employee.first_name} ${employee.last_name} already exists`);
      }
    }

    // Create sample vendors for the vendor's tenant
    const sampleVendors = [
      {
        name: 'Tech Solutions Pte Ltd',
        email: 'contact@techsolutions.sg',
        phone: '+65 6789 0123',
        address: '123 Tech Street, Singapore 123456',
        website: 'https://techsolutions.sg',
        contact_person: 'David Wong',
        status: 'active',
        tenant_id: user.tenant_id
      },
      {
        name: 'Office Supplies Co',
        email: 'sales@officesupplies.sg',
        phone: '+65 6789 0124',
        address: '456 Business Ave, Singapore 234567',
        website: 'https://officesupplies.sg',
        contact_person: 'Lisa Tan',
        status: 'active',
        tenant_id: user.tenant_id
      },
      {
        name: 'IT Equipment Pro',
        email: 'info@itequipment.sg',
        phone: '+65 6789 0125',
        address: '789 Hardware Road, Singapore 345678',
        website: 'https://itequipment.sg',
        contact_person: 'Robert Lim',
        status: 'active',
        tenant_id: user.tenant_id
      }
    ];

    // Insert sample vendors
    for (const vendor of sampleVendors) {
      const existingVendor = await db.select().from(vendors).where(eq(vendors.name, vendor.name));
      if (existingVendor.length === 0) {
        await db.insert(vendors).values(vendor);
        console.log(`Created vendor: ${vendor.name}`);
      } else {
        console.log(`Vendor ${vendor.name} already exists`);
      }
    }

    console.log('Sample data creation completed successfully!');
  } catch (error) {
    console.error('Error creating sample data:', error);
  } finally {
    await client.end();
  }
}

createVendorData();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup'
});

async function checkVendorTenant() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check the vendor user
    const userResult = await client.query(`
      SELECT id, name, email, role, tenant_id FROM users WHERE email = 'aleemdough@syncbridge.com'
    `);

    console.log('Vendor user details:');
    if (userResult.rows.length === 0) {
      console.log('Vendor user not found!');
    } else {
      const user = userResult.rows[0];
      console.log(`ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Role: ${user.role}, Tenant ID: ${user.tenant_id}`);
    }

    // Check what products should be available for this tenant
    if (userResult.rows.length > 0) {
      const tenantId = userResult.rows[0].tenant_id;
      console.log(`\nProducts for tenant ${tenantId}:`);
      
      const productsResult = await client.query(`
        SELECT id, name, category FROM products WHERE tenant_id = $1
      `, [tenantId]);

      if (productsResult.rows.length === 0) {
        console.log('No products found for this tenant!');
      } else {
        productsResult.rows.forEach(row => {
          console.log(`ID: ${row.id}, Name: ${row.name}, Category: ${row.category}`);
        });
      }
    }

  } catch (error) {
    console.error('Error checking vendor tenant:', error);
  } finally {
    await client.end();
  }
}

checkVendorTenant();
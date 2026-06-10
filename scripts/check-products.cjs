const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup'
});

async function checkProducts() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check all products
    const result = await client.query(`
      SELECT id, name, category, tenant_id FROM products ORDER BY id DESC LIMIT 10
    `);

    console.log('Products in database:');
    if (result.rows.length === 0) {
      console.log('No products found!');
    } else {
      result.rows.forEach(row => {
        console.log(`ID: ${row.id}, Name: ${row.name}, Category: ${row.category}, Tenant: ${row.tenant_id}`);
      });
    }

    // Check tenants
    const tenantResult = await client.query(`
      SELECT id, name FROM tenants ORDER BY id DESC LIMIT 5
    `);

    console.log('\nTenants in database:');
    tenantResult.rows.forEach(row => {
      console.log(`ID: ${row.id}, Name: ${row.name}`);
    });

  } catch (error) {
    console.error('Error checking products:', error);
  } finally {
    await client.end();
  }
}

checkProducts();
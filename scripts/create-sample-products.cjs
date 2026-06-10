const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup'
});

async function createSampleProducts() {
  try {
    await client.connect();
    console.log('Connected to database');

    // First, get the tenant ID for Aleem Dough
    const tenantResult = await client.query(`
      SELECT id FROM tenants WHERE name = 'Aleem Dough Company' OR name LIKE '%Aleem%'
    `);

    let tenantId;
    if (tenantResult.rows.length === 0) {
      console.log('No tenant found for Aleem Dough. Creating a new tenant...');
      const newTenantResult = await client.query(`
        INSERT INTO tenants (name, slug, created_at)
        VALUES ('Aleem Dough Company', 'aleem-dough-company', NOW())
        RETURNING id
      `);
      tenantId = newTenantResult.rows[0].id;
    } else {
      tenantId = tenantResult.rows[0].id;
    }

    console.log(`Using tenant ID: ${tenantId}`);

    // Sample products data
    const sampleProducts = [
      {
        name: 'Laptop Computer',
        description: 'High-performance laptop for business use',
        category: 'Electronics',
        tenantId: tenantId
      },
      {
        name: 'Office Chair',
        description: 'Ergonomic office chair for comfort',
        category: 'Furniture',
        tenantId: tenantId
      },
      {
        name: 'Printer',
        description: 'All-in-one printer for office use',
        category: 'Electronics',
        tenantId: tenantId
      },
      {
        name: 'Desk',
        description: 'Modern office desk',
        category: 'Furniture',
        tenantId: tenantId
      },
      {
        name: 'Monitor',
        description: '24-inch LED monitor',
        category: 'Electronics',
        tenantId: tenantId
      },
      {
        name: 'Keyboard',
        description: 'Wireless keyboard',
        category: 'Electronics',
        tenantId: tenantId
      },
      {
        name: 'Mouse',
        description: 'Wireless optical mouse',
        category: 'Electronics',
        tenantId: tenantId
      },
      {
        name: 'Bookshelf',
        description: 'Wooden bookshelf for office',
        category: 'Furniture',
        tenantId: tenantId
      }
    ];

    // Insert sample products
    for (const product of sampleProducts) {
      const result = await client.query(`
        INSERT INTO products (name, description, category, tenant_id, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, name
      `, [product.name, product.description, product.category, product.tenantId]);

      console.log(`Created product: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
    }

    console.log('Sample products created successfully!');
    console.log('You can now test the product dropdown in the vendor settings page.');

  } catch (error) {
    console.error('Error creating sample products:', error);
  } finally {
    await client.end();
  }
}

createSampleProducts();
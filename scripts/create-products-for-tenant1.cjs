const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup'
});

async function createProductsForTenant1() {
  try {
    await client.connect();
    console.log('Connected to database');

    const tenantId = 1; // The tenant where aleemdough@syncbridge.com belongs
    console.log(`Creating products for tenant ID: ${tenantId}`);

    // Sample products data for tenant 1
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

    console.log('Sample products created successfully for tenant 1!');
    console.log('The vendor should now be able to see these products in the dropdown.');

  } catch (error) {
    console.error('Error creating sample products:', error);
  } finally {
    await client.end();
  }
}

createProductsForTenant1();
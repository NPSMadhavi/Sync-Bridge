const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup'
});

async function deleteSampleProducts() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Sample product names that were created for testing
    const sampleProductNames = [
      'Laptop Computer',
      'Office Chair', 
      'Printer',
      'Desk',
      'Monitor',
      'Keyboard',
      'Mouse',
      'Bookshelf'
    ];

    console.log('Looking for sample products to delete...');

    // First, check if there are any vendor orders for these products
    const orderCheckQuery = `
      SELECT p.id, p.name, COUNT(vo.id) as order_count
      FROM products p
      LEFT JOIN vendor_orders vo ON p.id = vo.product_id
      WHERE p.name = ANY($1)
      GROUP BY p.id, p.name
    `;

    const orderCheckResult = await client.query(orderCheckQuery, [sampleProductNames]);
    
    console.log('\nChecking for existing orders on sample products:');
    for (const row of orderCheckResult.rows) {
      console.log(`Product: ${row.name} (ID: ${row.id}) - Orders: ${row.order_count}`);
    }

    // Delete vendor product prices for these products first
    console.log('\nDeleting vendor product prices for sample products...');
    const deletePricesQuery = `
      DELETE FROM vendor_product_prices 
      WHERE product_id IN (
        SELECT id FROM products WHERE name = ANY($1)
      )
    `;
    const priceDeleteResult = await client.query(deletePricesQuery, [sampleProductNames]);
    console.log(`Deleted ${priceDeleteResult.rowCount} vendor product price records`);

    // Delete the sample products
    console.log('\nDeleting sample products...');
    const deleteProductsQuery = `
      DELETE FROM products 
      WHERE name = ANY($1)
    `;
    const productDeleteResult = await client.query(deleteProductsQuery, [sampleProductNames]);
    console.log(`Deleted ${productDeleteResult.rowCount} sample products`);

    // List the deleted products
    console.log('\nDeleted sample products:');
    for (const productName of sampleProductNames) {
      console.log(`- ${productName}`);
    }

    console.log('\nSample products deletion completed successfully!');
    console.log('Note: If any products had existing orders, they would have been preserved for historical records.');

  } catch (error) {
    console.error('Error deleting sample products:', error);
  } finally {
    await client.end();
  }
}

deleteSampleProducts();

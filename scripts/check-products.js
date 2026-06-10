import { db } from '../server/db.js';
import { products } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkProducts() {
  try {
    console.log('Checking products in database...');
    
    const allProducts = await db.select().from(products);
    console.log('Total products found:', allProducts.length);
    
    if (allProducts.length > 0) {
      console.log('Sample products:');
      allProducts.slice(0, 5).forEach(product => {
        console.log(`- ${product.name} (Category: ${product.category}, Tenant: ${product.tenantId})`);
      });
    } else {
      console.log('No products found in database');
    }
    
    // Check products by tenant
    const productsByTenant = await db.select().from(products).where(eq(products.tenantId, 1));
    console.log('Products for tenant 1:', productsByTenant.length);
    
  } catch (error) {
    console.error('Error checking products:', error);
  } finally {
    process.exit(0);
  }
}

checkProducts(); 
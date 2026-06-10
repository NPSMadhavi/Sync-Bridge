import { db } from '../server/db.js';
import { products } from '../shared/schema.js';
import { eq, isNull } from 'drizzle-orm';

async function assignProductsToTenant() {
  try {
    console.log('Assigning products to tenant 1...');
    
    // Update all products that have null tenantId to tenant 1
    const result = await db.update(products)
      .set({ tenantId: 1 })
      .where(isNull(products.tenantId));
    
    console.log('Products updated successfully!');
    
    // Verify the update
    const updatedProducts = await db.select().from(products).where(eq(products.tenantId, 1));
    console.log('Products now assigned to tenant 1:', updatedProducts.length);
    
  } catch (error) {
    console.error('Error assigning products to tenant:', error);
  } finally {
    process.exit(0);
  }
}

assignProductsToTenant(); 
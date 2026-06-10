const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

async function testDashboardAPI() {
  console.log('🧪 Testing Dashboard API...\n');
  
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup';
  const pool = new Pool({ connectionString: dbUrl });
  
  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    // Test the dashboard stats query directly
    const { employees, assets, vendors, customers, assetAssignments, employeeDocuments } = require('@shared/schema');
    const { eq, sql, count, and, gte, lte, desc } = require('drizzle-orm');
    const { db } = require('./server/db');
    
    console.log('\n📊 Testing Dashboard Statistics...');
    
    // Test basic counts
    const [employeeCount] = await db
      .select({ count: count() })
      .from(employees);
    
    const [assetCount] = await db
      .select({ count: count() })
      .from(assets);
    
    const [vendorCount] = await db
      .select({ count: count() })
      .from(vendors);
    
    const [customerCount] = await db
      .select({ count: count() })
      .from(customers);
    
    console.log('✅ Basic counts:');
    console.log(`   Employees: ${employeeCount.count}`);
    console.log(`   Assets: ${assetCount.count}`);
    console.log(`   Vendors: ${vendorCount.count}`);
    console.log(`   Customers: ${customerCount.count}`);
    
    // Test asset distribution
    const assetDistribution = await db
      .select({
        type: assets.type,
        count: count()
      })
      .from(assets)
      .groupBy(assets.type);
    
    console.log('\n✅ Asset Distribution:');
    assetDistribution.forEach(item => {
      console.log(`   ${item.type || 'Unknown'}: ${item.count}`);
    });
    
    // Test document counts
    const [documentCount] = await db
      .select({ count: count() })
      .from(employeeDocuments)
      .innerJoin(employees, eq(employeeDocuments.employeeId, employees.id));
    
    console.log(`\n✅ Documents: ${documentCount.count}`);
    
    // Test asset assignments
    const [assignmentCount] = await db
      .select({ count: count() })
      .from(assetAssignments)
      .innerJoin(assets, eq(assetAssignments.assetId, assets.id));
    
    console.log(`✅ Asset Assignments: ${assignmentCount.count}`);
    
    console.log('\n🎉 Dashboard API test completed successfully!');
    console.log('The dashboard should now show real data instead of zeros.');
    
    client.release();
    
  } catch (error) {
    console.error('❌ Dashboard API test failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
  } finally {
    await pool.end();
  }
}

// Run the test
testDashboardAPI().catch(console.error);

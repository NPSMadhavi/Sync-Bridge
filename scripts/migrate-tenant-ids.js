import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup'
});

async function migrateTenantIds() {
  try {
    console.log('Starting tenant ID migration...\n');
    
    // 1. Check current state
    console.log('1. Checking current users and their tenant IDs...');
    const usersResult = await pool.query(`
      SELECT id, name, email, role, tenant_id, is_super_admin 
      FROM users 
      ORDER BY id
    `);
    
    console.log(`Found ${usersResult.rows.length} users:`);
    usersResult.rows.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - Role: ${user.role} - Tenant ID: ${user.tenant_id || 'NULL'} - Super Admin: ${user.is_super_admin}`);
    });
    
    // 2. Create unique tenants for users without tenant IDs
    console.log('\n2. Creating unique tenants for users without tenant IDs...');
    
    for (const user of usersResult.rows) {
      if (!user.tenant_id && !user.is_super_admin) {
        // Create a unique tenant for this user
        const tenantName = `${user.name}'s Organization`;
        const tenantSlug = `${user.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        
        console.log(`  Creating tenant for ${user.name}: ${tenantName} (${tenantSlug})`);
        
        const tenantResult = await pool.query(`
          INSERT INTO tenants (name, slug, plan, max_users, max_assets, max_documents, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [tenantName, tenantSlug, 'business', 10, 50, 100, true]);
        
        const tenantId = tenantResult.rows[0].id;
        
        // Update user with new tenant ID
        await pool.query(`
          UPDATE users 
          SET tenant_id = $1 
          WHERE id = $2
        `, [tenantId, user.id]);
        
        console.log(`    ✓ Assigned tenant ID ${tenantId} to user ${user.name}`);
      }
    }
    
    // 3. Ensure super admin has no tenant ID (global access)
    console.log('\n3. Ensuring super admin has no tenant ID for global access...');
    const superAdminResult = await pool.query(`
      UPDATE users 
      SET tenant_id = NULL 
      WHERE is_super_admin = true
      RETURNING id, name, email
    `);
    
    if (superAdminResult.rows.length > 0) {
      console.log('  Updated super admin users:');
      superAdminResult.rows.forEach(admin => {
        console.log(`    ✓ ${admin.name} (${admin.email}) - No tenant ID for global access`);
      });
    }
    
    // 4. Verify final state
    console.log('\n4. Verifying final state...');
    const finalUsersResult = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.tenant_id, u.is_super_admin, t.name as tenant_name
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      ORDER BY u.id
    `);
    
    console.log('\nFinal user state:');
    finalUsersResult.rows.forEach(user => {
      const tenantInfo = user.is_super_admin ? 'GLOBAL ACCESS (Super Admin)' : 
                        user.tenant_name ? `${user.tenant_name} (ID: ${user.tenant_id})` : 'NO TENANT';
      console.log(`  - ${user.name} (${user.email}) - Role: ${user.role} - Tenant: ${tenantInfo}`);
    });
    
    // 5. Check for any orphaned data
    console.log('\n5. Checking for orphaned data...');
    const orphanedAssets = await pool.query(`
      SELECT COUNT(*) as count FROM assets WHERE tenant_id IS NULL
    `);
    const orphanedEmployees = await pool.query(`
      SELECT COUNT(*) as count FROM employees WHERE tenant_id IS NULL
    `);
    const orphanedVendors = await pool.query(`
      SELECT COUNT(*) as count FROM vendors WHERE tenant_id IS NULL
    `);
    
    console.log(`  - Assets without tenant: ${orphanedAssets.rows[0].count}`);
    console.log(`  - Employees without tenant: ${orphanedEmployees.rows[0].count}`);
    console.log(`  - Vendors without tenant: ${orphanedVendors.rows[0].count}`);
    
    if (orphanedAssets.rows[0].count > 0 || orphanedEmployees.rows[0].count > 0 || orphanedVendors.rows[0].count > 0) {
      console.log('\n⚠️  WARNING: Found data without tenant IDs. This data may not be accessible.');
      console.log('   Consider assigning these records to appropriate tenants or cleaning them up.');
    }
    
    console.log('\n✅ Tenant ID migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during tenant ID migration:', error);
  } finally {
    await pool.end();
  }
}

migrateTenantIds(); 
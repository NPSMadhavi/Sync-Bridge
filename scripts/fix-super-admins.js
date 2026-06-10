import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup'
});

async function fixSuperAdmins() {
  try {
    console.log('=== Fixing Super Admin Users ===\n');
    
    // 1. Check current super admin users
    console.log('1. Current Super Admin Users:');
    const superAdminsResult = await pool.query(`
      SELECT id, name, email, role, tenant_id, is_super_admin
      FROM users 
      WHERE role = 'super_admin' OR is_super_admin = true
      ORDER BY id
    `);
    
    console.log(`Found ${superAdminsResult.rows.length} super admin users:`);
    superAdminsResult.rows.forEach(user => {
      const tenantInfo = user.tenant_id ? `Tenant ID: ${user.tenant_id}` : 'No tenant (Global access)';
      console.log(`  - ${user.name} (${user.email}) - ${tenantInfo}`);
    });
    
    // 2. Fix super admin users who have tenant IDs
    console.log('\n2. Fixing Super Admin Users with Tenant IDs...');
    const fixResult = await pool.query(`
      UPDATE users 
      SET tenant_id = NULL, is_super_admin = true 
      WHERE (role = 'super_admin' OR is_super_admin = true) AND tenant_id IS NOT NULL
      RETURNING id, name, email, role, tenant_id, is_super_admin
    `);
    
    if (fixResult.rows.length > 0) {
      console.log('  Updated super admin users:');
      fixResult.rows.forEach(user => {
        console.log(`    ✓ ${user.name} (${user.email}) - Now has global access`);
      });
    } else {
      console.log('  No super admin users needed fixing.');
    }
    
    // 3. Verify final state
    console.log('\n3. Final Super Admin State:');
    const finalResult = await pool.query(`
      SELECT id, name, email, role, tenant_id, is_super_admin
      FROM users 
      WHERE role = 'super_admin' OR is_super_admin = true
      ORDER BY id
    `);
    
    finalResult.rows.forEach(user => {
      const accessInfo = user.tenant_id ? `Tenant ID: ${user.tenant_id} (⚠️ Should be global)` : 'Global access (✅ Correct)';
      console.log(`  - ${user.name} (${user.email}) - ${accessInfo}`);
    });
    
    // 4. Check for any remaining issues
    const remainingIssues = finalResult.rows.filter(user => user.tenant_id !== null);
    if (remainingIssues.length > 0) {
      console.log('\n⚠️  WARNING: Some super admin users still have tenant IDs:');
      remainingIssues.forEach(user => {
        console.log(`    - ${user.name} (${user.email}) - Tenant ID: ${user.tenant_id}`);
      });
    } else {
      console.log('\n✅ All super admin users now have proper global access!');
    }
    
    console.log('\n=== Super Admin Fix Complete ===');
    
  } catch (error) {
    console.error('❌ Error fixing super admin users:', error);
  } finally {
    await pool.end();
  }
}

fixSuperAdmins(); 
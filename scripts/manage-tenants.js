import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup'
});

async function manageTenants() {
  try {
    console.log('=== SyncBridge Tenant Management ===\n');
    
    // 1. List all tenants
    console.log('1. Current Tenants:');
    const tenantsResult = await pool.query(`
      SELECT id, name, slug, plan, max_users, max_assets, max_documents, is_active, created_at
      FROM tenants 
      ORDER BY id
    `);
    
    if (tenantsResult.rows.length === 0) {
      console.log('  No tenants found.');
    } else {
      tenantsResult.rows.forEach(tenant => {
        console.log(`  - ID: ${tenant.id} | Name: ${tenant.name} | Slug: ${tenant.slug} | Plan: ${tenant.plan} | Active: ${tenant.is_active}`);
      });
    }
    
    // 2. List all users with their tenant information
    console.log('\n2. Users and Their Tenants:');
    const usersResult = await pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.tenant_id, 
        u.is_super_admin,
        t.name as tenant_name
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      ORDER BY u.id
    `);
    
    if (usersResult.rows.length === 0) {
      console.log('  No users found.');
    } else {
      usersResult.rows.forEach(user => {
        const tenantInfo = user.is_super_admin ? 'GLOBAL ACCESS (Super Admin)' : 
                          user.tenant_name ? `${user.tenant_name} (ID: ${user.tenant_id})` : 'NO TENANT';
        console.log(`  - ${user.name} (${user.email}) | Role: ${user.role} | Tenant: ${tenantInfo}`);
      });
    }
    
    // 3. Data distribution by tenant
    console.log('\n3. Data Distribution by Tenant:');
    const dataDistribution = await pool.query(`
      SELECT 
        t.id,
        t.name as tenant_name,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT e.id) as employee_count,
        COUNT(DISTINCT a.id) as asset_count,
        COUNT(DISTINCT v.id) as vendor_count,
        COUNT(DISTINCT c.id) as customer_count,
        COUNT(DISTINCT i.id) as invoice_count
      FROM tenants t
      LEFT JOIN users u ON t.id = u.tenant_id
      LEFT JOIN employees e ON t.id = e.tenant_id
      LEFT JOIN assets a ON t.id = a.tenant_id
      LEFT JOIN vendors v ON t.id = v.tenant_id
      LEFT JOIN customers c ON t.id = c.tenant_id
      LEFT JOIN invoices i ON t.id = i.tenant_id
      GROUP BY t.id, t.name
      ORDER BY t.id
    `);
    
    if (dataDistribution.rows.length === 0) {
      console.log('  No tenant data found.');
    } else {
      dataDistribution.rows.forEach(tenant => {
        console.log(`  - ${tenant.tenant_name} (ID: ${tenant.id}):`);
        console.log(`    Users: ${tenant.user_count} | Employees: ${tenant.employee_count} | Assets: ${tenant.asset_count}`);
        console.log(`    Vendors: ${tenant.vendor_count} | Customers: ${tenant.customer_count} | Invoices: ${tenant.invoice_count}`);
      });
    }
    
    // 4. Orphaned data check
    console.log('\n4. Orphaned Data Check:');
    const orphanedData = await pool.query(`
      SELECT 
        'users' as table_name,
        COUNT(*) as count
      FROM users 
      WHERE tenant_id IS NULL AND is_super_admin = false
      UNION ALL
      SELECT 
        'employees' as table_name,
        COUNT(*) as count
      FROM employees 
      WHERE tenant_id IS NULL
      UNION ALL
      SELECT 
        'assets' as table_name,
        COUNT(*) as count
      FROM assets 
      WHERE tenant_id IS NULL
      UNION ALL
      SELECT 
        'vendors' as table_name,
        COUNT(*) as count
      FROM vendors 
      WHERE tenant_id IS NULL
      UNION ALL
      SELECT 
        'customers' as table_name,
        COUNT(*) as count
      FROM customers 
      WHERE tenant_id IS NULL
      UNION ALL
      SELECT 
        'invoices' as table_name,
        COUNT(*) as count
      FROM invoices 
      WHERE tenant_id IS NULL
    `);
    
    let hasOrphanedData = false;
    orphanedData.rows.forEach(row => {
      if (row.count > 0) {
        console.log(`  ⚠️  ${row.table_name}: ${row.count} records without tenant_id`);
        hasOrphanedData = true;
      }
    });
    
    if (!hasOrphanedData) {
      console.log('  ✅ No orphaned data found.');
    }
    
    // 5. Super admin status
    console.log('\n5. Super Admin Status:');
    const superAdmins = await pool.query(`
      SELECT id, name, email, role, tenant_id
      FROM users 
      WHERE is_super_admin = true
      ORDER BY id
    `);
    
    if (superAdmins.rows.length === 0) {
      console.log('  No super admins found.');
    } else {
      superAdmins.rows.forEach(admin => {
        const tenantInfo = admin.tenant_id ? `Tenant ID: ${admin.tenant_id}` : 'No tenant (Global access)';
        console.log(`  - ${admin.name} (${admin.email}) | Role: ${admin.role} | ${tenantInfo}`);
      });
    }
    
    console.log('\n=== Tenant Management Complete ===');
    
  } catch (error) {
    console.error('❌ Error during tenant management:', error);
  } finally {
    await pool.end();
  }
}

// Run the management script
manageTenants(); 
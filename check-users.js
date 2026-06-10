import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Welcome123@localhost:5432/syncbridge'
});

async function checkUsers() {
  try {
    console.log('Checking users in database...\n');
    
    const result = await pool.query(`
      SELECT 
        id, 
        name, 
        email, 
        role, 
        is_active, 
        is_email_verified,
        tenant_id,
        is_super_admin,
        created_at
      FROM users 
      ORDER BY id
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No users found in database');
    } else {
      console.log(`✅ Found ${result.rows.length} user(s):\n`);
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. User Details:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.is_active}`);
        console.log(`   Email Verified: ${user.is_email_verified}`);
        console.log(`   Super Admin: ${user.is_super_admin || false}`);
        console.log(`   Tenant ID: ${user.tenant_id || 'null'}`);
        console.log(`   Created: ${user.created_at}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    await pool.end();
  }
}

checkUsers(); 
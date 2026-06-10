import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Welcome123@localhost:5432/syncbridge'
});

async function updateAdminEmail() {
  try {
    console.log('Updating super admin email...\n');
    
    // Update the email from myrsv.com to syncbridge.com
    const result = await pool.query(`
      UPDATE users 
      SET email = 'supadmin@syncbridge.com'
      WHERE email = 'supadmin@myrsv.com' AND is_super_admin = true
      RETURNING id, name, email, role, is_super_admin
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Super admin email updated successfully!');
      console.log('Updated user details:');
      console.log(`   ID: ${result.rows[0].id}`);
      console.log(`   Name: ${result.rows[0].name}`);
      console.log(`   Email: ${result.rows[0].email}`);
      console.log(`   Role: ${result.rows[0].role}`);
      console.log(`   Super Admin: ${result.rows[0].is_super_admin}`);
      console.log('\n🔑 You can now login with:');
      console.log('   Email: supadmin@syncbridge.com');
      console.log('   Password: @minRSV100#$');
    } else {
      console.log('❌ No super admin user found with email supadmin@myrsv.com');
    }
    
  } catch (error) {
    console.error('❌ Error updating admin email:', error);
  } finally {
    await pool.end();
  }
}

updateAdminEmail(); 
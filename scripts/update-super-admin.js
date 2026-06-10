const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Welcome123@localhost:5432/postgres'
});

async function updateSuperAdmin() {
  try {
    console.log('Updating super admin user...');
    
    // Update super admin to have tenant_id = null
    const result = await pool.query(
      `UPDATE users 
       SET tenant_id = NULL 
       WHERE email = 'supadmin@myrsv.com' AND is_super_admin = true
       RETURNING *`
    );

    if (result.rows.length > 0) {
      console.log('Super admin updated successfully:', result.rows[0]);
    } else {
      console.log('No super admin user found to update');
    }
    
    // Also check current state
    const checkResult = await pool.query(
      "SELECT id, name, email, role, tenant_id, is_super_admin FROM users WHERE email = 'supadmin@myrsv.com'"
    );
    
    if (checkResult.rows.length > 0) {
      console.log('Current super admin state:', checkResult.rows[0]);
    }
    
  } catch (error) {
    console.error('Error updating super admin:', error);
  } finally {
    await pool.end();
  }
}

updateSuperAdmin(); 
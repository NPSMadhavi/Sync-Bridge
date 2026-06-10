import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

const { Pool } = pg;
const scrypt = promisify(crypto.scrypt);

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'syncbridge',
  password: 'Welcome123',
  port: 5432,
});

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scrypt(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function resetAdminPassword() {
  try {
    console.log('Resetting password for admin@syncbridge.com...');
    
    // Check if user exists
    const checkResult = await pool.query(
      "SELECT id, name, email, role FROM users WHERE email = 'admin@syncbridge.com'"
    );

    if (checkResult.rows.length === 0) {
      console.log('User admin@syncbridge.com not found. Creating new user...');
      
      // Create a tenant first
      const tenantResult = await pool.query(
        'INSERT INTO tenants (name, slug, domain, plan) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Test Company', 'test-company', 'test.syncbridge.com', 'business']
      );
      
      const tenantId = tenantResult.rows[0].id;
      console.log('Created tenant with ID:', tenantId);

      // Create the user
      const hashedPassword = await hashPassword('@minRSV100#$');
      const userResult = await pool.query(
        `INSERT INTO users (
          name, email, role, password, tenant_id, is_email_verified, is_active, allowed_modules
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          'Test Admin',
          'admin@syncbridge.com',
          'admin',
          hashedPassword,
          tenantId,
          true,
          true,
          ['dashboard', 'assets', 'employees']
        ]
      );

      console.log('✅ User created successfully:', {
        id: userResult.rows[0].id,
        name: userResult.rows[0].name,
        email: userResult.rows[0].email,
        role: userResult.rows[0].role
      });
    } else {
      console.log('User found, updating password...');
      
      // Update the password
      const hashedPassword = await hashPassword('@minRSV100#$');
      const updateResult = await pool.query(
        `UPDATE users 
         SET password = $1 
         WHERE email = 'admin@syncbridge.com' 
         RETURNING id, name, email, role`,
        [hashedPassword]
      );

      console.log('✅ Password updated successfully for:', {
        id: updateResult.rows[0].id,
        name: updateResult.rows[0].name,
        email: updateResult.rows[0].email,
        role: updateResult.rows[0].role
      });
    }

    console.log('\n🔑 Login credentials:');
    console.log('   Email: admin@syncbridge.com');
    console.log('   Password: @minRSV100#$');

  } catch (error) {
    console.error('❌ Error resetting admin password:', error);
  } finally {
    await pool.end();
  }
}

resetAdminPassword(); 
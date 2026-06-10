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

async function createTestUser() {
  try {
    const hashedPassword = await hashPassword('@minRSV100#$');
    
    // First create a tenant
    const tenantResult = await pool.query(
      'INSERT INTO tenants (name, slug, domain, plan) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Test Company', 'test-company', 'test.syncbridge.com', 'business']
    );
    
    const tenantId = tenantResult.rows[0].id;
    console.log('Created tenant with ID:', tenantId);

    // Then create the user with the tenant ID
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

    console.log('Created test user:', {
      id: userResult.rows[0].id,
      name: userResult.rows[0].name,
      email: userResult.rows[0].email,
      role: userResult.rows[0].role,
      tenantId: userResult.rows[0].tenant_id,
      isEmailVerified: userResult.rows[0].is_email_verified,
      isActive: userResult.rows[0].is_active
    });

  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await pool.end();
  }
}

createTestUser(); 
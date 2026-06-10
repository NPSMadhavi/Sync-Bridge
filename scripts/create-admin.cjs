const { Pool } = require('pg');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);

// Hash password function
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Welcome123@localhost:5432/postgres'
});

async function createAdmin() {
  try {
    // Check if admin already exists
    const checkResult = await pool.query(
      "SELECT * FROM users WHERE email = 'supadmin@myrsv.com'"
    );

    if (checkResult.rows.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    // Create admin user
    const hashedPassword = await hashPassword('@minRSV100#$');
    const result = await pool.query(
      `INSERT INTO users (
        name, 
        email, 
        role, 
        password, 
        is_super_admin, 
        is_email_verified, 
        is_active,
        tenant_id,
        allowed_modules
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        'Super Administrator',
        'supadmin@myrsv.com',
        'super_admin',
        hashedPassword,
        true,
        true,
        true,
        null,
        ['dashboard', 'assets', 'licenses', 'employees', 'documents', 'vendors', 'customers', 'invoices', 'reports', 'audit_logs', 'settings', 'user_management']
      ]
    );

    console.log('Admin user created successfully:', result.rows[0]);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await pool.end();
  }
}

createAdmin(); 
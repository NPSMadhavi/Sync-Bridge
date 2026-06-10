import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scryptAsync = promisify(scrypt);

// Hash password function that matches the auth system
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Welcome123@localhost:5432/postgres'
});

async function initializeDatabase() {
  try {
    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, '..', 'shared', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Creating database schema...');
    await pool.query(schemaSql);
    console.log('Schema created successfully');

    // Check if admin already exists
    const checkResult = await pool.query(
      "SELECT * FROM users WHERE email = 'supadmin@myrsv.com'"
    );

    if (checkResult.rows.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    // Create admin user with only the columns that exist in the schema
    const hashedPassword = await hashPassword('@minRSV100#$');
    const result = await pool.query(
      `INSERT INTO users (name, email, role, password)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        'Super Administrator',
        'supadmin@myrsv.com',
        'admin',
        hashedPassword
      ]
    );

    console.log('Admin user created successfully:', result.rows[0]);
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await pool.end();
  }
}

initializeDatabase(); 
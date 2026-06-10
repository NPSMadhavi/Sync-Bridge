const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = crypto.scryptSync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function checkAndResetUserPassword() {
  console.log('🔍 Checking user account and password...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Welcome123@localhost:5432/syncbridge'
  });
  
  try {
    // Check if user exists
    const userCheck = await pool.query(`
      SELECT id, name, email, role, is_active, created_at 
      FROM users 
      WHERE email = 'aleem@syncbridge.com'
    `);
    
    if (userCheck.rows.length === 0) {
      console.log('❌ User aleem@syncbridge.com not found in database');
      return;
    }
    
    const user = userCheck.rows[0];
    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.is_active ? 'Yes' : 'No'}`);
    console.log(`   Created: ${user.created_at}`);
    
    // Reset password to Vendor1234
    console.log('\n🔄 Resetting password to: Vendor1234');
    const hashedPassword = await hashPassword('Vendor1234');
    
    await pool.query(`
      UPDATE users 
      SET password = $1 
      WHERE email = 'aleem@syncbridge.com'
    `, [hashedPassword]);
    
    console.log('✅ Password updated successfully!');
    console.log('\n🔑 Login Credentials:');
    console.log('   Email: aleem@syncbridge.com');
    console.log('   Password: Vendor1234');
    console.log('\n💡 You can now login to SyncBridge with these credentials.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAndResetUserPassword().catch(console.error); 
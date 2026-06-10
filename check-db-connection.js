const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

async function checkDatabaseConnection() {
  console.log('🔍 Checking Database Connection...\n');
  
  // Show current configuration
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup';
  console.log('📋 Database Configuration:');
  console.log(`   URL: ${dbUrl.replace(/:[^:@]*@/, ':****@')}`); // Hide password
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log('');
  
  // Create connection pool
  const pool = new Pool({
    connectionString: dbUrl,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000
  });
  
  try {
    console.log('🔄 Attempting to connect...');
    
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    // Get database info
    const dbInfo = await client.query('SELECT current_database() as db_name, current_user as user, version() as version');
    console.log('📊 Database Info:');
    console.log(`   Database: ${dbInfo.rows[0].db_name}`);
    console.log(`   User: ${dbInfo.rows[0].user}`);
    console.log(`   Version: ${dbInfo.rows[0].version.split(' ').slice(0, 3).join(' ')}`);
    
    // Check if tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    const tables = await client.query(tablesQuery);
    
    console.log(`\n📋 Tables found: ${tables.rows.length}`);
    if (tables.rows.length > 0) {
      tables.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.table_name}`);
      });
    }
    
    // Check users table specifically
    const usersCheck = await client.query(`
      SELECT COUNT(*) as user_count 
      FROM users
    `);
    console.log(`\n👥 Users in database: ${usersCheck.rows[0].user_count}`);
    
    // Show some sample users (without passwords)
    const sampleUsers = await client.query(`
      SELECT id, name, email, role, is_active, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (sampleUsers.rows.length > 0) {
      console.log('\n👤 Sample Users:');
      sampleUsers.rows.forEach(user => {
        console.log(`   - ${user.name} (${user.email}) - ${user.role} - ${user.is_active ? 'Active' : 'Inactive'}`);
      });
    }
    
    client.release();
    console.log('\n✅ Database check completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('   1. Make sure PostgreSQL is running');
      console.log('   2. Check if the port 5432 is accessible');
      console.log('   3. Verify the database name exists');
      console.log('   4. Check username and password');
    } else if (error.code === '28P01') {
      console.log('\n💡 Authentication failed:');
      console.log('   1. Check username and password');
      console.log('   2. Verify the user has access to the database');
    } else if (error.code === '3D000') {
      console.log('\n💡 Database does not exist:');
      console.log('   1. Create the database first');
      console.log('   2. Check the database name in connection string');
    }
    
  } finally {
    await pool.end();
  }
}

// Run the check
checkDatabaseConnection().catch(console.error); 
import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

// Load environment variables
dotenv.config({ path: './server/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup',
  connectionTimeoutMillis: 5000,
});

async function checkAndCreateUser() {
  try {
    console.log('🔍 Checking users in syncbridge_backup database...\n');
    
    const client = await pool.connect();
    
    // Check if users table exists and has data
    const usersResult = await client.query(`
      SELECT id, name, email, role, is_active, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Found ${usersResult.rows.length} users in database:`);
    usersResult.rows.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email}) - ${user.role} - ${user.is_active ? 'Active' : 'Inactive'}`);
    });
    
    if (usersResult.rows.length === 0) {
      console.log('\n⚠️  No users found! Creating a test admin user...');
      
      // Create a test admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const insertResult = await client.query(`
        INSERT INTO users (name, email, password, role, is_active, is_super_admin, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, name, email, role
      `, ['Admin User', 'admin@syncbridge.com', hashedPassword, 'admin', true, true]);
      
      console.log('✅ Created admin user:');
      console.log(`   Email: admin@syncbridge.com`);
      console.log(`   Password: admin123`);
      console.log(`   Role: admin`);
    } else {
      console.log('\n✅ Users found in database. You can use any of the existing users to login.');
    }
    
    client.release();
    console.log('\n✅ Database check completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.code === '42P01') {
      console.log('\n💡 The users table does not exist. You may need to run database migrations first.');
    } else if (error.code === '3D000') {
      console.log('\n💡 Database does not exist. Please create the syncbridge_backup database first.');
    }
  } finally {
    await pool.end();
  }
}

checkAndCreateUser();

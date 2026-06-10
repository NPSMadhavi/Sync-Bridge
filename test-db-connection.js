import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './server/.env' });

async function testConnection() {
  console.log('🔍 Testing Database Connection to syncbridge_backup...\n');
  
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/syncbridge_backup';
  console.log('📋 Database URL:', dbUrl.replace(/:[^:@]*@/, ':****@'));
  
  const pool = new Pool({
    connectionString: dbUrl,
    connectionTimeoutMillis: 5000,
  });
  
  try {
    console.log('🔄 Attempting to connect...');
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    const result = await client.query('SELECT current_database() as db_name, current_user as user');
    console.log('📊 Connected to:', result.rows[0].db_name);
    console.log('👤 User:', result.rows[0].user);
    
    client.release();
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();

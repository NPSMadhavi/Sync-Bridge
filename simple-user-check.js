import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:root@localhost:5432/syncbridge_backup',
  connectionTimeoutMillis: 5000,
});

async function checkUsers() {
  try {
    console.log('Checking users in syncbridge_backup...');
    const client = await pool.connect();
    
    // Check if users table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Users table does not exist!');
      return;
    }
    
    // Get users
    const users = await client.query('SELECT id, name, email, role, is_active FROM users LIMIT 10');
    
    console.log(`Found ${users.rows.length} users:`);
    users.rows.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - ${user.role} - ${user.is_active ? 'Active' : 'Inactive'}`);
    });
    
    if (users.rows.length === 0) {
      console.log('\n⚠️  No users found! You need to create users first.');
    }
    
    client.release();
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsers();

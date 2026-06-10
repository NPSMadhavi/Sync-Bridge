import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:root@localhost:5432/syncbridge_backup',
  connectionTimeoutMillis: 5000,
});

async function test() {
  try {
    console.log('Testing connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT current_database(), current_user');
    console.log('Success! Connected to:', result.rows[0].current_database);
    console.log('User:', result.rows[0].current_user);
    client.release();
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

test();

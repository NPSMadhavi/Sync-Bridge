const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Welcome123@localhost:5432/postgres'
});

async function deleteAdmin() {
  try {
    const result = await pool.query(
      "DELETE FROM users WHERE email = 'supadmin@myrsv.com' RETURNING *"
    );

    if (result.rows.length > 0) {
      console.log('Admin user deleted successfully');
    } else {
      console.log('Admin user not found');
    }
  } catch (error) {
    console.error('Error deleting admin user:', error);
  } finally {
    await pool.end();
  }
}

deleteAdmin(); 
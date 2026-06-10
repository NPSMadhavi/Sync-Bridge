import pg from 'pg';
const { Pool } = pg;

async function checkAssets() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/syncbridge'
  });

  try {
    console.log('Checking assets in database...');
    
    // Check if assets table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'assets'
      );
    `);
    
    console.log('Assets table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      // Count assets
      const countResult = await pool.query('SELECT COUNT(*) FROM assets');
      console.log('Total assets in database:', countResult.rows[0].count);
      
      // Get sample assets
      const assetsResult = await pool.query('SELECT id, tag, type, tenant_id FROM assets LIMIT 5');
      console.log('Sample assets:', assetsResult.rows);
      
      // Check tenants
      const tenantsResult = await pool.query('SELECT id, name, slug FROM tenants');
      console.log('Tenants:', tenantsResult.rows);
    }
    
  } catch (error) {
    console.error('Error checking assets:', error);
  } finally {
    await pool.end();
  }
}

checkAssets(); 
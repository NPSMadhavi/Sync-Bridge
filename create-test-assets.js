import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'syncbridge',
  password: 'Welcome123',
  port: 5432,
});

async function createTestAssets() {
  try {
    // Get the tenant ID
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', ['test-company']);
    const tenantId = tenantResult.rows[0].id;
    
    console.log('Using tenant ID:', tenantId);

    // Create test assets
    const assets = [
      {
        tag: 'LAP001',
        type: 'Laptop',
        category: 'Computer',
        serial: 'LAP2023001',
        status: 'available',
        location: 'Office A',
        purchaseDate: '2023-01-10'
      },
      {
        tag: 'LAP002',
        type: 'Laptop',
        category: 'Computer',
        serial: 'LAP2023002',
        status: 'assigned',
        location: 'Office B',
        purchaseDate: '2023-01-15'
      },
      {
        tag: 'MON001',
        type: 'Monitor',
        category: 'Display',
        serial: 'MON2023001',
        status: 'available',
        location: 'Storage',
        purchaseDate: '2023-02-01'
      },
      {
        tag: 'PHN001',
        type: 'Phone',
        category: 'Mobile',
        serial: 'PHN2023001',
        status: 'assigned',
        location: 'Office C',
        purchaseDate: '2023-02-10'
      },
      {
        tag: 'TAB001',
        type: 'Tablet',
        category: 'Mobile',
        serial: 'TAB2023001',
        status: 'maintenance',
        location: 'IT Department',
        purchaseDate: '2023-03-01'
      }
    ];

    for (const asset of assets) {
      const result = await pool.query(
        `INSERT INTO assets (
          tag, type, category, serial, status, location, purchase_date, tenant_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          asset.tag,
          asset.type,
          asset.category,
          asset.serial,
          asset.status,
          asset.location,
          asset.purchaseDate,
          tenantId
        ]
      );

      console.log('Created asset:', {
        id: result.rows[0].id,
        tag: result.rows[0].tag,
        type: result.rows[0].type,
        status: result.rows[0].status
      });
    }

    console.log('Successfully created', assets.length, 'test assets');

  } catch (error) {
    console.error('Error creating test assets:', error);
  } finally {
    await pool.end();
  }
}

createTestAssets(); 
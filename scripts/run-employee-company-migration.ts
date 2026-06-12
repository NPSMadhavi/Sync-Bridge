import pg from 'pg';
import { ensureEmployeeCompanySchema } from '../server/ensure-schema.ts';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/syncbridge',
});

await ensureEmployeeCompanySchema(pool);

const cols = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'employees' AND column_name = 'company_id'
`);
console.log('company_id column exists:', cols.rows.length > 0);

const sample = await pool.query(`
  SELECT e.id, e.employee_id, e.name, e.company_id, c.company_name
  FROM employees e
  LEFT JOIN companies c ON c.id = e.company_id
  LIMIT 5
`);
console.log('Sample employees:', JSON.stringify(sample.rows, null, 2));

await pool.end();

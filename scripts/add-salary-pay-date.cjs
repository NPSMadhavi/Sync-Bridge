const pg = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Sahu123@localhost:5432/syncbridge';
const pool = new pg.Pool({ connectionString });

async function run() {
  try {
    console.log('Connecting to database...');
    console.log('Checking employee_payroll columns...');
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'employee_payroll' 
      ORDER BY ordinal_position
    `);
    console.log('Columns before:', result.rows.map(r => r.column_name));
    
    console.log('Adding salary_pay_date column if not exists...');
    await pool.query('ALTER TABLE employee_payroll ADD COLUMN IF NOT EXISTS salary_pay_date date;');
    console.log('Successfully added salary_pay_date column!');

    const afterResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'employee_payroll' 
      ORDER BY ordinal_position
    `);
    console.log('Columns after:', afterResult.rows.map(r => r.column_name));
  } catch (err) {
    console.error('Error adding column to employee_payroll:', err);
  } finally {
    await pool.end();
  }
}

run();

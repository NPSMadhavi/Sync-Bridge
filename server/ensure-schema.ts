/**
 * Idempotent schema patches for columns added after initial deploy.
 */
export async function ensurePayrollSchema(pool: { query: (sql: string) => Promise<unknown> }) {
  const statements = [
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS pr_status TEXT`,
    `DO $$ BEGIN
      ALTER TYPE nationality ADD VALUE IF NOT EXISTS 'citizen';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      ALTER TYPE nationality ADD VALUE IF NOT EXISTS 'pr';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `ALTER TABLE employee_payroll ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2)`,
    `ALTER TABLE employee_payroll ADD COLUMN IF NOT EXISTS employer_cpf_rate DECIMAL(5,2) DEFAULT 0.00`,
    `ALTER TABLE employee_payroll ADD COLUMN IF NOT EXISTS employer_cpf_amount DECIMAL(12,2)`,
    `ALTER TABLE employee_payroll ADD COLUMN IF NOT EXISTS no_of_working_days INTEGER`,
    `ALTER TABLE payroll_configurations ADD COLUMN IF NOT EXISTS no_of_working_days INTEGER`,
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      // employee_payroll may not exist on very old installs
      if (err?.message?.includes("employee_payroll")) continue;
      console.warn("[ensure-schema]", err.message);
    }
  }
}

export async function ensureCompaniesSchema(pool: { query: (sql: string) => Promise<unknown> }) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id),
      company_name TEXT NOT NULL,
      uen_number TEXT NOT NULL,
      address TEXT,
      phone_number TEXT,
      website TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `ALTER TABLE companies ALTER COLUMN address DROP NOT NULL`,
    `ALTER TABLE companies ALTER COLUMN phone_number DROP NOT NULL`,
    `ALTER TABLE companies ALTER COLUMN website DROP NOT NULL`,
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.warn("[ensure-schema] companies table:", err.message);
    }
  }
}

export async function ensureEmployeeCompanySchema(pool: { query: (sql: string) => Promise<unknown> }) {
  const statements = [
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)`,
    `CREATE TABLE IF NOT EXISTS employee_company_history (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id),
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      employee_code TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      company_id INTEGER REFERENCES companies(id),
      company_name TEXT NOT NULL,
      date_changed TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    )`,
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.warn("[ensure-schema] employee company:", err.message);
    }
  }
}

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
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS payroll_month INTEGER`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS payroll_year INTEGER`,
    `UPDATE payroll_records
      SET payroll_month = EXTRACT(MONTH FROM pay_period_start::date)::integer,
          payroll_year = EXTRACT(YEAR FROM pay_period_start::date)::integer
      WHERE payroll_month IS NULL OR payroll_year IS NULL`,
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

export async function ensureRunningNumbersSchema(pool: { query: (sql: string) => Promise<unknown> }) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS running_numbers (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      module_name TEXT NOT NULL,
      prefix TEXT NOT NULL,
      next_counter INTEGER NOT NULL,
      suffix TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS module_name TEXT`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS prefix TEXT`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS next_counter INTEGER`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS suffix TEXT DEFAULT ''`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `UPDATE running_numbers SET tenant_id = 1 WHERE tenant_id IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS running_numbers_tenant_module_unique ON running_numbers(tenant_id, module_name)`,
    `CREATE INDEX IF NOT EXISTS idx_running_numbers_tenant_id ON running_numbers(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_running_numbers_module_name ON running_numbers(module_name)`,
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.warn("[ensure-schema] running numbers:", err.message);
    }
  }
}

export async function ensureEmployeeCompanySchema(pool: { query: (sql: string) => Promise<unknown> }) {
  const statements = [
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS nric_expiry TIMESTAMP`,
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

export async function ensureUserPermissionsSchema(pool: { query: (sql: string) => Promise<unknown> }) {
  const statements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS send_reminder_emails BOOLEAN NOT NULL DEFAULT false`,
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.warn("[ensure-schema] user permissions:", err.message);
    }
  }
}

export async function ensureAssetTenantSchema(pool: { query: (sql: string) => Promise<unknown> }) {
  const statements = [
    `UPDATE assets SET tenant_id = 1 WHERE tenant_id IS NULL`,
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.warn("[ensure-schema] asset tenant backfill:", err.message);
    }
  }
}

export async function ensureEmployeeReminderSchema(pool: { query: (sql: string) => Promise<unknown> }) {
  const statements = [
    `DO $$ BEGIN
      CREATE TYPE document_reminder_status AS ENUM ('pending', 'sent', 'snoozed', 'closed');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS annual_salary DECIMAL(12,2)`,
    `UPDATE employees SET annual_salary = salary * 12 WHERE annual_salary IS NULL AND salary IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS document_reminder_history (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id),
      employee_id INTEGER REFERENCES employees(id),
      dependent_id INTEGER REFERENCES dependents(id),
      entity_id INTEGER,
      document_type TEXT NOT NULL,
      expiry_date TIMESTAMP,
      reminder_date TIMESTAMP NOT NULL,
      status document_reminder_status NOT NULL DEFAULT 'pending',
      reminder_kind TEXT,
      start_date TIMESTAMP,
      end_date TIMESTAMP,
      email_sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `ALTER TABLE document_reminder_history ALTER COLUMN employee_id DROP NOT NULL`,
    `ALTER TABLE document_reminder_history ADD COLUMN IF NOT EXISTS entity_id INTEGER`,
    `CREATE TABLE IF NOT EXISTS document_reminders (
      id SERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES company_documents(id) ON DELETE CASCADE,
      days_before INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS license_reminders (
      id SERIAL PRIMARY KEY,
      license_id INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
      days_before INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.warn("[ensure-schema] employee reminder:", err.message);
    }
  }
}

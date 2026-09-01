/**
 * Idempotent schema patches for columns added after initial deploy.
 */
type QueryPool = { query: (sql: string) => Promise<unknown> };

export async function runAllSchemaPatches(pool: {
  query?: (sql: string, values?: unknown[]) => Promise<unknown>;
  connect?: () => Promise<{
    query: (sql: string, values?: unknown[]) => Promise<unknown>;
    release: () => void;
  }>;
}) {
  let queryPool: QueryPool;
  let releaseClient: (() => void) | null = null;

  if (typeof pool.connect === "function") {
    const client = await pool.connect();
    releaseClient = () => client.release();
    queryPool = {
      query: (sql: string) => client.query(sql),
    };
  } else if (typeof pool.query === "function") {
    queryPool = {
      query: (sql: string) => pool.query!(sql),
    };
  } else {
    throw new Error("Database pool does not support query or connect");
  }

  try {
    await ensurePayrollSchema(queryPool);
    await ensureCompaniesSchema(queryPool);
    await ensureEmployeeCompanySchema(queryPool);
    await ensureEmployeeCompanySalariesSchema(queryPool);
    await ensurePayrollSnapshotSchema(queryPool);
    await ensureRunningNumbersSchema(queryPool);
    await ensureUserPermissionsSchema(queryPool);
    await ensureAssetTenantSchema(queryPool);
    await ensureEmployeeReminderSchema(queryPool);
  } finally {
    releaseClient?.();
  }
}

export async function ensurePayrollSchema(pool: QueryPool) {
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
    `ALTER TABLE employee_payroll ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)`,
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
      counter_pad_length INTEGER NOT NULL DEFAULT 0,
      suffix TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS module_name TEXT`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS prefix TEXT`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS next_counter INTEGER`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS counter_pad_length INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS suffix TEXT DEFAULT ''`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `UPDATE running_numbers SET tenant_id = 1 WHERE tenant_id IS NULL`,
    `ALTER TABLE running_numbers DROP CONSTRAINT IF EXISTS running_numbers_module_name_key`,
    `DROP INDEX IF EXISTS running_numbers_module_name_key`,
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
      effective_from DATE,
      effective_to DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `ALTER TABLE employee_company_history ADD COLUMN IF NOT EXISTS effective_from DATE`,
    `ALTER TABLE employee_company_history ADD COLUMN IF NOT EXISTS effective_to DATE`,
    `ALTER TABLE employee_company_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)`,
    `UPDATE employee_company_history
      SET effective_from = date_changed::date
      WHERE effective_from IS NULL AND date_changed IS NOT NULL`,
    `WITH ordered AS (
      SELECT
        id,
        LEAD(date_changed::date) OVER (
          PARTITION BY employee_id
          ORDER BY date_changed ASC, id ASC
        ) AS next_effective_from
      FROM employee_company_history
    )
    UPDATE employee_company_history AS h
    SET
      effective_to = (o.next_effective_from - INTERVAL '1 day')::date,
      updated_at = NOW()
    FROM ordered AS o
    WHERE h.id = o.id
      AND o.next_effective_from IS NOT NULL
      AND h.effective_to IS NULL`,
    `INSERT INTO employee_company_history (
      tenant_id, employee_id, employee_code, employee_name, company_id, company_name,
      date_changed, effective_from, effective_to, created_at, updated_at
    )
    SELECT
      e.tenant_id, e.id, e.employee_id, e.name, e.company_id, c.company_name,
      COALESCE(e.join_date, NOW()), COALESCE(e.join_date::date, CURRENT_DATE), NULL, NOW(), NOW()
    FROM employees e
    INNER JOIN companies c ON c.id = e.company_id
    WHERE e.company_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM employee_company_history h WHERE h.employee_id = e.id
      )`,
    `UPDATE payroll_records pr
      SET company_id = e.company_id
      FROM employees e
      WHERE pr.employee_id = e.id
        AND pr.company_id IS NULL
        AND e.company_id IS NOT NULL`,
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.warn("[ensure-schema] employee company:", err.message);
    }
  }
}

export async function ensureEmployeeCompanySalariesSchema(pool: { query: (sql: string) => Promise<unknown> }) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS employee_company_salaries (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id),
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      company_name TEXT NOT NULL,
      salary DECIMAL(12,2),
      annual_salary DECIMAL(12,2),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS employee_company_salaries_employee_company_unique
      ON employee_company_salaries(employee_id, company_id)`,
    `INSERT INTO employee_company_salaries (
      tenant_id, employee_id, company_id, company_name, salary, annual_salary, created_at, updated_at
    )
    SELECT
      e.tenant_id, e.id, e.company_id, c.company_name, e.salary, e.annual_salary, NOW(), NOW()
    FROM employees e
    INNER JOIN companies c ON c.id = e.company_id
    WHERE e.company_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM employee_company_salaries ecs WHERE ecs.employee_id = e.id
      )`,
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.warn("[ensure-schema] employee company salaries:", err.message);
    }
  }
}

export async function ensurePayrollSnapshotSchema(pool: { query: (sql: string) => Promise<unknown> }) {
  const statements = [
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS employee_code TEXT`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS employee_name TEXT`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS employee_email TEXT`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS designation TEXT`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS department TEXT`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS annual_salary DECIMAL(12,2)`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS monthly_salary DECIMAL(12,2)`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS company_name TEXT`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS company_address TEXT`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS ic_no TEXT`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS employer_cpf_amount DECIMAL(12,2)`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS no_of_working_days INTEGER`,
    `UPDATE payroll_records pr
      SET
        employee_code = COALESCE(pr.employee_code, e.employee_id),
        employee_name = COALESCE(pr.employee_name, e.name),
        employee_email = COALESCE(pr.employee_email, e.email),
        designation = COALESCE(pr.designation, e.designation),
        department = COALESCE(pr.department, e.department),
        annual_salary = COALESCE(pr.annual_salary, pr.base_salary * 12),
        monthly_salary = COALESCE(pr.monthly_salary, pr.base_salary),
        company_name = COALESCE(pr.company_name, c.company_name),
        company_address = COALESCE(pr.company_address, c.address)
      FROM employees e
      LEFT JOIN companies c ON c.id = COALESCE(pr.company_id, e.company_id)
      WHERE pr.employee_id = e.id
        AND pr.employee_name IS NULL
        AND pr.gross_pay IS NOT NULL`,
    `UPDATE payroll_records pr
      SET
        employer_cpf_amount = COALESCE(pr.employer_cpf_amount, ep.employer_cpf_amount),
        no_of_working_days = COALESCE(pr.no_of_working_days, ep.no_of_working_days)
      FROM employee_payroll ep
      WHERE pr.payroll_config_id = ep.id
        AND (pr.employer_cpf_amount IS NULL OR pr.no_of_working_days IS NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS payroll_records_employee_company_month_year_unique
      ON payroll_records (employee_id, company_id, payroll_month, payroll_year)
      WHERE payroll_month IS NOT NULL
        AND payroll_year IS NOT NULL
        AND company_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS payroll_records_employee_month_year_no_company_unique
      ON payroll_records (employee_id, payroll_month, payroll_year)
      WHERE payroll_month IS NOT NULL
        AND payroll_year IS NOT NULL
        AND company_id IS NULL`,
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.warn("[ensure-schema] payroll snapshot:", err.message);
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

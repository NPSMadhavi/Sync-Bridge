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

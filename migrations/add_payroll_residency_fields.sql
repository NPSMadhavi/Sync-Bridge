-- Residency type values and PR status for Singapore payroll
DO $$ BEGIN
  ALTER TYPE nationality ADD VALUE IF NOT EXISTS 'citizen';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE nationality ADD VALUE IF NOT EXISTS 'pr';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS pr_status TEXT;

UPDATE employees SET nationality = 'citizen' WHERE nationality = 'singaporean_pr';

ALTER TABLE employee_payroll ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2);
ALTER TABLE employee_payroll ADD COLUMN IF NOT EXISTS employer_cpf_rate DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE employee_payroll ADD COLUMN IF NOT EXISTS employer_cpf_amount DECIMAL(12,2);

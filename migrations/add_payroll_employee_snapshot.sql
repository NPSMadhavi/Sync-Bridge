-- Payroll historical snapshot columns
-- Stores employee/company/salary details frozen at payroll generation time.

ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS employee_code TEXT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS employee_email TEXT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS annual_salary DECIMAL(12,2);
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS monthly_salary DECIMAL(12,2);
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS ic_no TEXT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS employer_cpf_amount DECIMAL(12,2);
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS no_of_working_days INTEGER;

-- Backfill existing payroll records from current employee/company data (best-effort)
UPDATE payroll_records pr
SET
  employee_code = e.employee_id,
  employee_name = e.name,
  employee_email = e.email,
  designation = e.designation,
  department = e.department,
  annual_salary = COALESCE(pr.annual_salary, e.annual_salary, e.salary * 12),
  monthly_salary = COALESCE(pr.monthly_salary, e.salary, pr.base_salary),
  company_name = COALESCE(pr.company_name, c.company_name),
  company_address = COALESCE(pr.company_address, c.address)
FROM employees e
LEFT JOIN companies c ON c.id = COALESCE(pr.company_id, e.company_id)
WHERE pr.employee_id = e.id
  AND pr.employee_name IS NULL;

UPDATE payroll_records pr
SET
  employer_cpf_amount = COALESCE(pr.employer_cpf_amount, ep.employer_cpf_amount),
  no_of_working_days = COALESCE(pr.no_of_working_days, ep.no_of_working_days)
FROM employee_payroll ep
WHERE pr.payroll_config_id = ep.id
  AND (pr.employer_cpf_amount IS NULL OR pr.no_of_working_days IS NULL);

-- One payroll per employee + company + month + year (multi-company support)
CREATE UNIQUE INDEX IF NOT EXISTS payroll_records_employee_company_month_year_unique
  ON payroll_records (employee_id, company_id, payroll_month, payroll_year)
  WHERE payroll_month IS NOT NULL
    AND payroll_year IS NOT NULL
    AND company_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payroll_records_employee_month_year_no_company_unique
  ON payroll_records (employee_id, payroll_month, payroll_year)
  WHERE payroll_month IS NOT NULL
    AND payroll_year IS NOT NULL
    AND company_id IS NULL;

-- Employee company history: effective date ranges for historical payslip company resolution
-- Backward compatible with existing date_changed rows

ALTER TABLE employee_company_history
  ADD COLUMN IF NOT EXISTS effective_from DATE,
  ADD COLUMN IF NOT EXISTS effective_to DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Migrate legacy rows: effective_from from date_changed
UPDATE employee_company_history
SET effective_from = date_changed::date
WHERE effective_from IS NULL AND date_changed IS NOT NULL;

-- Close overlapping legacy history per employee (ordered by assignment date)
WITH ordered AS (
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
  AND h.effective_to IS NULL;

-- Seed initial history for employees with a company but no history row
INSERT INTO employee_company_history (
  tenant_id,
  employee_id,
  employee_code,
  employee_name,
  company_id,
  company_name,
  date_changed,
  effective_from,
  effective_to,
  created_at,
  updated_at
)
SELECT
  e.tenant_id,
  e.id,
  e.employee_id,
  e.name,
  e.company_id,
  c.company_name,
  COALESCE(e.join_date, NOW()),
  COALESCE(e.join_date::date, CURRENT_DATE),
  NULL,
  NOW(),
  NOW()
FROM employees e
INNER JOIN companies c ON c.id = e.company_id
WHERE e.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM employee_company_history h
    WHERE h.employee_id = e.id
  );

-- Store resolved company on each payroll record (historical payslip snapshot)
ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

-- Backfill payroll_records.company_id from employee's company at processing time (best effort)
UPDATE payroll_records pr
SET company_id = e.company_id
FROM employees e
WHERE pr.employee_id = e.id
  AND pr.company_id IS NULL
  AND e.company_id IS NOT NULL;

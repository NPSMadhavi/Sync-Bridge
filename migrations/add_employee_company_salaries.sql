-- Multi-company salary support for employees
CREATE TABLE IF NOT EXISTS employee_company_salaries (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id),
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  company_name TEXT NOT NULL,
  salary DECIMAL(12,2),
  annual_salary DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_company_salaries_employee_company_unique
  ON employee_company_salaries(employee_id, company_id);

-- Backfill from existing single-company employees
INSERT INTO employee_company_salaries (
  tenant_id, employee_id, company_id, company_name, salary, annual_salary, created_at, updated_at
)
SELECT
  e.tenant_id, e.id, e.company_id, c.company_name, e.salary, e.annual_salary, NOW(), NOW()
FROM employees e
INNER JOIN companies c ON c.id = e.company_id
WHERE e.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM employee_company_salaries ecs WHERE ecs.employee_id = e.id
  );

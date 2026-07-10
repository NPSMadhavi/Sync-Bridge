-- Fix legacy unique constraint that blocked per-tenant running numbers
ALTER TABLE running_numbers DROP CONSTRAINT IF EXISTS running_numbers_module_name_key;
DROP INDEX IF EXISTS running_numbers_module_name_key;

ALTER TABLE running_numbers ADD COLUMN IF NOT EXISTS counter_pad_length INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS running_numbers_tenant_module_unique
  ON running_numbers(tenant_id, module_name);

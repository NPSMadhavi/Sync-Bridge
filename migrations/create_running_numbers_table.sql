-- Running number configuration per tenant and module
CREATE TABLE IF NOT EXISTS running_numbers (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  next_counter INTEGER NOT NULL,
  counter_pad_length INTEGER NOT NULL DEFAULT 0,
  suffix TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT running_numbers_tenant_module_unique UNIQUE(tenant_id, module_name)
);

CREATE INDEX IF NOT EXISTS idx_running_numbers_tenant_id ON running_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_running_numbers_module_name ON running_numbers(module_name);

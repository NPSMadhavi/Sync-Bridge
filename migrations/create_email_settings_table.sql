-- Create email_settings table for storing SMTP configuration
CREATE TABLE IF NOT EXISTS email_settings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_secure TEXT NOT NULL DEFAULT 'STARTTLS', -- None, SSL/TLS, STARTTLS
  smtp_user TEXT NOT NULL,
  smtp_pass TEXT NOT NULL,
  email_from TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_tenant_email_settings UNIQUE(tenant_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_settings_tenant_id ON email_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_settings_active ON email_settings(is_active);

-- Insert default email settings for existing tenants
INSERT INTO email_settings (tenant_id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, email_from, is_active)
SELECT 
  t.id,
  'mail.myrsv.com',
  587,
  'STARTTLS',
  'shakuntala@myrsv.com',
  'Shak@UBI752#$',
  'shakuntala@myrsv.com',
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM email_settings es WHERE es.tenant_id = t.id
)
ON CONFLICT (tenant_id) DO NOTHING;

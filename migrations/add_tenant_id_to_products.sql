-- Add tenant_id column to products table
ALTER TABLE products ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);

-- Update existing products to have a default tenant (you may need to adjust this based on your data)
-- For now, we'll set them to NULL to avoid constraint issues
-- You can update them later based on your business logic
UPDATE products SET tenant_id = NULL WHERE tenant_id IS NULL; 
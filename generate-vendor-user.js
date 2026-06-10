const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

async function generateVendorUser() {
  const password = 'Aleem1786';
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scrypt(password, salt, 64);
  const hashedPassword = `${buf.toString('hex')}.${salt}`;

  console.log('Generated password hash:', hashedPassword);
  console.log('\n--- PostgreSQL INSERT Query ---');
  console.log(`
INSERT INTO users (
  name, 
  email, 
  role, 
  password, 
  is_super_admin, 
  is_email_verified, 
  is_active, 
  allowed_modules, 
  created_at
) VALUES (
  'Asty Services',
  'info@astyservices.com',
  'vendor',
  '${hashedPassword}',
  false,
  true,
  true,
  ARRAY['dashboard', 'vendors', 'customers', 'invoices', 'reports'],
  NOW()
);`);
}

generateVendorUser().catch(console.error);

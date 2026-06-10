const crypto = require('crypto');

// Generate a sample hash using the same algorithm as the auth.ts file
const password = 'Aleem1786';
const salt = crypto.randomBytes(16).toString('hex');

// Use scrypt with the same parameters as in auth.ts
crypto.scrypt(password, salt, 64, (err, derivedKey) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  const hashedPassword = `${derivedKey.toString('hex')}.${salt}`;
  
  console.log('Password:', password);
  console.log('Salt:', salt);
  console.log('Hashed Password:', hashedPassword);
  
  console.log('\n--- Ready-to-Run PostgreSQL INSERT Query ---');
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
});
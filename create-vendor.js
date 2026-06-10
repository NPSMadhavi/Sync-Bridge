const crypto = require('crypto');

// Generate password hash using the same method as the application
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync('Aleem1786', salt, 1000, 64, 'sha512').toString('hex');
const hashedPassword = `${hash}.${salt}`;

console.log('-- SQL Query to create vendor user:');
console.log(`INSERT INTO users (name, email, role, password, is_super_admin, is_email_verified, is_active, created_at) VALUES ('Asty Services', 'info@astyservices.com', 'vendor', '${hashedPassword}', false, true, true, NOW());`);

console.log('\n-- Password details:');
console.log(`Original password: Aleem1786`);
console.log(`Hashed password: ${hashedPassword}`);
console.log(`Salt: ${salt}`);
console.log(`Hash: ${hash}`);

const crypto = require('crypto');

// Generate password hash using the same method as the application
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync('Aleem1786', salt, 1000, 64, 'sha512').toString('hex');
const hashedPassword = `${hash}.${salt}`;

console.log('Generated SQL Query for vendor user:');
console.log(`INSERT INTO users (name, email, role, password, is_super_admin, is_email_verified, is_active, created_at) VALUES ('Asty Services', 'info@astyservices.com', 'vendor', '${hashedPassword}', false, true, true, NOW());`);

console.log('\nPassword details:');
console.log(`Salt: ${salt}`);
console.log(`Hash: ${hash}`);
console.log(`Full hashed password: ${hashedPassword}`);

// Test verification
const testPassword = 'Aleem1786';
const [storedHash, storedSalt] = hashedPassword.split('.');
const testHash = crypto.pbkdf2Sync(testPassword, storedSalt, 1000, 64, 'sha512');
const storedHashBuf = Buffer.from(storedHash, 'hex');

console.log('\nVerification test:');
console.log(`Test password: ${testPassword}`);
console.log(`Verification result: ${crypto.timingSafeEqual(testHash, storedHashBuf)}`);

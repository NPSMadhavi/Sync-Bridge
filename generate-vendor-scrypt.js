const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scrypt(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function generateVendorUser() {
  const password = "Aleem1786";
  const hashedPassword = await hashPassword(password);
  
  console.log('-- SQL Query to create vendor user (using scrypt):');
  console.log(`INSERT INTO users (name, email, role, password, is_super_admin, is_email_verified, is_active, created_at) VALUES ('Asty Services', 'info@astyservices.com', 'vendor', '${hashedPassword}', false, true, true, NOW());`);
  
  console.log('\n-- Password details:');
  console.log(`Original password: ${password}`);
  console.log(`Hashed password: ${hashedPassword}`);
  
  // Test verification
  const [storedHash, storedSalt] = hashedPassword.split('.');
  const testBuf = await scrypt(password, storedSalt, 64);
  const storedHashBuf = Buffer.from(storedHash, 'hex');
  
  console.log(`Verification test: ${crypto.timingSafeEqual(testBuf, storedHashBuf)}`);
}

generateVendorUser().catch(console.error);

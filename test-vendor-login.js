const crypto = require('crypto');

// Test password hashing and verification
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${hash}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split('.');
  
  if (!hashed || !salt) {
    console.log('Invalid password format: missing hash or salt');
    return false;
  }
  
  try {
    const hashedBuf = Buffer.from(hashed, 'hex');
    const suppliedBuf = crypto.pbkdf2Sync(supplied, salt, 1000, 64, 'sha512');
    return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
}

// Test the password
const password = 'Aleem1786';
const hashedPassword = hashPassword(password);

console.log('Testing password hashing and verification:');
console.log(`Original password: ${password}`);
console.log(`Hashed password: ${hashedPassword}`);

// Test verification
comparePasswords(password, hashedPassword).then(isValid => {
  console.log(`Password verification result: ${isValid}`);
  
  if (isValid) {
    console.log('\n✅ Password hashing and verification works correctly!');
    console.log('\nSQL Query to create vendor user:');
    console.log(`INSERT INTO users (name, email, role, password, is_super_admin, is_email_verified, is_active, created_at) VALUES ('Asty Services', 'info@astyservices.com', 'vendor', '${hashedPassword}', false, true, true, NOW());`);
  } else {
    console.log('\n❌ Password verification failed!');
  }
}).catch(console.error);

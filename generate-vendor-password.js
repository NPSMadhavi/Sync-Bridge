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
  
  console.log("-- SQL Query to create vendor user:");
  console.log(`INSERT INTO users (name, email, role, password, is_super_admin, is_email_verified, is_active, created_at) VALUES ('Asty Services', 'info@astyservices.com', 'vendor', '${hashedPassword}', false, true, true, NOW());`);
  
  console.log("\n-- Password hash details:");
  console.log(`Original password: ${password}`);
  console.log(`Hashed password: ${hashedPassword}`);
}

generateVendorUser().catch(console.error);

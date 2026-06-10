-- SQL Query to create vendor user
-- Password: Aleem1786
-- Email: info@astyservices.com
-- Role: vendor

-- Note: You'll need to generate the password hash using Node.js
-- Run this in Node.js to get the hashed password:
-- const crypto = require('crypto');
-- const salt = crypto.randomBytes(16).toString('hex');
-- const hash = crypto.pbkdf2Sync('Aleem1786', salt, 1000, 64, 'sha512').toString('hex');
-- const hashedPassword = hash + '.' + salt;
-- console.log(hashedPassword);

-- Then replace the hashed password below with the generated value
INSERT INTO users (name, email, role, password, is_super_admin, is_email_verified, is_active, created_at) 
VALUES ('Asty Services', 'info@astyservices.com', 'vendor', 'REPLACE_WITH_HASHED_PASSWORD', false, true, true, NOW());

-- Example with a sample hash (you need to generate your own):
-- INSERT INTO users (name, email, role, password, is_super_admin, is_email_verified, is_active, created_at) 
-- VALUES ('Asty Services', 'info@astyservices.com', 'vendor', 'a1b2c3d4e5f6...', false, true, true, NOW());

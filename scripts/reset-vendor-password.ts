import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from server/.env
config({ path: join(__dirname, '..', 'server', '.env') });

import { hashPassword } from '../server/auth.ts';
import { storage } from '../server/storage.ts';

async function resetVendorPassword() {
  try {
    const email = 'aleemdough@syncbridge.com';
    const newPassword = 'vendor123'; // You can change this password
    
    console.log(`Resetting password for user: ${email}`);
    
    // Get the user
    const user = await storage.getUserByEmail(email);
    if (!user) {
      console.error('User not found:', email);
      return;
    }
    
    console.log('User found:', user.name, user.email, user.role);
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the user's password
    const updatedUser = await storage.updateUser(user.id, {
      password: hashedPassword
    });
    
    if (updatedUser) {
      console.log('Password reset successful!');
      console.log('New password:', newPassword);
      console.log('User can now login with this password');
    } else {
      console.error('Failed to update password');
    }
    
  } catch (error) {
    console.error('Error resetting password:', error);
  }
}

resetVendorPassword(); 
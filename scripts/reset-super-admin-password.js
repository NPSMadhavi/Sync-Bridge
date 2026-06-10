import bcrypt from 'bcrypt';
import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function resetSuperAdminPassword() {
  try {
    const email = 'supadmin@syncbridge.com';
    const newPassword = 'admin123'; // You can change this to your preferred password
    
    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update the user in the database
    const [updatedUser] = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.email, email))
      .returning();
    
    if (updatedUser) {
      console.log('✅ Super admin password reset successfully!');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 New Password: ${newPassword}`);
      console.log('⚠️  Please change this password after logging in for security.');
    } else {
      console.log('❌ User not found with email:', email);
    }
    
  } catch (error) {
    console.error('❌ Error resetting super admin password:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
resetSuperAdminPassword(); 
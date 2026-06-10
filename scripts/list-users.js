import { db } from '../server/db.ts';
import { users } from '../shared/schema.ts';

async function main() {
  try {
    const list = await db.select().from(users);
    console.log('Users:', JSON.stringify(list.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, tenantId: u.tenantId })), null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

main();

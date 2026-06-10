import { db } from '../server/db.ts';
import { invoices } from '../shared/schema.ts';

async function main() {
  try {
    const list = await db.select().from(invoices);
    console.log('Invoices count:', list.length);
    console.log('Invoices:', JSON.stringify(list, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

main();

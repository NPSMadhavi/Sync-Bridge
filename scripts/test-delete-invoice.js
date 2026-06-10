import { storage } from '../server/storage.ts';

async function main() {
  try {
    console.log('Testing deleteInvoice on a non-existent ID first:');
    await storage.deleteInvoice(9999);
    console.log('No error on non-existent delete.');
  } catch (error) {
    console.error('Error deleting non-existent:', error);
  }
  process.exit(0);
}

main();

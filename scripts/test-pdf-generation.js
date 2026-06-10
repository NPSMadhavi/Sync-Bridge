import { storage } from '../server/storage.ts';
import { db } from '../server/db.ts';
import { invoiceDesigns } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  try {
    const invoiceId = 1;
    const invoice = await storage.getInvoice(invoiceId);
    console.log('Invoice:', invoice);
    if (invoice) {
      const items = await storage.getInvoiceItemsByInvoiceId(invoiceId);
      const customer = await storage.getCustomer(invoice.customerId || 0);
      const [design] = await db.select().from(invoiceDesigns).where(eq(invoiceDesigns.invoiceId, invoiceId));
      
      console.log('Items count:', items.length);
      console.log('Customer:', customer);
      console.log('Design:', design);
      
      // Let's check if puppeteer is installed/works
      console.log('Testing puppeteer launch...');
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox']
      });
      console.log('Puppeteer browser launched successfully!');
      await browser.close();
    }
  } catch (error) {
    console.error('Error during PDF generation test:', error);
  }
  process.exit(0);
}

main();

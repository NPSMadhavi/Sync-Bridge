import { storage } from '../server/storage.ts';
import { db } from '../server/db.ts';
import { invoiceDesigns } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';
import { generateInvoicePDF } from '../server/routes/invoices.ts';
import fs from 'fs';

async function main() {
  try {
    const invoiceId = 1;
    const invoice = await storage.getInvoice(invoiceId);
    if (invoice) {
      const items = await storage.getInvoiceItemsByInvoiceId(invoiceId);
      const customer = await storage.getCustomer(invoice.customerId || 0);
      const [design] = await db.select().from(invoiceDesigns).where(eq(invoiceDesigns.invoiceId, invoiceId));
      
      console.log('Generating PDF...');
      const buffer = await generateInvoicePDF(invoice, items, customer, design);
      fs.writeFileSync('test-invoice-1.pdf', buffer);
      console.log('PDF saved to test-invoice-1.pdf successfully! Size:', buffer.length, 'bytes');
    }
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

main();

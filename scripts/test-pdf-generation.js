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
      
      console.log('Testing pure Node PDF generation...');
      const { generateInvoicePDF } = await import('../server/routes/invoices.ts');
      const buffer = await generateInvoicePDF(invoice, items, customer, design);
      console.log('PDF generated successfully without browser! Size:', buffer.length, 'bytes');
    }
  } catch (error) {
    console.error('Error during PDF generation test:', error);
  }
  process.exit(0);
}

main();

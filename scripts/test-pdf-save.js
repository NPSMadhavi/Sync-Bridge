import { storage } from '../server/storage.ts';
import { db } from '../server/db.ts';
import { invoiceDesigns } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';
import puppeteer from 'puppeteer';
import fs from 'fs';

async function generateInvoicePDF(invoice, items, customer, design) {
  const primaryColor = design?.primaryColor || '#0891b2';
  const fontFamily = design?.fontFamily || 'Arial, sans-serif';
  const fontSize = design?.fontSize === 'small' ? '14px' : design?.fontSize === 'large' ? '20px' : '16px';
  const logoUrl = design?.logoUrl || '';
  const headerNote = design?.headerNote || '';
  const footerNote = design?.footerNote || '';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    body { 
      font-family: ${fontFamily}; 
      font-size: ${fontSize};
      margin: 0; 
      color: #333;
      line-height: 1.6;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px; 
      border-bottom: 2px solid ${primaryColor};
      padding-bottom: 20px;
    }
    .header h1 {
      color: ${primaryColor};
      margin: 0;
      font-size: 32px;
    }
    .header h2 {
      color: #666;
      margin: 10px 0 0 0;
      font-size: 18px;
    }
    .invoice-info { 
      margin-bottom: 30px; 
      display: flex;
      justify-content: space-between;
    }
    .customer-info { 
      margin-bottom: 30px; 
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
    }
    .customer-info h3 {
      color: ${primaryColor};
      margin-top: 0;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 30px; 
    }
    th, td { 
      border: 1px solid #ddd; 
      padding: 12px; 
      text-align: left; 
    }
    th { 
      background-color: ${primaryColor}; 
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f8f9fa;
    }
    .totals { 
      text-align: right; 
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
    }
    .total-row { 
      font-weight: bold; 
      font-size: 18px;
      color: ${primaryColor};
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>INVOICE</h1>
    <h2>${invoice.invoiceNumber}</h2>
  </div>
  <div class="invoice-info">
    <div>
      <p><strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString()}</p>
      <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
    </div>
  </div>
  <div class="customer-info">
    <h3>Bill To:</h3>
    <p><strong>${customer.name}</strong></p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Quantity</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
        <tr>
          <td>${item.description}</td>
          <td>${item.quantity}</td>
          <td>$${(item.unitPrice / 100).toFixed(2)}</td>
          <td>$${(item.totalPrice / 100).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>
  `;

  console.log('Launching browser with correct args...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

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

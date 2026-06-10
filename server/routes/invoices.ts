import { Router } from 'express';
import { storage } from '../storage';
import { sendEmail } from '../email';
import { requireTenant } from '../middleware/tenant';
import { eq } from 'drizzle-orm';
import { invoices, customers, invoiceItems, invoiceDesigns } from '../../shared/schema';
import { db } from '../db';
import puppeteer from 'puppeteer';

const router = Router();

// Generate PDF for invoice
router.get('/:id/pdf', requireTenant, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin' || user?.isSuperAdmin;

    // Get invoice with items and customer info
    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Verify tenant access (super admins bypass tenant check)
    if (!isSuperAdmin && tenant && invoice.tenantId !== tenant.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const items = await storage.getInvoiceItemsByInvoiceId(invoiceId);
    
    // Try to get customer from regular customers table first
    let customer = await storage.getCustomer(invoice.customerId || 0);
    
    // If not found in regular customers, try vendor customers
    if (!customer) {
      // Get all vendor customers and find the one with matching ID
      const vendorCustomers = await storage.getVendorCustomers(''); // Get all vendor customers
      const vendorCustomer = vendorCustomers.find(vc => vc.id === invoice.customerId);
      
      if (vendorCustomer) {
        // Transform vendor customer to match Customer interface
        customer = {
          id: vendorCustomer.id,
          tenantId: 0,
          name: vendorCustomer.customerName,
          email: vendorCustomer.customerEmail,
          phone: vendorCustomer.customerPhone,
          company: vendorCustomer.customerName,
          address: vendorCustomer.customerAddress,
          city: '',
          state: '',
          zipCode: '',
          country: '',
          taxId: '',
          isActive: true,
          notes: '',
          createdAt: vendorCustomer.createdAt,
        };
      }
    }

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Fetch custom design if exists
    const [design] = await db.select().from(invoiceDesigns).where(eq(invoiceDesigns.invoiceId, invoiceId));

    // Generate PDF content
    const pdfBuffer = await generateInvoicePDF(invoice, items, customer, design);

    // Set proper PDF response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Accept-Ranges', 'bytes');

    res.status(200).end(pdfBuffer);
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

// Send invoice via email
router.post('/:id/send', requireTenant, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'super_admin' || user?.isSuperAdmin;

    // Get invoice with items and customer info
    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Verify tenant access (super admins bypass tenant check)
    if (!isSuperAdmin && tenant && invoice.tenantId !== tenant.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const items = await storage.getInvoiceItemsByInvoiceId(invoiceId);
    
    // Try to get customer from regular customers table first
    let customer = await storage.getCustomer(invoice.customerId || 0);
    
    // If not found in regular customers, try vendor customers
    if (!customer) {
      // Get all vendor customers and find the one with matching ID
      const vendorCustomers = await storage.getVendorCustomers(''); // Get all vendor customers
      const vendorCustomer = vendorCustomers.find(vc => vc.id === invoice.customerId);
      
      if (vendorCustomer) {
        // Transform vendor customer to match Customer interface
        customer = {
          id: vendorCustomer.id,
          tenantId: 0,
          name: vendorCustomer.customerName,
          email: vendorCustomer.customerEmail,
          phone: vendorCustomer.customerPhone,
          company: vendorCustomer.customerName,
          address: vendorCustomer.customerAddress,
          city: '',
          state: '',
          zipCode: '',
          country: '',
          taxId: '',
          isActive: true,
          notes: '',
          createdAt: vendorCustomer.createdAt,
        };
      }
    }

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (!customer.email) {
      return res.status(400).json({ message: 'Customer email not found' });
    }

    // Generate PDF content for email attachment
    const pdfBuffer = await generateInvoicePDF(invoice, items, customer);

    // Send email with PDF attachment
    const emailSent = await sendInvoiceEmail(invoice, customer, pdfBuffer);

    if (emailSent) {
      // Update invoice status to 'sent' and mark as email sent
      await storage.updateInvoice(invoiceId, {
        status: 'sent',
        isEmailSent: true,
        emailSentAt: new Date()
      });

      res.json({ 
        message: 'Invoice sent successfully',
        emailSent: true 
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to send email',
        emailSent: false 
      });
    }
  } catch (error) {
    console.error('Error sending invoice email:', error);
    res.status(500).json({ message: 'Failed to send invoice' });
  }
});

// --- Invoice Design Customization API ---

// Get invoice design for a given invoice
router.get('/designs/:invoiceId', requireTenant, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) return res.status(400).json({ error: 'Invalid invoiceId' });
    const [design] = await db.select().from(invoiceDesigns).where(eq(invoiceDesigns.invoiceId, invoiceId));
    res.json(design || null);
  } catch (error) {
    console.error('Error fetching invoice design:', error);
    res.status(500).json({ error: 'Failed to fetch invoice design' });
  }
});

// Create or update invoice design for a given invoice
router.post('/designs/:invoiceId', requireTenant, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) return res.status(400).json({ error: 'Invalid invoiceId' });
    const data = req.body;
    // Upsert logic: try update, if not found then insert
    const [existing] = await db.select().from(invoiceDesigns).where(eq(invoiceDesigns.invoiceId, invoiceId));
    let result;
    if (existing) {
      [result] = await db.update(invoiceDesigns)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(invoiceDesigns.invoiceId, invoiceId))
        .returning();
    } else {
      [result] = await db.insert(invoiceDesigns)
        .values({
          ...data,
          invoiceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
    }
    res.json(result);
  } catch (error) {
    console.error('Error saving invoice design:', error);
    res.status(500).json({ error: 'Failed to save invoice design' });
  }
});

// Helper function to generate PDF content
async function generateInvoicePDF(invoice: any, items: any[], customer: any, design?: any): Promise<Buffer> {
  try {
    // Use design values or defaults
    const primaryColor = design?.primaryColor || '#0891b2';
    const fontFamily = design?.fontFamily || 'Arial, sans-serif';
    const fontSize = design?.fontSize === 'small' ? '14px' : design?.fontSize === 'large' ? '20px' : '16px';
    const logoUrl = design?.logoUrl || '';
    const headerNote = design?.headerNote || '';
    const footerNote = design?.footerNote || '';

    // Create HTML content
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
    .notes-section {
      margin-top: 30px;
      padding: 20px;
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      border-radius: 4px;
    }
    .payment-terms {
      margin-top: 20px;
      padding: 15px;
      background: #d1ecf1;
      border-left: 4px solid #17a2b8;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:48px;margin-bottom:12px;" />` : ''}
    <h1>INVOICE</h1>
    <h2>${invoice.invoiceNumber}</h2>
    ${headerNote ? `<div style="margin-top:12px;color:${primaryColor};font-weight:500;">${headerNote}</div>` : ''}
  </div>
  
  <div class="invoice-info">
    <div>
      <p><strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString()}</p>
      <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
    </div>
    <div>
      <p><strong>Status:</strong> <span style="color: ${invoice.status === 'paid' ? '#28a745' : invoice.status === 'overdue' ? '#dc3545' : '#ffc107'}">${invoice.status.toUpperCase()}</span></p>
      <p><strong>Currency:</strong> ${invoice.currency || 'USD'}</p>
    </div>
  </div>
  
  <div class="customer-info">
    <h3>Bill To:</h3>
    <p><strong>${customer.name}</strong></p>
    ${customer.company ? `<p><strong>Company:</strong> ${customer.company}</p>` : ''}
    ${customer.email ? `<p><strong>Email:</strong> ${customer.email}</p>` : ''}
    ${customer.phone ? `<p><strong>Phone:</strong> ${customer.phone}</p>` : ''}
    ${customer.address ? `<p><strong>Address:</strong> ${customer.address}</p>` : ''}
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
  
  <div class="totals">
    <p><strong>Subtotal:</strong> $${(invoice.subtotal / 100).toFixed(2)}</p>
    ${invoice.discountAmount > 0 ? `<p><strong>Discount:</strong> -$${(invoice.discountAmount / 100).toFixed(2)}</p>` : ''}
    ${invoice.taxAmount > 0 ? `<p><strong>Tax:</strong> $${(invoice.taxAmount / 100).toFixed(2)}</p>` : ''}
    <p class="total-row"><strong>Total:</strong> $${(invoice.totalAmount / 100).toFixed(2)}</p>
    ${invoice.paidAmount > 0 ? `<p><strong>Paid:</strong> $${(invoice.paidAmount / 100).toFixed(2)}</p>` : ''}
    <p class="total-row"><strong>Balance Due:</strong> $${(invoice.balanceAmount / 100).toFixed(2)}</p>
  </div>
  
  ${invoice.notes ? `
  <div class="notes-section">
    <h3>Notes:</h3>
    <p>${invoice.notes}</p>
  </div>
  ` : ''}
  
  ${invoice.paymentTerms ? `
  <div class="payment-terms">
    <h3>Payment Terms:</h3>
    <p>${invoice.paymentTerms}</p>
  </div>
  ` : ''}
  
  ${footerNote ? `<div style="margin-top:24px;color:${primaryColor};font-weight:500;text-align:center;">${footerNote}</div>` : ''}
  <div style="margin-top: 40px; text-align: center; color: #666; font-size: 14px;">
    <p>Thank you for your business!</p>
    <p>Generated by SyncBridge Enterprise Platform</p>
  </div>
</body>
</html>
    `;

    // Generate PDF using Puppeteer
    console.log('Generating PDF for invoice:', invoice.invoiceNumber);
    
    let browser;
    try {
      // Launch browser with headless mode
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      
      // Set content and wait for it to load
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Generate PDF with proper settings
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });

      console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes');
      return Buffer.from(pdfBuffer);
      
    } catch (puppeteerError) {
      console.error('Puppeteer PDF generation failed:', puppeteerError);
      // Fallback to HTML content if PDF generation fails
      console.log('Falling back to HTML content');
      return Buffer.from(htmlContent, 'utf-8');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    // Fallback to text content if PDF generation fails
    return Buffer.from('Failed to generate PDF', 'utf-8');
  }
}

// Helper function to send invoice email
async function sendInvoiceEmail(invoice: any, customer: any, pdfContent: Buffer): Promise<boolean> {
  try {
    const subject = `Invoice ${invoice.invoiceNumber} from SyncBridge`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Invoice ${invoice.invoiceNumber}</h2>
        <p>Dear ${customer.name},</p>
        <p>Please find attached your invoice for the amount of $${(invoice.totalAmount / 100).toFixed(2)}.</p>
        <p><strong>Invoice Details:</strong></p>
        <ul>
          <li>Invoice Number: ${invoice.invoiceNumber}</li>
          <li>Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}</li>
          <li>Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</li>
          <li>Total Amount: $${(invoice.totalAmount / 100).toFixed(2)}</li>
        </ul>
        <p>Please review the attached invoice and contact us if you have any questions.</p>
        <p>Thank you for your business!</p>
        <br>
        <p>Best regards,<br>SyncBridge Team</p>
      </div>
    `;

    const textContent = `
Invoice ${invoice.invoiceNumber}

Dear ${customer.name},

Please find attached your invoice for the amount of $${(invoice.totalAmount / 100).toFixed(2)}.

Invoice Details:
- Invoice Number: ${invoice.invoiceNumber}
- Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}
- Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}
- Total Amount: $${(invoice.totalAmount / 100).toFixed(2)}

Please review the attached invoice and contact us if you have any questions.

Thank you for your business!

Best regards,
SyncBridge Team
    `;

    // Send email (without attachment for now - would need proper email library with attachment support)
    const emailSent = await sendEmail({
      to: customer.email,
      subject,
      html: htmlContent,
      text: textContent
    });

    return emailSent;
  } catch (error) {
    console.error('Error in sendInvoiceEmail:', error);
    return false;
  }
}

// Helper function to generate HTML content for invoice
function generateInvoiceHTML(invoice: any, items: any[], customer: any, design?: any): string {
  try {
    // Use design values or defaults
    const primaryColor = design?.primaryColor || '#0891b2';
    const fontFamily = design?.fontFamily || 'Arial, sans-serif';
    const fontSize = design?.fontSize === 'small' ? '14px' : design?.fontSize === 'large' ? '20px' : '16px';
    const logoUrl = design?.logoUrl || '';
    const headerNote = design?.headerNote || '';
    const footerNote = design?.footerNote || '';

    // Create HTML content
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
    .notes-section {
      margin-top: 30px;
      padding: 20px;
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      border-radius: 4px;
    }
    .payment-terms {
      margin-top: 20px;
      padding: 15px;
      background: #d1ecf1;
      border-left: 4px solid #17a2b8;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:48px;margin-bottom:12px;" />` : ''}
    <h1>INVOICE</h1>
    <h2>${invoice.invoiceNumber}</h2>
    ${headerNote ? `<div style="margin-top:12px;color:${primaryColor};font-weight:500;">${headerNote}</div>` : ''}
  </div>
  
  <div class="invoice-info">
    <div>
      <p><strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString()}</p>
      <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
    </div>
    <div>
      <p><strong>Status:</strong> <span style="color: ${invoice.status === 'paid' ? '#28a745' : invoice.status === 'overdue' ? '#dc3545' : '#ffc107'}">${invoice.status.toUpperCase()}</span></p>
      <p><strong>Currency:</strong> ${invoice.currency || 'USD'}</p>
    </div>
  </div>
  
  <div class="customer-info">
    <h3>Bill To:</h3>
    <p><strong>${customer.name}</strong></p>
    ${customer.company ? `<p><strong>Company:</strong> ${customer.company}</p>` : ''}
    ${customer.email ? `<p><strong>Email:</strong> ${customer.email}</p>` : ''}
    ${customer.phone ? `<p><strong>Phone:</strong> ${customer.phone}</p>` : ''}
    ${customer.address ? `<p><strong>Address:</strong> ${customer.address}</p>` : ''}
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
  
  <div class="totals">
    <p><strong>Subtotal:</strong> $${(invoice.subtotal / 100).toFixed(2)}</p>
    ${invoice.discountAmount > 0 ? `<p><strong>Discount:</strong> -$${(invoice.discountAmount / 100).toFixed(2)}</p>` : ''}
    ${invoice.taxAmount > 0 ? `<p><strong>Tax:</strong> $${(invoice.taxAmount / 100).toFixed(2)}</p>` : ''}
    <p class="total-row"><strong>Total:</strong> $${(invoice.totalAmount / 100).toFixed(2)}</p>
    ${invoice.paidAmount > 0 ? `<p><strong>Paid:</strong> $${(invoice.paidAmount / 100).toFixed(2)}</p>` : ''}
    <p class="total-row"><strong>Balance Due:</strong> $${(invoice.balanceAmount / 100).toFixed(2)}</p>
  </div>
  
  ${invoice.notes ? `
  <div class="notes-section">
    <h3>Notes:</h3>
    <p>${invoice.notes}</p>
  </div>
  ` : ''}
  
  ${invoice.paymentTerms ? `
  <div class="payment-terms">
    <h3>Payment Terms:</h3>
    <p>${invoice.paymentTerms}</p>
  </div>
  ` : ''}
  
  ${footerNote ? `<div style="margin-top:24px;color:${primaryColor};font-weight:500;text-align:center;">${footerNote}</div>` : ''}
  <div style="margin-top: 40px; text-align: center; color: #666; font-size: 14px;">
    <p>Thank you for your business!</p>
    <p>Generated by SyncBridge Enterprise Platform</p>
  </div>
</body>
</html>
    `;

    console.log('Generating HTML content for invoice:', invoice.invoiceNumber);
    return htmlContent;
    
  } catch (error) {
    console.error('Error generating HTML:', error);
    return '<html><body><h1>Error generating invoice</h1></body></html>';
  }
}

export default router; 
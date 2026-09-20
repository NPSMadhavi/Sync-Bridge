import { Router } from 'express';
import { storage } from '../storage';
import { sendEmail } from '../email';
import { requireTenant } from '../middleware/tenant';
import { eq } from 'drizzle-orm';
import { invoices, customers, invoiceItems, invoiceDesigns } from '../../shared/schema';
import { db } from '../db';
import pdfmake from 'pdfmake';

pdfmake.fonts = {
  Times: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italics: 'Times-Italic',
    bolditalics: 'Times-BoldItalic',
  },
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => true);

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
// Helper function to generate PDF content using pdfmake
export async function generateInvoicePDF(invoice: any, items: any[], customer: any, design?: any): Promise<Buffer> {
  try {
    const primaryColor = design?.primaryColor || '#0891b2';
    const headerNote = design?.headerNote || '';
    const footerNote = design?.footerNote || '';

    const content: any[] = [];

    // Header: Title and Invoice Number
    content.push({
      text: 'INVOICE',
      fontSize: 26,
      bold: true,
      color: primaryColor,
      alignment: 'center',
      margin: [0, 0, 0, 4]
    });
    content.push({
      text: String(invoice.invoiceNumber || ''),
      fontSize: 14,
      color: '#666666',
      alignment: 'center',
      margin: [0, 0, 0, 8]
    });

    if (headerNote) {
      content.push({
        text: headerNote,
        color: primaryColor,
        alignment: 'center',
        margin: [0, 0, 0, 8]
      });
    }

    // Divider line
    content.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 2, lineColor: primaryColor }],
      margin: [0, 0, 0, 16]
    });

    // Invoice Info & Bill To
    const issueDateStr = invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : '';
    const dueDateStr = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '';
    const statusStr = String(invoice.status || 'draft').toUpperCase();
    const currencyStr = invoice.currency || 'USD';

    content.push({
      columns: [
        {
          width: '50%',
          stack: [
            { text: 'Bill To:', bold: true, color: primaryColor, fontSize: 11, margin: [0, 0, 0, 4] },
            { text: customer.name || '', bold: true, fontSize: 11 },
            ...(customer.company ? [{ text: `Company: ${customer.company}`, margin: [0, 1, 0, 0] }] : []),
            ...(customer.email ? [{ text: `Email: ${customer.email}`, margin: [0, 1, 0, 0] }] : []),
            ...(customer.phone ? [{ text: `Phone: ${customer.phone}`, margin: [0, 1, 0, 0] }] : []),
            ...(customer.address ? [{ text: `Address: ${customer.address}`, margin: [0, 1, 0, 0] }] : [])
          ]
        },
        {
          width: '50%',
          stack: [
            { text: `Issue Date: ${issueDateStr}`, alignment: 'right', margin: [0, 0, 0, 2] },
            { text: `Due Date: ${dueDateStr}`, alignment: 'right', margin: [0, 0, 0, 2] },
            { text: `Status: ${statusStr}`, bold: true, alignment: 'right', margin: [0, 0, 0, 2] },
            { text: `Currency: ${currencyStr}`, alignment: 'right', margin: [0, 0, 0, 2] }
          ]
        }
      ],
      margin: [0, 0, 0, 18]
    });

    // Items Table
    const tableBody: any[][] = [
      [
        { text: 'Description', bold: true, fillColor: primaryColor, color: '#ffffff', margin: [4, 6, 4, 6] },
        { text: 'Quantity', bold: true, alignment: 'center', fillColor: primaryColor, color: '#ffffff', margin: [4, 6, 4, 6] },
        { text: 'Unit Price', bold: true, alignment: 'right', fillColor: primaryColor, color: '#ffffff', margin: [4, 6, 4, 6] },
        { text: 'Total', bold: true, alignment: 'right', fillColor: primaryColor, color: '#ffffff', margin: [4, 6, 4, 6] }
      ]
    ];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowBg = i % 2 === 1 ? '#f8f9fa' : '#ffffff';
      tableBody.push([
        { text: item.description || '', fillColor: rowBg, margin: [4, 5, 4, 5] },
        { text: String(item.quantity ?? 1), alignment: 'center', fillColor: rowBg, margin: [4, 5, 4, 5] },
        { text: `$${((item.unitPrice || 0) / 100).toFixed(2)}`, alignment: 'right', fillColor: rowBg, margin: [4, 5, 4, 5] },
        { text: `$${((item.totalPrice || 0) / 100).toFixed(2)}`, alignment: 'right', fillColor: rowBg, margin: [4, 5, 4, 5] }
      ]);
    }

    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 60, 80, 80],
        body: tableBody
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#dddddd',
        vLineColor: () => '#dddddd'
      },
      margin: [0, 0, 0, 16]
    });

    // Totals Block
    const subtotal = ((invoice.subtotal || 0) / 100).toFixed(2);
    const discount = invoice.discountAmount > 0 ? `-$${((invoice.discountAmount || 0) / 100).toFixed(2)}` : null;
    const tax = invoice.taxAmount > 0 ? `$${((invoice.taxAmount || 0) / 100).toFixed(2)}` : null;
    const total = ((invoice.totalAmount || 0) / 100).toFixed(2);
    const paid = invoice.paidAmount > 0 ? `$${((invoice.paidAmount || 0) / 100).toFixed(2)}` : null;
    const balance = ((invoice.balanceAmount || 0) / 100).toFixed(2);

    content.push({
      columns: [
        { width: '*', text: '' },
        {
          width: 220,
          table: {
            widths: ['*', 80],
            body: [
              ['Subtotal:', { text: `$${subtotal}`, alignment: 'right' }],
              ...(discount ? [['Discount:', { text: discount, alignment: 'right' }]] : []),
              ...(tax ? [['Tax:', { text: tax, alignment: 'right' }]] : []),
              [{ text: 'Total:', bold: true, color: primaryColor, fontSize: 11 }, { text: `$${total}`, bold: true, color: primaryColor, fontSize: 11, alignment: 'right' }],
              ...(paid ? [['Paid:', { text: paid, alignment: 'right' }]] : []),
              [{ text: 'Balance Due:', bold: true, color: primaryColor, fontSize: 11 }, { text: `$${balance}`, bold: true, color: primaryColor, fontSize: 11, alignment: 'right' }]
            ]
          },
          layout: 'noBorders'
        }
      ],
      margin: [0, 0, 0, 20]
    });

    if (invoice.notes) {
      content.push({
        stack: [
          { text: 'Notes:', bold: true, margin: [0, 0, 0, 2] },
          { text: invoice.notes }
        ],
        margin: [0, 0, 0, 12]
      });
    }

    if (invoice.paymentTerms) {
      content.push({
        stack: [
          { text: 'Payment Terms:', bold: true, margin: [0, 0, 0, 2] },
          { text: invoice.paymentTerms }
        ],
        margin: [0, 0, 0, 12]
      });
    }

    if (footerNote) {
      content.push({
        text: footerNote,
        color: primaryColor,
        alignment: 'center',
        margin: [0, 16, 0, 4]
      });
    }

    content.push({
      stack: [
        { text: 'Thank you for your business!', color: '#666666', alignment: 'center' },
        { text: 'Generated by SyncBridge Enterprise Platform', color: '#999999', fontSize: 8.5, alignment: 'center', margin: [0, 2, 0, 0] }
      ],
      margin: [0, 24, 0, 0]
    });

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [36, 36, 36, 36],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 10,
        color: '#333333'
      },
      content
    };

    const doc = pdfmake.createPdf(docDefinition);
    const pdfBuffer = await doc.getBuffer();
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    throw new Error('Failed to generate invoice PDF');
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
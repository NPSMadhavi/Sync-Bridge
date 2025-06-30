import nodemailer from 'nodemailer';

// Email configuration - you can customize these according to your email server
const emailConfig = {
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  from: process.env.EMAIL_FROM || 'noreply@syncbridge.com',
};

// Create transporter
let transporter: nodemailer.Transporter | null = null;

if (emailConfig.auth.user && emailConfig.auth.pass) {
  transporter = nodemailer.createTransport(emailConfig);
} else {
  console.warn("SMTP credentials not configured. Email functionality will be disabled.");
}

interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!transporter) {
    console.log("SMTP not configured. Email would have been sent to:", params.to);
    console.log("Subject:", params.subject);
    console.log("To enable email, set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables");
    return false;
  }

  try {
    const mailOptions = {
      from: params.from || emailConfig.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to:", params.to);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

export function generateVerificationEmailHTML(verificationUrl: string, userName: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - SyncBridge</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .logo {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .logo-text {
          color: white;
          font-size: 24px;
          font-weight: bold;
        }
        h1 {
          color: #0891b2;
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          margin-bottom: 30px;
        }
        .verify-button {
          display: inline-block;
          background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 16px;
          text-align: center;
          margin: 20px 0;
        }
        .verify-button:hover {
          background: linear-gradient(135deg, #0e7490 0%, #0891b2 100%);
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        .security-note {
          background-color: #f8f9fa;
          border-left: 4px solid #0891b2;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <div class="logo-text">S</div>
          </div>
          <h1>Welcome to SyncBridge</h1>
        </div>
        
        <div class="content">
          <p>Hello ${userName},</p>
          
          <p>Thank you for registering with SyncBridge! To complete your account setup and start managing your enterprise assets, please verify your email address.</p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="verify-button">Verify Email Address</a>
          </div>
          
          <div class="security-note">
            <strong>Security Note:</strong> This verification link will expire in 24 hours for your security. If you didn't create this account, please ignore this email.
          </div>
          
          <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #0891b2;">${verificationUrl}</p>
          
          <p>Once verified, you'll have access to:</p>
          <ul>
            <li>Asset management and tracking</li>
            <li>Employee document lifecycle management</li>
            <li>Invoice creation and customer management</li>
            <li>Comprehensive reporting and analytics</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>This email was sent from SyncBridge Enterprise Management Platform.</p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateVerificationEmailText(verificationUrl: string, userName: string): string {
  return `
Welcome to SyncBridge, ${userName}!

Thank you for registering with SyncBridge. To complete your account setup, please verify your email address by clicking the link below:

${verificationUrl}

This verification link will expire in 24 hours for your security.

If you didn't create this account, please ignore this email.

Once verified, you'll have access to our complete enterprise management platform including asset tracking, employee document management, invoicing, and comprehensive reporting.

Best regards,
The SyncBridge Team
  `.trim();
}

export function generateDocumentExpiryEmailHTML(documentTitle: string, expiryDate: string, daysUntilExpiry: number, employeeName?: string): string {
  const isExpired = daysUntilExpiry <= 0;
  const urgencyColor = isExpired ? '#dc2626' : daysUntilExpiry <= 7 ? '#ea580c' : '#d97706';
  const statusText = isExpired ? 'EXPIRED' : `${daysUntilExpiry} days until expiry`;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Expiry Alert</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">📋 Document Expiry Alert</h1>
        <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">SyncBridge Enterprise Platform</p>
    </div>
    
    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <div style="background: ${urgencyColor}; color: white; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
            <h2 style="margin: 0; font-size: 20px;">${isExpired ? '⚠️ DOCUMENT EXPIRED' : '⏰ DOCUMENT EXPIRING SOON'}</h2>
            <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: bold;">${statusText}</p>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="margin: 0 0 15px 0; color: #374151;">Document Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Document:</td>
                    <td style="padding: 8px 0; color: #111827;">${documentTitle}</td>
                </tr>
                ${employeeName ? `
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Employee:</td>
                    <td style="padding: 8px 0; color: #111827;">${employeeName}</td>
                </tr>
                ` : ''}
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Expiry Date:</td>
                    <td style="padding: 8px 0; color: #111827;">${new Date(expiryDate).toLocaleDateString('en-SG', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</td>
                </tr>
            </table>
        </div>
        
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 25px;">
            <h4 style="margin: 0 0 10px 0; color: #1e40af;">📢 Required Action</h4>
            <p style="margin: 0; color: #1e3a8a;">
                ${isExpired 
                  ? 'This document has expired and requires immediate attention. Please renew or update the document as soon as possible to maintain compliance.'
                  : 'Please take action to renew or update this document before it expires to avoid any compliance issues.'
                }
            </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Access SyncBridge Dashboard
            </a>
        </div>
        
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">This is an automated notification from SyncBridge Enterprise Platform</p>
            <p style="margin: 5px 0 0 0;">Please do not reply to this email</p>
        </div>
    </div>
</body>
</html>`;
}

export function generateDocumentExpiryEmailText(documentTitle: string, expiryDate: string, daysUntilExpiry: number, employeeName?: string): string {
  const isExpired = daysUntilExpiry <= 0;
  const statusText = isExpired ? 'EXPIRED' : `${daysUntilExpiry} days until expiry`;
  
  return `
DOCUMENT EXPIRY ALERT - SyncBridge Enterprise Platform

${isExpired ? 'DOCUMENT EXPIRED' : 'DOCUMENT EXPIRING SOON'}
Status: ${statusText}

Document Details:
- Document: ${documentTitle}
${employeeName ? `- Employee: ${employeeName}` : ''}
- Expiry Date: ${new Date(expiryDate).toLocaleDateString('en-SG', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}

Required Action:
${isExpired 
  ? 'This document has expired and requires immediate attention. Please renew or update the document as soon as possible to maintain compliance.'
  : 'Please take action to renew or update this document before it expires to avoid any compliance issues.'
}

Please log in to your SyncBridge dashboard to manage this document.

---
This is an automated notification from SyncBridge Enterprise Platform
Please do not reply to this email
`;
}
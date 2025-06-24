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
  transporter = nodemailer.createTransporter(emailConfig);
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
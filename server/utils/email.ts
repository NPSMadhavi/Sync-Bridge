import nodemailer from 'nodemailer';

// Email configuration with validation
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // Use secure connection if specified
  requireTLS: true, // Force using STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Validate required email environment variables
const requiredEmailVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'];
const missingVars = requiredEmailVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required email environment variables:', missingVars);
  console.error('Please add these to your production environment:');
  missingVars.forEach(varName => {
    console.error(`  - ${varName}`);
  });
}

// Create transporter only if all required variables are present
const transporter = missingVars.length === 0 ? nodemailer.createTransport({
  ...smtpConfig,
  tls: {
    // More flexible TLS configuration for SSL certificate issues
    rejectUnauthorized: false, // Allow certificate hostname mismatches
    minVersion: 'TLSv1.2',
    // Ignore hostname verification since mail.myrsv.com is not in cert altnames
    checkServerIdentity: () => undefined
  },
  // Connection timeout settings
  connectionTimeout: 60000, // 60 seconds
  greetingTimeout: 30000,   // 30 seconds
  socketTimeout: 60000,     // 60 seconds
}) : null;

// Verify the connection only if transporter exists
if (transporter) {
  transporter.verify((error: any) => {
    if (error) {
      console.error('SMTP connection error:', error);
    } else {
      console.log('SMTP server is ready to send emails');
    }
  });
} else {
  console.warn('⚠️  Email transporter not initialized due to missing environment variables');
}

// Interface for notification settings
export interface NotificationSettings {
  documentExpiry: boolean;
  assetAssignment: boolean;
  maintenanceAlerts: boolean;
  expiryDays: number;
  reminderFrequency: number;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

// Interface for email data
export interface EmailData {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

/**
 * Send email using the configured SMTP transporter
 */
export async function sendEmail(data: EmailData): Promise<boolean> {
  try {
    console.log('Attempting to send email with transporter...', {
      transporterExists: !!transporter,
      emailFrom: !!process.env.EMAIL_FROM
    });

    // Check if transporter is available
    if (!transporter) {
      console.error('❌ Email transporter not available - missing environment variables');
      return false;
    }

    // Check required environment variables
    if (!process.env.EMAIL_FROM) {
      console.error('Missing required email environment variables:', {
        EMAIL_FROM: !!process.env.EMAIL_FROM
      });
      return false;
    }

    // Escape HTML to prevent injection attacks
    const escapeHtml = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    };

    // Sanitize input data
    const sanitizedData = {
      to: escapeHtml(data.to),
      subject: escapeHtml(data.subject),
      text: escapeHtml(data.text),
      html: data.html ? escapeHtml(data.html) : undefined,
      replyTo: data.replyTo ? escapeHtml(data.replyTo) : undefined
    };

    // Email content with sanitized data
    const mailOptions = {
      from: `"SyncBridge" <${process.env.EMAIL_FROM}>`,
      to: sanitizedData.to,
      replyTo: sanitizedData.replyTo || process.env.EMAIL_FROM,
      subject: sanitizedData.subject,
      text: sanitizedData.text,
      html: sanitizedData.html || sanitizedData.text,
    };

    // Send email
    console.log('Attempting to send email with transporter...');
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error: any) {
    console.error('Error sending email - Full error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      errno: error.errno,
      syscall: error.syscall,
      hostname: error.hostname,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    return false;
  }
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(to: string, subject: string, message: string): Promise<boolean> {
  const emailData: EmailData = {
    to,
    subject: `SyncBridge Notification: ${subject}`,
    text: message,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #00bcd4 0%, #8e44ad 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔔 SyncBridge Notification</h1>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #2d3748; margin: 0 0 15px 0;">${subject}</h2>
          <div style="color: #4a5568; line-height: 1.6;">
            ${message.replace(/\n/g, '<br>')}
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f7fafc; border-radius: 5px; border-left: 4px solid #00bcd4;">
            <p style="margin: 0; color: #718096; font-size: 14px;">
              This is an automated notification from SyncBridge. Please do not reply to this email.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #718096; font-size: 12px;">
          <p>SyncBridge - Enterprise Management System</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      </div>
    `
  };

  return await sendEmail(emailData);
}

/**
 * Send document expiry notification
 */
export async function sendDocumentExpiryNotification(userEmail: string, documentName: string, expiryDate: Date, daysUntilExpiry: number): Promise<boolean> {
  const subject = `Document Expiry Alert: ${documentName}`;
  const message = `
Dear User,

This is an important notification regarding document expiry.

Document: ${documentName}
Expiry Date: ${expiryDate.toLocaleDateString()}
Days Until Expiry: ${daysUntilExpiry}

Please take immediate action to renew or update this document to avoid any compliance issues.

Best regards,
SyncBridge Team
  `;

  return await sendNotificationEmail(userEmail, subject, message);
}

/**
 * Send asset assignment notification
 */
export async function sendAssetAssignmentNotification(userEmail: string, assetName: string, assignedBy: string): Promise<boolean> {
  const subject = `Asset Assignment: ${assetName}`;
  const message = `
Dear User,

An asset has been assigned to you.

Asset: ${assetName}
Assigned By: ${assignedBy}
Assignment Date: ${new Date().toLocaleDateString()}

Please review the asset details and confirm receipt.

Best regards,
SyncBridge Team
  `;

  return await sendNotificationEmail(userEmail, subject, message);
}

/**
 * Send maintenance alert notification
 */
export async function sendMaintenanceAlertNotification(userEmail: string, assetName: string, maintenanceType: string, scheduledDate: Date): Promise<boolean> {
  const subject = `Maintenance Alert: ${assetName}`;
  const message = `
Dear User,

A maintenance alert has been scheduled for one of your assets.

Asset: ${assetName}
Maintenance Type: ${maintenanceType}
Scheduled Date: ${scheduledDate.toLocaleDateString()}

Please ensure the asset is available for maintenance on the scheduled date.

Best regards,
SyncBridge Team
  `;

  return await sendNotificationEmail(userEmail, subject, message);
}

export { transporter }; 
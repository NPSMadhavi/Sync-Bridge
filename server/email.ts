import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { storage } from "./storage";
import type { EmailSettings } from "@shared/schema";

export interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  tenantId?: number;
}

interface ResolvedEmailConfig {
  host: string;
  port: number;
  smtpSecure: string;
  user: string;
  pass: string;
  from: string;
  source: "database" | "environment";
}

let cachedConfigKey: string | null = null;
let cachedTransporter: nodemailer.Transporter | null = null;
let verifiedConfigKey: string | null = null;

type NodemailerSmtpError = {
  code?: string;
  command?: string;
  message?: string;
  response?: string;
  responseCode?: number;
};

function maskSecret(value: string | undefined): string {
  if (!value) return "(empty)";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}***${value.slice(-2)} (len=${value.length})`;
}

function describeResolvedConfig(config: ResolvedEmailConfig) {
  return {
    source: config.source,
    host: config.host,
    port: config.port,
    encryption: config.smtpSecure,
    user: config.user,
    from: config.from,
    password: maskSecret(config.pass),
  };
}

function formatSmtpError(error: unknown): NodemailerSmtpError {
  const emailError = error as NodemailerSmtpError;
  return {
    code: emailError.code,
    command: emailError.command,
    message: emailError.message,
    response: emailError.response,
    responseCode: emailError.responseCode,
  };
}

function isGmailHost(host: string): boolean {
  return host.toLowerCase().includes("gmail");
}

function formatUserFriendlySmtpError(config: ResolvedEmailConfig, error: unknown): string {
  const details = formatSmtpError(error);
  const isAuthError =
    details.code === "EAUTH" || details.responseCode === 535 || details.response?.includes("535");

  if (!isAuthError) {
    return details.message || "SMTP connection failed.";
  }

  if (isGmailHost(config.host)) {
    if (config.user.trim().toLowerCase() !== config.from.trim().toLowerCase()) {
      return (
        "Gmail rejected the login: SMTP Username and From Email Address must be the same Gmail account."
      );
    }

    return (
      "Gmail rejected the username or password. Use a Google App Password (not your normal Gmail password). " +
      "Enable 2-Step Verification on the account, then create an App Password at " +
      "https://myaccount.google.com/apppasswords and paste it into SMTP Password."
    );
  }

  return "SMTP username or password was rejected. Check your credentials and try again.";
}

function logSmtpError(context: string, config: ResolvedEmailConfig, error: unknown): void {
  const details = formatSmtpError(error);
  console.error(`[SMTP] ${context}`, {
    config: describeResolvedConfig(config),
    error: details,
  });
}

function buildTransportOptions(config: ResolvedEmailConfig): SMTPTransport.Options {
  const port = Number(config.port) || 587;
  const encryption = config.smtpSecure || "STARTTLS";

  let secure = false;
  let requireTLS = false;

  if (encryption === "SSL/TLS") {
    secure = true;
  } else if (encryption === "STARTTLS") {
    secure = false;
    requireTLS = true;
  }

  return {
    host: config.host.trim(),
    port,
    secure,
    requireTLS,
    auth: {
      user: config.user.trim(),
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: "TLSv1.2",
    },
    connectionTimeout: 30000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  };
}

function fromDbSettings(settings: EmailSettings): ResolvedEmailConfig {
  return {
    host: settings.smtpHost,
    port: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    user: settings.smtpUser,
    pass: settings.smtpPass,
    from: settings.emailFrom,
    source: "database",
  };
}

function fromEnvironment(): ResolvedEmailConfig | null {
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER)?.trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS)?.trim();
  const host = (process.env.SMTP_HOST || process.env.EMAIL_HOST)?.trim();

  if (!user || !pass || !host) {
    return null;
  }

  const secureRaw = process.env.SMTP_SECURE ?? process.env.EMAIL_SECURE;
  const secureEnv = secureRaw === "true";
  const portRaw = process.env.SMTP_PORT || process.env.EMAIL_PORT || "587";

  return {
    host,
    port: parseInt(portRaw, 10),
    smtpSecure: secureEnv ? "SSL/TLS" : "STARTTLS",
    user,
    pass,
    from: process.env.EMAIL_FROM?.trim() || user,
    source: "environment",
  };
}

async function resolveEmailConfig(tenantId?: number): Promise<ResolvedEmailConfig | null> {
  if (tenantId) {
    const tenantSettings = await storage.getEmailSettings(tenantId);
    if (
      tenantSettings &&
      tenantSettings.isActive !== false &&
      tenantSettings.smtpHost &&
      tenantSettings.smtpUser &&
      tenantSettings.smtpPass
    ) {
      return fromDbSettings(tenantSettings);
    }
  }

  const activeSettings = await storage.getAnyActiveEmailSettings();
  if (
    activeSettings &&
    activeSettings.smtpHost &&
    activeSettings.smtpUser &&
    activeSettings.smtpPass
  ) {
    return fromDbSettings(activeSettings);
  }

  return fromEnvironment();
}

async function getTransporter(tenantId?: number): Promise<{
  transporter: nodemailer.Transporter;
  config: ResolvedEmailConfig;
} | null> {
  const config = await resolveEmailConfig(tenantId);
  if (!config) {
    return null;
  }

  const configKey = JSON.stringify({
    host: config.host,
    port: config.port,
    smtpSecure: config.smtpSecure,
    user: config.user,
    from: config.from,
    source: config.source,
  });

  if (!cachedTransporter || cachedConfigKey !== configKey) {
    cachedTransporter = nodemailer.createTransport(buildTransportOptions(config));
    cachedConfigKey = configKey;
    verifiedConfigKey = null;
    console.info("[SMTP] Transporter created from", describeResolvedConfig(config));
  }

  return { transporter: cachedTransporter, config };
}

async function ensureSmtpConnectionVerified(
  transporter: nodemailer.Transporter,
  config: ResolvedEmailConfig,
  configKey: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (verifiedConfigKey === configKey) {
    return { ok: true };
  }

  try {
    await transporter.verify();
    verifiedConfigKey = configKey;
    console.info("[SMTP] Connection verified", describeResolvedConfig(config));
    return { ok: true };
  } catch (error) {
    logSmtpError("Connection verification failed", config, error);
    const details = formatSmtpError(error);
    const message =
      details.code === "EAUTH" || details.responseCode === 535
        ? formatUserFriendlySmtpError(config, error)
        : details.message || "SMTP connection verification failed.";
    return { ok: false, error: message.trim() };
  }
}

export type SmtpVerifyResult = {
  configured: boolean;
  verified: boolean;
  config?: ReturnType<typeof describeResolvedConfig>;
  error?: string;
  details?: NodemailerSmtpError;
};

export async function verifySmtpConnection(tenantId?: number): Promise<SmtpVerifyResult> {
  const config = await resolveEmailConfig(tenantId);
  if (!config) {
    return {
      configured: false,
      verified: false,
      error:
        "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in server/.env " +
        "or save settings under Settings → Email Configuration.",
    };
  }

  const resolved = await getTransporter(tenantId);
  if (!resolved) {
    return { configured: false, verified: false, error: "Failed to create SMTP transporter." };
  }

  const configKey = cachedConfigKey!;
  const verification = await ensureSmtpConnectionVerified(resolved.transporter, config, configKey);
  if (!verification.ok) {
    return {
      configured: true,
      verified: false,
      config: describeResolvedConfig(config),
      error: verification.error,
    };
  }

  return {
    configured: true,
    verified: true,
    config: describeResolvedConfig(config),
  };
}

export function invalidateEmailTransporterCache(): void {
  cachedConfigKey = null;
  cachedTransporter = null;
  verifiedConfigKey = null;
}

export async function isEmailConfigured(tenantId?: number): Promise<boolean> {
  const config = await resolveEmailConfig(tenantId);
  return config != null;
}

export type SendEmailResult = {
  success: boolean;
  error?: string;
};

export async function sendEmailDetailed(params: EmailParams): Promise<SendEmailResult> {
  const recipient = params.to?.trim();
  if (!recipient || !recipient.includes("@")) {
    return { success: false, error: "Recipient email address is required." };
  }

  const resolved = await getTransporter(params.tenantId);

  if (!resolved) {
    const message =
      "SMTP is not configured. Save email settings under Settings → Email Configuration, " +
      "or set SMTP_HOST, SMTP_USER, and SMTP_PASS in server/.env.";
    console.warn(message);
    return { success: false, error: message };
  }

  const { transporter, config } = resolved;
  const configKey = cachedConfigKey!;

  const verification = await ensureSmtpConnectionVerified(transporter, config, configKey);
  if (!verification.ok) {
    return { success: false, error: verification.error };
  }

  try {
    await transporter.sendMail({
      from: params.from || config.from,
      to: recipient,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return { success: true };
  } catch (error) {
    logSmtpError(`Failed to send email to ${recipient}`, config, error);
    const details = formatSmtpError(error);

    const message =
      details.code === "EAUTH" || details.responseCode === 535
        ? formatUserFriendlySmtpError(config, error)
        : details.message || "Failed to deliver email.";

    if (details.code === "EAUTH" || details.responseCode === 535) {
      verifiedConfigKey = null;
    }

    return { success: false, error: message.trim() };
  }
}

export async function sendEmailWithConfig(
  config: ResolvedEmailConfig,
  params: Omit<EmailParams, "tenantId">
): Promise<SendEmailResult> {
  const recipient = params.to?.trim();
  if (!recipient || !recipient.includes("@")) {
    return { success: false, error: "Recipient email address is required." };
  }

  const transporter = nodemailer.createTransport(buildTransportOptions(config));
  const configKey = `inline-${JSON.stringify({
    host: config.host,
    port: config.port,
    smtpSecure: config.smtpSecure,
    user: config.user,
    from: config.from,
  })}`;

  const verification = await ensureSmtpConnectionVerified(transporter, config, configKey);
  if (!verification.ok) {
    return { success: false, error: verification.error };
  }

  try {
    await transporter.sendMail({
      from: params.from || config.from,
      to: recipient,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return { success: true };
  } catch (error) {
    logSmtpError(`Failed to send email to ${recipient}`, config, error);
    const details = formatSmtpError(error);
    const message =
      details.code === "EAUTH" || details.responseCode === 535
        ? formatUserFriendlySmtpError(config, error)
        : details.message || "Failed to deliver email.";
    return { success: false, error: message.trim() };
  } finally {
    transporter.close();
  }
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  const result = await sendEmailDetailed(params);
  return result.success;
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

export function generateDocumentExpiryEmailHTML(
  documentTitle: string,
  expiryDate: string,
  daysUntilExpiry: number,
  employeeName?: string
): string {
  const isExpired = daysUntilExpiry <= 0;
  const urgencyColor = isExpired ? "#dc2626" : daysUntilExpiry <= 7 ? "#ea580c" : "#d97706";
  const statusText = isExpired ? "EXPIRED" : `${daysUntilExpiry} days until expiry`;

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
            <h2 style="margin: 0; font-size: 20px;">${isExpired ? "⚠️ DOCUMENT EXPIRED" : "⏰ DOCUMENT EXPIRING SOON"}</h2>
            <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: bold;">${statusText}</p>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="margin: 0 0 15px 0; color: #374151;">Document Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Document:</td>
                    <td style="padding: 8px 0; color: #111827;">${documentTitle}</td>
                </tr>
                ${
                  employeeName
                    ? `
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Employee:</td>
                    <td style="padding: 8px 0; color: #111827;">${employeeName}</td>
                </tr>
                `
                    : ""
                }
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Expiry Date:</td>
                    <td style="padding: 8px 0; color: #111827;">${new Date(expiryDate).toLocaleDateString("en-SG", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}</td>
                </tr>
            </table>
        </div>
        
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 25px;">
            <h4 style="margin: 0 0 10px 0; color: #1e40af;">📢 Required Action</h4>
            <p style="margin: 0; color: #1e3a8a;">
                ${
                  isExpired
                    ? "This document has expired and requires immediate attention. Please renew or update the document as soon as possible to maintain compliance."
                    : "Please take action to renew or update this document before it expires to avoid any compliance issues."
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

export function generateDocumentExpiryEmailText(
  documentTitle: string,
  expiryDate: string,
  daysUntilExpiry: number,
  employeeName?: string
): string {
  const isExpired = daysUntilExpiry <= 0;
  const statusText = isExpired ? "EXPIRED" : `${daysUntilExpiry} days until expiry`;

  return `
DOCUMENT EXPIRY ALERT - SyncBridge Enterprise Platform

${isExpired ? "DOCUMENT EXPIRED" : "DOCUMENT EXPIRING SOON"}
Status: ${statusText}

Document Details:
- Document: ${documentTitle}
${employeeName ? `- Employee: ${employeeName}` : ""}
- Expiry Date: ${new Date(expiryDate).toLocaleDateString("en-SG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}

Required Action:
${
  isExpired
    ? "This document has expired and requires immediate attention. Please renew or update the document as soon as possible to maintain compliance."
    : "Please take action to renew or update this document before it expires to avoid any compliance issues."
}

Please log in to your SyncBridge dashboard to manage this document.

---
This is an automated notification from SyncBridge Enterprise Platform
Please do not reply to this email
`;
}

export function generatePassportVisaReminderEmailHTML(params: {
  employeeName: string;
  dependentName?: string;
  documentType: string;
  expiryDate: Date;
  daysRemaining: number;
}): string {
  const expiryFormatted = params.expiryDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const dependentLine = params.dependentName
    ? `<tr><td style="padding:8px 0;font-weight:bold;color:#6b7280;">Dependent:</td><td style="padding:8px 0;">${params.dependentName}</td></tr>`
    : "";

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
<p>Hello ${params.employeeName},</p>
<p>This is a reminder that the following document is approaching its expiry date.</p>
<table style="width:100%;margin:16px 0;">
<tr><td style="padding:8px 0;font-weight:bold;color:#6b7280;">Document Type:</td><td style="padding:8px 0;">${params.documentType}</td></tr>
${dependentLine}
<tr><td style="padding:8px 0;font-weight:bold;color:#6b7280;">Expiry Date:</td><td style="padding:8px 0;">${expiryFormatted}</td></tr>
<tr><td style="padding:8px 0;font-weight:bold;color:#6b7280;">Days Remaining:</td><td style="padding:8px 0;">${params.daysRemaining}</td></tr>
</table>
<p>Please renew the document before it expires.</p>
<p>Thank you.</p>
</body></html>`;
}

export function generatePassportVisaReminderEmailText(params: {
  employeeName: string;
  dependentName?: string;
  documentType: string;
  expiryDate: Date;
  daysRemaining: number;
}): string {
  const expiryFormatted = params.expiryDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `Hello ${params.employeeName},

This is a reminder that the following document is approaching its expiry date.

Document Type: ${params.documentType}
${params.dependentName ? `Dependent: ${params.dependentName}\n` : ""}Expiry Date: ${expiryFormatted}
Days Remaining: ${params.daysRemaining}

Please renew the document before it expires.

Thank you.`;
}

export function generateLicenseExpiryEmailHTML(
  licenseName: string,
  expiryDate: string,
  daysUntilExpiry: number
): string {
  return generateDocumentExpiryEmailHTML(licenseName, expiryDate, daysUntilExpiry).replace(
    "Document Expiry Alert",
    "License Expiry Alert"
  ).replace(
    "DOCUMENT EXPIRED",
    "LICENSE EXPIRED"
  ).replace(
    "DOCUMENT EXPIRING SOON",
    "LICENSE EXPIRING SOON"
  ).replace(
    ">Document:</td>",
    ">License:</td>"
  );
}

export function generateLicenseExpiryEmailText(
  licenseName: string,
  expiryDate: string,
  daysUntilExpiry: number
): string {
  return generateDocumentExpiryEmailText(licenseName, expiryDate, daysUntilExpiry)
    .replace(/DOCUMENT/g, "LICENSE")
    .replace("- Document:", "- License:");
}

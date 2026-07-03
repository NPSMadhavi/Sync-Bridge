import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { resolveRequestTenantId } from "./middleware/tenant";
import { invalidateEmailTransporterCache, sendEmailWithConfig } from "./email";

const emailSettingsBodySchema = z.object({
  smtpHost: z.string().trim().min(1),
  smtpPort: z.union([z.string(), z.number()]).transform((val) => Number(val)),
  smtpSecure: z.enum(["None", "SSL/TLS", "STARTTLS"]),
  smtpUser: z.string().trim().min(1),
  smtpPass: z.string().optional(),
  emailFrom: z.string().trim().email(),
});

const emailTestBodySchema = z.object({
  testEmail: z.string().trim().email(),
  smtpHost: z.string().trim().min(1).optional(),
  smtpPort: z.union([z.string(), z.number()]).optional(),
  smtpSecure: z.enum(["None", "SSL/TLS", "STARTTLS"]).optional(),
  smtpUser: z.string().trim().min(1).optional(),
  smtpPass: z.string().optional(),
  emailFrom: z.string().trim().email().optional(),
});

function isGmailHost(host: string): boolean {
  return host.toLowerCase().includes("gmail");
}

function validateGmailAccountMatch(smtpHost: string, smtpUser: string, emailFrom: string): string | null {
  if (!isGmailHost(smtpHost)) {
    return null;
  }

  if (smtpUser.trim().toLowerCase() !== emailFrom.trim().toLowerCase()) {
    return "For Gmail, SMTP Username and From Email Address must be the same Gmail account.";
  }

  return null;
}

function sanitizeEmailSettingsResponse(settings: {
  id: number;
  tenantId: number | null;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: string;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  isActive: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}) {
  const { smtpPass: _smtpPass, ...rest } = settings;
  return {
    ...rest,
    hasPassword: Boolean(settings.smtpPass),
  };
}

export function registerEmailSettingsRoutes(
  app: Express,
  requireRole: (roles: string[]) => ReturnType<Express["use"]>
): void {
  app.get(
    "/api/email-settings",
    requireRole(["admin", "hr_manager", "super_admin"]),
    async (req, res) => {
      try {
        const user = req.user as { role?: string };
        const tenantId = await resolveRequestTenantId(req, user);
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant context is required" });
        }

        const settings = await storage.getEmailSettings(tenantId);
        if (!settings) {
          return res.json(null);
        }

        res.json(sanitizeEmailSettingsResponse(settings));
      } catch (error) {
        console.error("GET /api/email-settings error:", error);
        res.status(500).json({ message: "Failed to fetch email settings" });
      }
    }
  );

  app.post(
    "/api/email-settings",
    requireRole(["admin", "hr_manager", "super_admin"]),
    async (req, res) => {
      try {
        const user = req.user as { role?: string };
        const tenantId = await resolveRequestTenantId(req, user);
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant context is required" });
        }

        const parsed = emailSettingsBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Validation error",
            errors: parsed.error.errors,
          });
        }

        const existing = await storage.getEmailSettings(tenantId);
        const smtpPass = parsed.data.smtpPass?.trim() || existing?.smtpPass;

        if (!smtpPass) {
          return res.status(400).json({ message: "SMTP password is required" });
        }

        const gmailMismatch = validateGmailAccountMatch(
          parsed.data.smtpHost,
          parsed.data.smtpUser,
          parsed.data.emailFrom
        );
        if (gmailMismatch) {
          return res.status(400).json({ message: gmailMismatch });
        }

        const payload = {
          tenantId,
          smtpHost: parsed.data.smtpHost,
          smtpPort: parsed.data.smtpPort,
          smtpSecure: parsed.data.smtpSecure,
          smtpUser: parsed.data.smtpUser,
          smtpPass,
          emailFrom: parsed.data.emailFrom,
          isActive: true,
        };

        const saved = existing
          ? await storage.updateEmailSettings(tenantId, payload)
          : await storage.createEmailSettings(payload);

        invalidateEmailTransporterCache();

        if (!saved) {
          return res.status(500).json({ message: "Failed to save email settings" });
        }

        res.json(sanitizeEmailSettingsResponse(saved));
      } catch (error) {
        console.error("POST /api/email-settings error:", error);
        res.status(500).json({ message: "Failed to save email settings" });
      }
    }
  );

  app.post(
    "/api/email-settings/test",
    requireRole(["admin", "hr_manager", "super_admin"]),
    async (req, res) => {
      try {
        const user = req.user as { role?: string };
        const tenantId = await resolveRequestTenantId(req, user);
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant context is required" });
        }

        const parsed = emailTestBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "A valid test email address is required" });
        }

        const existing = await storage.getEmailSettings(tenantId);
        const smtpHost = parsed.data.smtpHost || existing?.smtpHost;
        const smtpPort = parsed.data.smtpPort != null
          ? Number(parsed.data.smtpPort)
          : existing?.smtpPort;
        const smtpSecure = parsed.data.smtpSecure || existing?.smtpSecure;
        const smtpUser = parsed.data.smtpUser || existing?.smtpUser;
        const emailFrom = parsed.data.emailFrom || existing?.emailFrom;
        const smtpPass = parsed.data.smtpPass?.trim() || existing?.smtpPass;

        if (!smtpHost || !smtpPort || !smtpSecure || !smtpUser || !emailFrom) {
          return res.status(400).json({
            message: "Complete the SMTP settings above before sending a test email.",
          });
        }

        if (!smtpPass) {
          return res.status(400).json({
            message: "SMTP password is required. Enter your password (or App Password for Gmail) and try again.",
          });
        }

        const gmailMismatch = validateGmailAccountMatch(smtpHost, smtpUser, emailFrom);
        if (gmailMismatch) {
          return res.status(400).json({ message: gmailMismatch });
        }

        const sent = await sendEmailWithConfig(
          {
            host: smtpHost,
            port: smtpPort,
            smtpSecure,
            user: smtpUser,
            pass: smtpPass,
            from: emailFrom,
            source: "database",
          },
          {
            to: parsed.data.testEmail,
            subject: "SyncBridge SMTP Test",
            text: "This is a test email from SyncBridge. Your SMTP configuration is working.",
            html: "<p>This is a test email from <strong>SyncBridge</strong>. Your SMTP configuration is working.</p>",
          }
        );

        if (!sent.success) {
          return res.status(400).json({
            message:
              sent.error ||
              "Failed to send test email. Check SMTP host, port, encryption, username, and password.",
          });
        }

        res.json({ success: true, message: `Test email sent to ${parsed.data.testEmail}` });
      } catch (error) {
        console.error("POST /api/email-settings/test error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "A valid test email address is required" });
        }
        res.status(500).json({ message: "Failed to send test email" });
      }
    }
  );
}

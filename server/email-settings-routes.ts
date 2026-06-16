import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { resolveRequestTenantId } from "./middleware/tenant";
import { invalidateEmailTransporterCache, sendEmailDetailed, verifySmtpConnection } from "./email";

const emailSettingsBodySchema = z.object({
  smtpHost: z.string().trim().min(1),
  smtpPort: z.union([z.string(), z.number()]).transform((val) => Number(val)),
  smtpSecure: z.enum(["None", "SSL/TLS", "STARTTLS"]),
  smtpUser: z.string().trim().min(1),
  smtpPass: z.string().optional(),
  emailFrom: z.string().trim().email(),
});

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

        const testEmail = z
          .string()
          .trim()
          .email()
          .parse(req.body?.testEmail);

        const sent = await sendEmailDetailed({
          to: testEmail,
          subject: "SyncBridge SMTP Test",
          text: "This is a test email from SyncBridge. Your SMTP configuration is working.",
          html: "<p>This is a test email from <strong>SyncBridge</strong>. Your SMTP configuration is working.</p>",
          tenantId,
        });

        if (!sent.success) {
          return res.status(400).json({
            message:
              sent.error ||
              "Failed to send test email. Check SMTP host, port, encryption, username, and password.",
          });
        }

        res.json({ success: true, message: `Test email sent to ${testEmail}` });
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

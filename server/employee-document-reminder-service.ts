import { storage } from "./storage";

import { sendEmail } from "./email";

import {

  generatePassportVisaReminderEmailHTML,

  generatePassportVisaReminderEmailText,

} from "./email";

import {

  getIdentityDocumentReminderEmails,

  getReminderNotificationUsers,

} from "./reminder-email-recipients";

import {

  DEPENDENT_PASSPORT_REMINDER_MONTHS,

  DEPENDENT_VISA_REMINDER_MONTHS,

  EMPLOYEE_PASSPORT_REMINDER_MONTHS,

  type DocumentReminderType,

  addDays,

  documentTypeLabel,

  getDaysUntilExpiry,

  isSameDay,

  startOfDay,

  subtractMonths,

} from "@shared/document-reminder-utils";



export class EmployeeDocumentReminderService {

  private static instance: EmployeeDocumentReminderService;



  static getInstance(): EmployeeDocumentReminderService {

    if (!EmployeeDocumentReminderService.instance) {

      EmployeeDocumentReminderService.instance = new EmployeeDocumentReminderService();

    }

    return EmployeeDocumentReminderService.instance;

  }



  async runDailyChecks(): Promise<void> {

    console.log("🔍 Running employee/dependent document reminder checks...");

    try {

      await this.processAutomaticReminders();

      await this.processDueScheduledReminders();

      console.log("✅ Employee/dependent reminder checks completed");

    } catch (error) {

      console.error("❌ Employee/dependent reminder error:", error);

    }

  }



  private async processAutomaticReminders(): Promise<void> {

    const today = startOfDay(new Date());

    const employees = await storage.getEmployees();



    for (const employee of employees) {

      if (employee.passportExpiry) {

        const trigger = subtractMonths(new Date(employee.passportExpiry), EMPLOYEE_PASSPORT_REMINDER_MONTHS);

        if (isSameDay(today, trigger)) {

          const sent = await storage.hasAutoReminderSent(

            employee.id,

            null,

            "employee_passport",

            "auto_7mo"

          );

          if (!sent) {

            await this.sendReminderEmail({

              employeeId: employee.id,

              employeeCode: employee.employeeId,

              employeeName: employee.name,

              documentType: "employee_passport",

              expiryDate: new Date(employee.passportExpiry),

              reminderKind: "auto_7mo",

            });

          }

        }

      }



      if (employee.visaExpiry) {

        const trigger = subtractMonths(new Date(employee.visaExpiry), EMPLOYEE_PASSPORT_REMINDER_MONTHS);

        if (isSameDay(today, trigger)) {

          const sent = await storage.hasAutoReminderSent(

            employee.id,

            null,

            "employee_visa",

            "auto_7mo_visa"

          );

          if (!sent) {

            await this.sendReminderEmail({

              employeeId: employee.id,

              employeeCode: employee.employeeId,

              employeeName: employee.name,

              documentType: "employee_visa",

              expiryDate: new Date(employee.visaExpiry),

              reminderKind: "auto_7mo_visa",

            });

          }

        }

      }



      if (employee.nricExpiry) {

        const trigger = subtractMonths(new Date(employee.nricExpiry), EMPLOYEE_PASSPORT_REMINDER_MONTHS);

        if (isSameDay(today, trigger)) {

          const sent = await storage.hasAutoReminderSent(

            employee.id,

            null,

            "employee_nric",

            "auto_7mo_nric"

          );

          if (!sent) {

            await this.sendReminderEmail({

              employeeId: employee.id,

              employeeCode: employee.employeeId,

              employeeName: employee.name,

              documentType: "employee_nric",

              expiryDate: new Date(employee.nricExpiry),

              reminderKind: "auto_7mo_nric",

            });

          }

        }

      }



      const dependents = await storage.getDependentsByEmployeeId(employee.id);

      for (const dep of dependents) {

        if (dep.passportExpiry) {

          const trigger = subtractMonths(new Date(dep.passportExpiry), DEPENDENT_PASSPORT_REMINDER_MONTHS);

          if (isSameDay(today, trigger)) {

            const sent = await storage.hasAutoReminderSent(

              employee.id,

              dep.id,

              "dependent_passport",

              "auto_3mo_passport"

            );

            if (!sent) {

              await this.sendReminderEmail({

                employeeId: employee.id,

                employeeCode: employee.employeeId,

                employeeName: employee.name,

                dependentId: dep.id,

                dependentName: dep.name,

                documentType: "dependent_passport",

                expiryDate: new Date(dep.passportExpiry),

                reminderKind: "auto_3mo_passport",

              });

            }

          }

        }



        if (dep.visaExpiry) {

          const trigger = subtractMonths(new Date(dep.visaExpiry), DEPENDENT_VISA_REMINDER_MONTHS);

          if (isSameDay(today, trigger)) {

            const sent = await storage.hasAutoReminderSent(

              employee.id,

              dep.id,

              "dependent_visa",

              "auto_3mo_visa"

            );

            if (!sent) {

              await this.sendReminderEmail({

                employeeId: employee.id,

                employeeCode: employee.employeeId,

                employeeName: employee.name,

                dependentId: dep.id,

                dependentName: dep.name,

                documentType: "dependent_visa",

                expiryDate: new Date(dep.visaExpiry),

                reminderKind: "auto_3mo_visa",

              });

            }

          }

        }

      }

    }

  }



  private async processDueScheduledReminders(): Promise<void> {

    const today = startOfDay(new Date());

    const due = await storage.getDueDocumentReminders(today);



    for (const reminder of due) {

      const employee = await storage.getEmployee(reminder.employeeId);

      if (!employee) continue;



      let dependentName: string | undefined;

      if (reminder.dependentId) {

        const dep = await storage.getDependent(reminder.dependentId);

        dependentName = dep?.name;

      }



      await this.sendReminderEmail({

        employeeId: employee.id,

        employeeCode: employee.employeeId,

        employeeName: employee.name,

        dependentId: reminder.dependentId ?? undefined,

        dependentName,

        documentType: reminder.documentType as DocumentReminderType,

        expiryDate: reminder.expiryDate ? new Date(reminder.expiryDate) : new Date(),

        reminderKind: reminder.reminderKind || "scheduled",

        existingReminderId: reminder.id,

      });



      if (reminder.reminderKind === "daily_close") {

        await storage.scheduleDocumentReminder({

          employeeId: reminder.employeeId,

          dependentId: reminder.dependentId,

          documentType: reminder.documentType,

          expiryDate: reminder.expiryDate,

          reminderDate: addDays(today, 1),

          status: "pending",

          reminderKind: "daily_close",

          tenantId: reminder.tenantId,

        });

      }

    }

  }



  private async sendReminderEmail(params: {

    employeeId: number;

    employeeCode: string;

    employeeName: string;

    dependentId?: number;

    dependentName?: string;

    documentType: DocumentReminderType;

    expiryDate: Date;

    reminderKind: string;

    existingReminderId?: number;

  }): Promise<void> {

    const employee = await storage.getEmployee(params.employeeId);

    const daysRemaining = getDaysUntilExpiry(params.expiryDate);

    const docLabel = documentTypeLabel(params.documentType);

    const subject = `${docLabel} Expiry Reminder`;



    const html = generatePassportVisaReminderEmailHTML({

      employeeName: params.employeeName,

      dependentName: params.dependentName,

      documentType: docLabel,

      expiryDate: params.expiryDate,

      daysRemaining,

    });

    const text = generatePassportVisaReminderEmailText({

      employeeName: params.employeeName,

      dependentName: params.dependentName,

      documentType: docLabel,

      expiryDate: params.expiryDate,

      daysRemaining,

    });



    const emailRecipients = await getIdentityDocumentReminderEmails(params.employeeId);



    let sent = false;

    if (emailRecipients.length > 0) {

      for (const to of emailRecipients) {

        const success = await sendEmail({

          to,

          subject,

          html,

          text,

        });

        if (success) sent = true;

      }

    } else {

      console.log(

        `⚠️ No employee email for ${docLabel} reminder (${params.employeeName}); in-app notification only`

      );

    }



    const now = new Date();

    if (params.existingReminderId) {

      await storage.markDocumentReminderSent(params.existingReminderId, now);

    } else {

      await storage.scheduleDocumentReminder({

        tenantId: employee?.tenantId ?? null,

        employeeId: params.employeeId,

        dependentId: params.dependentId ?? null,

        documentType: params.documentType,

        expiryDate: params.expiryDate,

        reminderDate: now,

        status: "sent",

        reminderKind: params.reminderKind,

        emailSentAt: sent ? now : undefined,

      });

    }



    const message = params.dependentName

      ? `${docLabel} for dependent ${params.dependentName} (${params.employeeName}) expires in ${daysRemaining} days`

      : `${docLabel} for ${params.employeeName} expires in ${daysRemaining} days`;



    const entityType = [

      "doc_reminder",

      params.documentType,

      params.employeeId,

      params.dependentId ?? "",

      "",

      params.expiryDate.toISOString(),

    ].join(":");



    const notificationUsers = await getReminderNotificationUsers(employee?.tenantId ?? undefined);

    for (const user of notificationUsers) {

      const exists = await storage.hasNotificationForEntity(user.id, entityType);

      if (exists) continue;



      await storage.createNotification({

        tenantId: employee?.tenantId ?? user.tenantId ?? null,

        type: "document_expiry",

        message,

        targetUserId: user.id,

        seen: false,

        entityId: params.employeeId,

        entityType,

      });

    }



    if (sent) {

      console.log(`📧 Reminder sent to ${emailRecipients.join(", ")} (${params.documentType})`);

    }

  }

}



export function initializeEmployeeDocumentReminderMonitoring(): void {

  const service = EmployeeDocumentReminderService.getInstance();

  setTimeout(() => service.runDailyChecks(), 45000);

  setInterval(() => service.runDailyChecks(), 24 * 60 * 60 * 1000);

}



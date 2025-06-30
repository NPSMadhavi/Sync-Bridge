import { storage } from './storage';
import { sendEmail, generateDocumentExpiryEmailHTML, generateDocumentExpiryEmailText } from './email';

interface ExpiringDocument {
  id: number;
  title: string;
  expiryDate: Date;
  employeeId?: number;
  employeeName?: string;
  employeeEmail?: string;
  daysUntilExpiry: number;
}

/**
 * Document Expiry Notification Service
 * Checks for expiring documents and sends email notifications
 */
export class DocumentExpiryNotifier {
  private static instance: DocumentExpiryNotifier;

  static getInstance(): DocumentExpiryNotifier {
    if (!DocumentExpiryNotifier.instance) {
      DocumentExpiryNotifier.instance = new DocumentExpiryNotifier();
    }
    return DocumentExpiryNotifier.instance;
  }

  /**
   * Check for expiring documents and send notifications
   * @param alertDays Array of days before expiry to send alerts (e.g., [30, 14, 7, 1])
   */
  async checkAndNotifyExpiringDocuments(alertDays: number[] = [30, 14, 7, 1]): Promise<void> {
    console.log('🔍 Checking for expiring documents...');
    
    try {
      // Get all expiring documents (company documents and employee documents)
      const expiringDocuments = await this.getExpiringDocuments(alertDays);
      
      if (expiringDocuments.length === 0) {
        console.log('✅ No documents requiring expiry notifications');
        return;
      }

      console.log(`📋 Found ${expiringDocuments.length} documents requiring notifications`);

      // Send notifications for each expiring document
      for (const document of expiringDocuments) {
        await this.sendExpiryNotification(document);
      }

      console.log('✅ Document expiry notifications completed');
    } catch (error) {
      console.error('❌ Error checking expiring documents:', error);
    }
  }

  /**
   * Get all documents that are expiring within the specified alert days
   */
  private async getExpiringDocuments(alertDays: number[]): Promise<ExpiringDocument[]> {
    const expiringDocuments: ExpiringDocument[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check company documents
    const companyDocuments = await storage.getCompanyDocuments();
    for (const doc of companyDocuments) {
      if (doc.expiryDate) {
        const expiryDate = new Date(doc.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if this document needs an alert (expired or expiring on alert days)
        if (daysUntilExpiry <= 0 || alertDays.includes(daysUntilExpiry)) {
          expiringDocuments.push({
            id: doc.id,
            title: doc.title,
            expiryDate: doc.expiryDate,
            daysUntilExpiry
          });
        }
      }
    }

    // Check employee documents
    const employees = await storage.getEmployees();
    for (const employee of employees) {
      const documents = await storage.getEmployeeDocuments(employee.id);
      for (const doc of documents) {
        if (doc.expiryDate) {
          const expiryDate = new Date(doc.expiryDate);
          expiryDate.setHours(0, 0, 0, 0);
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilExpiry <= 0 || alertDays.includes(daysUntilExpiry)) {
            expiringDocuments.push({
              id: doc.id,
              title: doc.title,
              expiryDate: doc.expiryDate,
              employeeId: employee.id,
              employeeName: employee.name,
              employeeEmail: employee.email,
              daysUntilExpiry
            });
          }
        }
      }
    }

    return expiringDocuments;
  }

  /**
   * Send expiry notification for a specific document
   */
  private async sendExpiryNotification(document: ExpiringDocument): Promise<void> {
    try {
      // Determine recipients
      const recipients = await this.getNotificationRecipients(document);
      
      if (recipients.length === 0) {
        console.log(`⚠️ No email recipients found for document: ${document.title}`);
        return;
      }

      // Generate email content
      const subject = this.generateEmailSubject(document);
      const htmlContent = generateDocumentExpiryEmailHTML(
        document.title,
        document.expiryDate.toISOString(),
        document.daysUntilExpiry,
        document.employeeName
      );
      const textContent = generateDocumentExpiryEmailText(
        document.title,
        document.expiryDate.toISOString(),
        document.daysUntilExpiry,
        document.employeeName
      );

      // Send email to each recipient
      for (const recipient of recipients) {
        const success = await sendEmail({
          to: recipient,
          subject,
          html: htmlContent,
          text: textContent
        });

        if (success) {
          console.log(`📧 Expiry notification sent to ${recipient} for document: ${document.title}`);
          
          // Create internal notification record
          await this.createInternalNotification(document, recipient);
        } else {
          console.error(`❌ Failed to send expiry notification to ${recipient} for document: ${document.title}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error sending notification for document ${document.title}:`, error);
    }
  }

  /**
   * Get list of email recipients for a document expiry notification
   */
  private async getNotificationRecipients(document: ExpiringDocument): Promise<string[]> {
    const recipients: string[] = [];

    // For employee documents, notify the employee
    if (document.employeeEmail) {
      recipients.push(document.employeeEmail);
    }

    // Always notify HR managers and administrators
    const users = await storage.getUsers();
    for (const user of users) {
      if (user.role === 'hr_manager' || user.role === 'admin' || user.role === 'super_admin') {
        if (user.email && !recipients.includes(user.email)) {
          recipients.push(user.email);
        }
      }
    }

    return recipients;
  }

  /**
   * Generate appropriate email subject based on document expiry status
   */
  private generateEmailSubject(document: ExpiringDocument): string {
    const isExpired = document.daysUntilExpiry <= 0;
    const isUrgent = document.daysUntilExpiry <= 7;
    
    if (isExpired) {
      return `🚨 URGENT: Document Expired - ${document.title}`;
    } else if (isUrgent) {
      return `⚠️ URGENT: Document Expiring Soon - ${document.title} (${document.daysUntilExpiry} days)`;
    } else {
      return `📋 Document Expiry Reminder - ${document.title} (${document.daysUntilExpiry} days)`;
    }
  }

  /**
   * Create internal notification record for tracking
   */
  private async createInternalNotification(document: ExpiringDocument, recipient: string): Promise<void> {
    try {
      const message = document.daysUntilExpiry <= 0 
        ? `Document "${document.title}" has expired and requires immediate attention`
        : `Document "${document.title}" will expire in ${document.daysUntilExpiry} day${document.daysUntilExpiry !== 1 ? 's' : ''}`;

      await storage.createNotification({
        type: 'document_expiry' as const,
        message,
        seen: false,
        targetUserId: 1, // Default to admin user
        entityId: document.id,
        entityType: 'document'
      });
      
      console.log(`📝 Internal notification created for document: ${document.title}`);
    } catch (error) {
      console.error('❌ Error creating internal notification:', error);
    }
  }

  /**
   * Manual trigger for testing expiry notifications
   */
  async sendTestExpiryNotification(documentId: number): Promise<boolean> {
    try {
      console.log(`🧪 Sending test expiry notification for document ID: ${documentId}`);
      
      // Get document details
      const companyDocuments = await storage.getCompanyDocuments();
      const document = companyDocuments.find(doc => doc.id === documentId);
      
      if (!document || !document.expiryDate) {
        console.error('❌ Document not found or has no expiry date');
        return false;
      }

      const today = new Date();
      const expiryDate = new Date(document.expiryDate);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const testDocument: ExpiringDocument = {
        id: document.id,
        title: document.title,
        expiryDate: document.expiryDate,
        daysUntilExpiry
      };

      await this.sendExpiryNotification(testDocument);
      return true;
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      return false;
    }
  }
}

/**
 * Initialize periodic document expiry checking
 * Checks for expiring documents every 24 hours
 */
export function initializeDocumentExpiryMonitoring(): void {
  const notifier = DocumentExpiryNotifier.getInstance();
  
  // Run initial check
  notifier.checkAndNotifyExpiringDocuments();
  
  // Schedule daily checks at 9 AM
  const checkInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  setInterval(() => {
    notifier.checkAndNotifyExpiringDocuments();
  }, checkInterval);
  
  console.log('📅 Document expiry monitoring initialized - checks run every 24 hours');
}

// Export singleton instance for use in routes
export const documentExpiryNotifier = DocumentExpiryNotifier.getInstance();
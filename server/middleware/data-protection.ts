import { Request, Response, NextFunction } from 'express';
import { DataEncryption } from 'server/utils/encryption';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
    isSuperAdmin?: boolean;
    tenantId?: number;
  } | any;
}

/**
 * Middleware to decrypt and mask sensitive data in API responses
 */
export function dataProtectionMiddleware() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data: any) {
      try {
        // Never transform binary payloads (PDF, images, etc.)
        if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
          return originalSend.call(this, data);
        }

        if (typeof data === 'string') {
          // Try to parse JSON
          try {
            const parsed = JSON.parse(data);
            const processed = processResponseData(parsed, req.user);
            return originalSend.call(this, JSON.stringify(processed));
          } catch {
            // Not JSON, send as is
            return originalSend.call(this, data);
          }
        } else if (typeof data === 'object') {
          const processed = processResponseData(data, req.user);
          return originalSend.call(this, processed);
        }
        
        return originalSend.call(this, data);
      } catch (error) {
        console.error('Error in data protection middleware:', error);
        return originalSend.call(this, data);
      }
    };
    
    next();
  };
}

/**
 * Process response data to decrypt and mask sensitive information
 */
function processResponseData(data: any, user?: AuthenticatedRequest['user']): any {
  if (!data) return data;
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => processResponseData(item, user));
  }
  
  // Handle objects
  if (typeof data === 'object' && data !== null) {
    const processed: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        processed[key] = processResponseData(value, user);
      } else if (typeof value === 'string' && DataEncryption.isEncrypted(value)) {
        // Always decrypt encrypted data first and send to frontend
        // Frontend will handle masking based on user permissions and eye icon clicks
        try {
          const decryptedValue = DataEncryption.decrypt(value);
          processed[key] = decryptedValue;
        } catch (error) {
          console.error('Error decrypting data:', error);
          processed[key] = value; // Keep encrypted if decryption fails
        }
      } else {
        processed[key] = value;
      }
    }
    
    return processed;
  }
  
  return data;
}

/**
 * Check if user can view unmasked data
 */
function canViewUnmaskedData(user?: AuthenticatedRequest['user']): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return ['super_admin', 'admin', 'hr_manager', 'vendor'].includes(user.role);
}

/**
 * Apply masking to specific fields based on field name
 */
function applyFieldMasking(fieldName: string, value: string, user?: AuthenticatedRequest['user']): string {
  if (!value || typeof value !== 'string') return value;
  
  // If user can view unmasked data, return as is
  if (canViewUnmaskedData(user)) return value;
  
  const lowerFieldName = fieldName.toLowerCase();
  
  // Passport masking - show last 4 digits
  if (lowerFieldName.includes('passport')) {
    return maskPassport(value);
  }
  
  // Visa masking - show last 4 digits
  if (lowerFieldName.includes('visa')) {
    return maskVisa(value);
  }
  
  // NRIC/FIN masking - show last 4 digits
  if (lowerFieldName.includes('nric') || lowerFieldName.includes('fin')) {
    return maskNric(value);
  }
  
  // Email masking
  if (lowerFieldName.includes('email')) {
    return maskEmail(value);
  }
  
  // Phone masking
  if (lowerFieldName.includes('phone') || lowerFieldName.includes('mobile')) {
    return maskPhone(value);
  }
  
  // Tax ID masking
  if (lowerFieldName.includes('tax') || lowerFieldName.includes('registration')) {
    return maskTaxId(value);
  }
  
  // Generic masking for other sensitive fields
  if (value.length > 4) {
    return '*'.repeat(value.length - 4) + value.slice(-4);
  }
  
  return value;
}

/**
 * Mask passport number - show last 4 digits
 */
function maskPassport(passport: string): string {
  if (!passport) return '';
  
  if (passport.length <= 4) return passport;
  
  const lastFour = passport.slice(-4);
  const masked = '*'.repeat(passport.length - 4);
  return `${masked}${lastFour}`;
}

/**
 * Mask visa number - show last 4 digits
 */
function maskVisa(visa: string): string {
  if (!visa) return '';
  
  if (visa.length <= 4) return visa;
  
  const lastFour = visa.slice(-4);
  const masked = '*'.repeat(visa.length - 4);
  return `${masked}${lastFour}`;
}

/**
 * Mask NRIC/FIN number - show last 4 digits
 */
function maskNric(nric: string): string {
  if (!nric) return '';
  
  if (nric.length <= 4) return nric;
  
  const lastFour = nric.slice(-4);
  const masked = '*'.repeat(nric.length - 4);
  return `${masked}${lastFour}`;
}

/**
 * Mask email address
 */
function maskEmail(email: string): string {
  if (!email) return '';
  
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  
  if (localPart.length <= 2) {
    return `${localPart}****@${domain}`;
  }
  
  const maskedLocal = localPart.charAt(0) + '*'.repeat(localPart.length - 1);
  return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone number
 */
function maskPhone(phone: string): string {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 4) return phone;
  
  const lastFour = cleaned.slice(-4);
  const masked = '*'.repeat(cleaned.length - 4);
  return `${masked}${lastFour}`;
}

/**
 * Mask tax ID
 */
function maskTaxId(taxId: string): string {
  if (!taxId) return '';
  
  if (taxId.length <= 4) return taxId;
  
  const lastFour = taxId.slice(-4);
  const masked = '*'.repeat(taxId.length - 4);
  return `${masked}${lastFour}`;
} 
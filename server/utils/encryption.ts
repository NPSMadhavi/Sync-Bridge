import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-key-32-chars-long!!';
const ALGORITHM = 'aes-256-cbc';

export class DataEncryption {
  /**
   * Encrypt a string value
   */
  static encrypt(text: string): string {
    if (!text) return text;
    
    const iv = crypto.randomBytes(16);
    // Use createCipheriv instead of deprecated createCipher
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt a string value
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText || !this.isEncrypted(encryptedText)) {
      return encryptedText;
    }
    
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      
      // Validate IV format
      if (!ivHex || ivHex.length !== 32) {
        console.error('Invalid IV format:', ivHex);
        return encryptedText;
      }
      
      const iv = Buffer.from(ivHex, 'hex');
      
      // Validate IV length (should be 16 bytes for AES-256-CBC)
      if (iv.length !== 16) {
        console.error('Invalid IV length:', iv.length);
        return encryptedText;
      }
      
      // Use createDecipheriv instead of deprecated createDecipher
      const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Error decrypting data:', error);
      return encryptedText;
    }
  }

  /**
   * Check if a string is encrypted
   */
  static isEncrypted(text: string): boolean {
    return text && text.includes(':') && text.split(':').length === 2;
  }

  /**
   * Encrypt an object's sensitive fields
   */
  static async encryptObject<T extends Record<string, any>>(
    obj: T, 
    sensitiveFields: readonly string[]
  ): Promise<T> {
    const encrypted = { ...obj };
    
    for (const field of sensitiveFields) {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt an object's sensitive fields
   */
  static async decryptObject<T extends Record<string, any>>(
    obj: T, 
    sensitiveFields: readonly string[]
  ): Promise<T> {
    const decrypted = { ...obj };
    
    for (const field of sensitiveFields) {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        decrypted[field] = this.decrypt(decrypted[field]);
      }
    }
    
    return decrypted;
  }
} 
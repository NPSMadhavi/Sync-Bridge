# Data Encryption and Masking System

## Overview

SyncBridge now includes a comprehensive data encryption and masking system to protect sensitive Personally Identifiable Information (PII) in compliance with data protection regulations.

## Features

### 🔐 Backend Encryption
- **AES-256-GCM encryption** for sensitive data
- **Automatic encryption** of PII before database storage
- **Secure key derivation** using scrypt
- **Role-based decryption** for authorized users only

### 🎭 Frontend Masking
- **Real-time masking** of sensitive data in UI
- **Role-based masking** - different levels for different user roles
- **Consistent masking patterns** across all components
- **Clean, user-friendly display** of masked data

## Protected Fields

### Users
- Full name
- Email address

### Employees
- Full name
- NRIC/FIN number
- Passport number
- Visa number

### Dependents
- Full name
- Passport number
- Visa number

### Vendors
- Company name
- Contact person name
- Email address
- Phone number
- Tax ID
- Registration number

### Customers
- Full name
- Email address
- Phone number
- Tax ID

### Vendor Customers
- Customer name
- Customer email
- Customer phone

## User Role Permissions

### Super Admin
- ✅ Can view all unmasked data
- ✅ Can decrypt all sensitive information
- ✅ Full access to all PII

### Admin
- ✅ Can view all unmasked data within their tenant
- ✅ Can decrypt sensitive information within their tenant
- ✅ Full access to tenant PII

### HR Manager
- ✅ Can view all unmasked data within their tenant
- ✅ Can decrypt sensitive information within their tenant
- ✅ Full access to employee PII

### Other Roles (Employee, Vendor, etc.)
- ❌ Cannot view unmasked data
- ❌ Cannot decrypt sensitive information
- ✅ Can view masked data only

## Setup Instructions

### 1. Environment Configuration

Add these environment variables to your `.env` file:

```bash
# Encryption Keys (REQUIRED)
ENCRYPTION_KEY=your-secure-encryption-key-32-chars-long
ENCRYPTION_SALT=your-salt-16-chars

# Example (DO NOT USE IN PRODUCTION)
ENCRYPTION_KEY=my-super-secure-encryption-key-32-chars
ENCRYPTION_SALT=my-salt-16-chars
```

### 2. Generate Secure Keys

**For Production:**
```bash
# Generate a secure 32-character encryption key
openssl rand -hex 16

# Generate a secure 16-character salt
openssl rand -hex 8
```

**For Development:**
You can use any 32-character string for the key and 16-character string for the salt, but ensure they're consistent across deployments.

### 3. Database Migration

The encryption system works with existing data. New data will be automatically encrypted, while existing data will remain as-is until updated.

## Implementation Details

### Backend Encryption

**Location:** `server/utils/encryption.ts`

**Key Features:**
- AES-256-GCM encryption with random IV
- Scrypt key derivation for enhanced security
- Automatic detection of encrypted vs plain text
- Batch encryption/decryption for objects

**Usage:**
```typescript
import { DataEncryption } from './utils/encryption';

// Encrypt sensitive data
const encrypted = await DataEncryption.encrypt("sensitive-data");

// Decrypt data (for authorized users only)
const decrypted = await DataEncryption.decrypt(encrypted);
```

### Frontend Masking

**Location:** `client/src/lib/data-masking.ts`

**Key Features:**
- Role-based masking logic
- Consistent masking patterns
- Type-safe implementation
- React hooks for easy integration

**Usage:**
```typescript
import { applyMaskingToArray } from '@/lib/data-masking';

// Apply masking to data based on user role
const maskedData = applyMaskingToArray(rawData, 'employees', user);
```

### Middleware Integration

**Location:** `server/middleware/data-protection.ts`

**Key Features:**
- Automatic response processing
- Role-based decryption
- Transparent masking for unauthorized users
- Error handling and fallbacks

## Masking Patterns

### Email Addresses
- **Input:** `john.doe@company.com`
- **Masked:** `j****@company.com`

### Phone Numbers
- **Input:** `+65 9123 4567`
- **Masked:** `XXXXXXX4567`

### Passport Numbers
- **Input:** `E12345678`
- **Masked:** `XXXX5678`

### Visa Numbers
- **Input:** `S1234567A`
- **Masked:** `XXXX567A`

### Names
- **Input:** `John Doe Smith`
- **Masked:** `J*** D** S****`

### Tax IDs
- **Input:** `123456789`
- **Masked:** `XXXXX6789`

## Security Considerations

### Key Management
- ✅ Encryption keys stored in environment variables
- ✅ Keys not committed to version control
- ✅ Different keys for different environments
- ⚠️ Regular key rotation recommended

### Data Access
- ✅ Role-based access control
- ✅ Automatic masking for unauthorized users
- ✅ Audit logging for data access
- ✅ No plain text PII in logs

### Database Security
- ✅ Encrypted data at rest
- ✅ No plain text PII in database
- ✅ Backup encryption recommended
- ✅ Database access logging

## Migration Guide

### For Existing Data

1. **Backup your database** before enabling encryption
2. **Set up environment variables** with encryption keys
3. **Deploy the new version** - existing data remains accessible
4. **Update records** to encrypt new data automatically
5. **Optional:** Create migration script to encrypt existing data

### For New Deployments

1. **Set up environment variables** with encryption keys
2. **Deploy the application** - all new data will be encrypted
3. **No additional steps required**

## Troubleshooting

### Common Issues

**Encryption Key Errors:**
```
Error: Failed to encrypt data
```
- Check that `ENCRYPTION_KEY` is exactly 32 characters
- Check that `ENCRYPTION_SALT` is exactly 16 characters
- Ensure environment variables are loaded correctly

**Masking Not Working:**
```
Data appears unmasked for unauthorized users
```
- Check user role permissions
- Verify masking middleware is enabled
- Check frontend masking implementation

**Decryption Errors:**
```
Error: Failed to decrypt data
```
- Verify encryption keys match between environments
- Check data format (should be encrypted)
- Ensure user has proper permissions

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG_ENCRYPTION=true
```

This will log encryption/decryption operations (use only in development).

## Compliance

This implementation helps meet requirements for:
- **GDPR** - Data protection and privacy
- **PDPA** - Personal Data Protection Act
- **SOC 2** - Security controls
- **ISO 27001** - Information security management

## Support

For issues or questions about the encryption system:
1. Check the troubleshooting section
2. Review the implementation code
3. Test with debug mode enabled
4. Contact the development team

---

**⚠️ Important:** Never commit encryption keys to version control. Always use environment variables for production deployments. 
# SMTP Configuration Guide for SyncBridge

## Overview
SyncBridge now includes email notification functionality using SMTP. This guide will help you configure the email settings.

## Configuration Steps

### 1. Update Environment Variables
Edit the file `server/.env` and update the following SMTP settings:

```env
# Email Configuration
SMTP_HOST="smtp.gmail.com"           # Your SMTP server hostname
SMTP_PORT="587"                      # SMTP port (587 for TLS, 465 for SSL)
SMTP_SECURE="false"                  # Set to 'true' for SSL (port 465), 'false' for TLS (port 587)
SMTP_USER="your-email@gmail.com"     # Your email address
SMTP_PASS="your-app-password"        # Your email password or app password
EMAIL_FROM="noreply@syncbridge.com"  # From email address
```

### 2. Common SMTP Providers

#### Gmail
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"  # Use App Password, not regular password
```

**Note for Gmail**: You need to enable 2-factor authentication and generate an App Password.

#### Outlook/Hotmail
```env
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@outlook.com"
SMTP_PASS="your-password"
```

#### Yahoo
```env
SMTP_HOST="smtp.mail.yahoo.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@yahoo.com"
SMTP_PASS="your-app-password"  # Use App Password
```

#### Custom SMTP Server
```env
SMTP_HOST="mail.yourcompany.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="noreply@yourcompany.com"
SMTP_PASS="your-smtp-password"
```

### 3. Testing the Configuration

1. **Start the application**
2. **Navigate to Settings > System Settings**
3. **Click "Send Test Email"** to verify SMTP configuration
4. **Check your email** for the test message

### 4. Email Features

The following email notifications are now available:

- **Document Expiry Alerts**: Notifications when documents are about to expire
- **Asset Assignment Notifications**: When assets are assigned to users
- **Maintenance Alerts**: Scheduled maintenance notifications
- **General Notifications**: System-wide notifications

### 5. Troubleshooting

#### Common Issues

1. **"Failed to send test email"**
   - Check SMTP credentials
   - Verify SMTP host and port
   - Ensure firewall allows SMTP traffic

2. **"Authentication failed"**
   - Verify username and password
   - For Gmail/Yahoo, use App Password instead of regular password
   - Check if 2FA is enabled (required for App Passwords)

3. **"Connection timeout"**
   - Check SMTP host and port
   - Verify network connectivity
   - Check firewall settings

4. **"SSL/TLS errors"**
   - Try different SMTP_SECURE settings
   - Check if your SMTP provider requires specific SSL/TLS settings

#### Debug Information

The application logs SMTP connection details. Check the console output for:
- SMTP connection status
- Missing environment variables
- Connection errors

### 6. Security Notes

- **Never commit .env files** to version control
- **Use App Passwords** for Gmail/Yahoo instead of regular passwords
- **Enable 2FA** on your email account for better security
- **Use dedicated email accounts** for notifications when possible

### 7. Production Deployment

For production environments:

1. **Use environment variables** instead of .env file
2. **Use dedicated SMTP services** like SendGrid, Mailgun, or AWS SES
3. **Monitor email delivery** and bounce rates
4. **Implement rate limiting** to prevent abuse

## Example Configuration Files

### Development (.env)
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="dev@yourcompany.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="noreply@yourcompany.com"
```

### Production (Environment Variables)
```bash
export SMTP_HOST="smtp.sendgrid.net"
export SMTP_PORT="587"
export SMTP_SECURE="false"
export SMTP_USER="apikey"
export SMTP_PASS="your-sendgrid-api-key"
export EMAIL_FROM="noreply@yourcompany.com"
```

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify your SMTP provider's documentation
3. Test with a simple SMTP client first
4. Contact your system administrator for network/firewall issues 
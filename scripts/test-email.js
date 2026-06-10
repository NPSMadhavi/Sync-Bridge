import { sendEmail } from '../server/email.ts';

async function main() {
  try {
    console.log('Sending test email...');
    const result = await sendEmail({
      to: 'shakuntala@myrsv.com',
      subject: 'Test Email from SyncBridge script',
      text: 'This is a test email.',
      html: '<p>This is a test email.</p>'
    });
    console.log('Send email result:', result);
  } catch (error) {
    console.error('Error sending email:', error);
  }
  process.exit(0);
}

main();

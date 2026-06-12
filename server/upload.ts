import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the upload directory path
const uploadsDir = path.join(__dirname, '..', 'uploads');
const employeeDocumentsDir = path.join(uploadsDir, 'employee-documents');
const payslipsDir = path.join(uploadsDir, 'payslips');
const payslipZipsDir = path.join(uploadsDir, 'payslip-zips');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(employeeDocumentsDir)) {
  fs.mkdirSync(employeeDocumentsDir, { recursive: true });
}
if (!fs.existsSync(payslipsDir)) {
  fs.mkdirSync(payslipsDir, { recursive: true });
}
if (!fs.existsSync(payslipZipsDir)) {
  fs.mkdirSync(payslipZipsDir, { recursive: true });
}

// Custom file upload middleware
export const uploadMiddleware = express.json({
  limit: '10mb', // Limit payload size
});

// Handle base64 encoded file uploads and save to filesystem
export const handleFileUpload = async (
  base64Data: string,
  filePrefix: string = 'file'
): Promise<string> => {
  try {
    // Remove the data URL prefix
    const base64Content = base64Data.indexOf(',') > -1 
      ? base64Data.split(',')[1] 
      : base64Data;
    
    // Generate a random filename to prevent collisions
    const randomId = randomBytes(8).toString('hex');
    const filename = `${filePrefix}-${randomId}.pdf`;
    const filePath = path.join(uploadsDir, filename);
    
    // Write the buffer to a file
    await fs.promises.writeFile(filePath, Buffer.from(base64Content, 'base64'));
    
    // Return the relative path to the file (to be stored in the database)
    return `uploads/${filename}`;
  } catch (error) {
    console.error('File upload error:', error);
    throw new Error('Failed to save the uploaded file');
  }
};

function extensionFromDataUrl(base64Data: string): string {
  const mimeMatch = base64Data.match(/^data:([^;]+);/);
  const mimeType = mimeMatch?.[1] || 'application/pdf';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('pdf')) return 'pdf';
  return 'pdf';
}

/** Save employee passport/NRIC/visa scans to uploads/employee-documents/ */
export const handleEmployeeScanUpload = async (
  base64Data: string,
  filePrefix: string
): Promise<string> => {
  try {
    if (!base64Data.startsWith('data:')) {
      return base64Data;
    }

    const base64Content = base64Data.includes(',')
      ? base64Data.split(',')[1]
      : base64Data;

    const extension = extensionFromDataUrl(base64Data);
    const randomId = randomBytes(8).toString('hex');
    const filename = `${filePrefix}-${Date.now()}-${randomId}.${extension}`;
    const filePath = path.join(employeeDocumentsDir, filename);

    await fs.promises.writeFile(filePath, Buffer.from(base64Content, 'base64'));

    return `uploads/employee-documents/${filename}`;
  } catch (error) {
    console.error('Employee scan upload error:', error);
    throw new Error('Failed to save the employee document upload');
  }
};

export async function processEmployeeScanFields<T extends Record<string, unknown>>(
  body: T
): Promise<T> {
  const processed = { ...body };
  const scanFields: Array<{ key: keyof T; prefix: string }> = [
    { key: 'passportScan' as keyof T, prefix: 'employee-passport' },
    { key: 'nricScan' as keyof T, prefix: 'employee-nric' },
    { key: 'visaScan' as keyof T, prefix: 'employee-visa' },
  ];

  for (const { key, prefix } of scanFields) {
    const value = processed[key];
    if (typeof value === 'string' && value.startsWith('data:')) {
      processed[key] = (await handleEmployeeScanUpload(value, prefix)) as T[keyof T];
    }
  }

  return processed;
};

// Serve uploaded files
export const setupFileServing = (app: express.Express): void => {
  app.use(
    '/uploads',
    express.static(uploadsDir, {
      setHeaders(res, filePath) {
        if (filePath.toLowerCase().endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
        }
      },
    })
  );
};

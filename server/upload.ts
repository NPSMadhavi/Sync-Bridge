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

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
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

// Serve uploaded files
export const setupFileServing = (app: express.Express): void => {
  app.use('/uploads', express.static(uploadsDir));
};

import OpenAI from 'openai';
import { convert } from 'pdf-poppler';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable must be set");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DocumentAnalysisResult {
  title: string;
  documentType: 'company_license' | 'government_certificate' | 'purchase_invoice' | 'rental_agreement' | 'utility_bill' | 'payment_reminder' | 'legal_agreement' | 'other';
  customType?: string;
  issueDate?: string; // ISO date string
  expiryDate?: string; // ISO date string
  confidence: number; // 0-1 score
  extractedText?: string;
}

export async function analyzeDocument(base64Image: string, mimeType: string): Promise<DocumentAnalysisResult> {
  try {
    // Prepare the image data
    const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this document image and extract the following information in JSON format:

IMPORTANT: Respond with ONLY a valid JSON object, no additional text or explanation.

Required fields:
- title: The main document title/name (string)
- documentType: One of these exact values: "company_license", "government_certificate", "purchase_invoice", "rental_agreement", "utility_bill", "payment_reminder", "legal_agreement", "other"
- customType: If documentType is "other", specify the actual document type (string, optional)
- issueDate: Issue/creation date in ISO format YYYY-MM-DD (string, optional)
- expiryDate: Expiry/due date in ISO format YYYY-MM-DD (string, optional)
- confidence: Confidence score 0-1 (number)
- extractedText: Key text content from the document (string, optional)

Guidelines for document type classification:
- company_license: Business licenses, permits, registrations
- government_certificate: Official certificates, registrations, permits from government
- purchase_invoice: Bills, invoices, purchase orders, receipts
- rental_agreement: Lease agreements, rental contracts
- utility_bill: Electricity, water, gas, internet, phone bills
- payment_reminder: Payment notices, reminders, due notices
- legal_agreement: Contracts, legal documents, agreements
- other: Any document that doesn't fit the above categories

Extract dates carefully - look for:
- Issue dates: "Issued on", "Date of issue", "Created", "Dated"
- Expiry dates: "Expires", "Valid until", "Due date", "Expiry date", "Valid till"

Example response:
{
  "title": "Business License Certificate",
  "documentType": "company_license",
  "issueDate": "2024-01-15",
  "expiryDate": "2025-01-15",
  "confidence": 0.95,
  "extractedText": "Singapore Business License for XYZ Pte Ltd"
}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageData}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const responseText = response.choices[0]?.message?.content?.trim();
    
    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    // Try to parse the JSON response
    let result: DocumentAnalysisResult;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      // If JSON parsing fails, extract JSON from response if it's wrapped in other text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Invalid JSON response from OpenAI");
      }
    }

    // Validate required fields and provide defaults
    const validDocumentTypes = [
      'company_license', 'government_certificate', 'purchase_invoice', 
      'rental_agreement', 'utility_bill', 'payment_reminder', 'legal_agreement', 'other'
    ];

    return {
      title: result.title || "Untitled Document",
      documentType: validDocumentTypes.includes(result.documentType) ? result.documentType : 'other',
      customType: result.documentType === 'other' ? result.customType : undefined,
      issueDate: result.issueDate || undefined,
      expiryDate: result.expiryDate || undefined,
      confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
      extractedText: result.extractedText || undefined,
    };

  } catch (error) {
    console.error("Error analyzing document:", error);
    
    // Return fallback result
    return {
      title: "Document Analysis Failed",
      documentType: 'other',
      customType: "Unknown Document Type",
      confidence: 0,
      extractedText: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Convert PDF to image and analyze with full AI vision
export async function analyzePDF(base64PDF: string, filename?: string): Promise<DocumentAnalysisResult> {
  const tempDir = join(process.cwd(), 'temp');
  const tempPdfPath = join(tempDir, `temp_pdf_${Date.now()}.pdf`);
  let tempImagePath: string | null = null;

  try {
    // Ensure temp directory exists
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Convert base64 to PDF file
    const pdfBuffer = Buffer.from(base64PDF, 'base64');
    await writeFile(tempPdfPath, pdfBuffer);

    // Convert first page of PDF to image using pdftoppm
    const timestamp = Date.now();
    const options = {
      format: 'jpeg' as const,
      out_dir: tempDir,
      out_prefix: `pdf_page_${timestamp}`,
      page: 1, // Only convert first page
      single_file: true,
      poppler_path: '/nix/store/1f2vbia1rg1rh5cs0ii49v3hln9i36rv-poppler-utils-24.02.0/bin'
    };

    console.log('Converting PDF with options:', options);
    const result = await convert(tempPdfPath, options);
    console.log('PDF conversion result:', result);
    
    if (!result || result.length === 0) {
      throw new Error("PDF conversion returned no results - possibly corrupted PDF or conversion issue");
    }

    // The result should be the path to the converted image
    tempImagePath = result[0];
    console.log('Converted image path:', tempImagePath);

    if (!existsSync(tempImagePath)) {
      throw new Error(`Converted image file not found at path: ${tempImagePath}`);
    }

    // Read the converted image and convert to base64
    const { readFile } = await import('fs/promises');
    const imageBuffer = await readFile(tempImagePath);
    const imageBase64 = imageBuffer.toString('base64');

    // Now analyze the image using our existing image analysis
    const analysisResult = await analyzeDocument(imageBase64, 'image/jpeg');

    // Clean up temporary files
    await unlink(tempPdfPath);
    if (tempImagePath && existsSync(tempImagePath)) {
      await unlink(tempImagePath);
    }

    return {
      ...analysisResult,
      extractedText: `PDF converted to image for analysis. ${analysisResult.extractedText || ''}`
    };

  } catch (error) {
    console.error("Error analyzing PDF:", error);

    // Clean up on error
    try {
      if (existsSync(tempPdfPath)) await unlink(tempPdfPath);
      if (tempImagePath && existsSync(tempImagePath)) await unlink(tempImagePath);
    } catch (cleanupError) {
      console.error("Error cleaning up temp files:", cleanupError);
    }

    // Re-throw the error to be handled by the main function
    throw new Error(`PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Main function to analyze any document type
export async function analyzeDocumentFile(base64Data: string, mimeType: string, filename?: string): Promise<DocumentAnalysisResult> {
  console.log(`Starting analysis for ${mimeType} file: ${filename}`);
  
  try {
    if (mimeType === 'application/pdf') {
      console.log("Processing PDF file...");
      // Use full PDF analysis with image conversion
      return await analyzePDF(base64Data, filename);
    } else if (mimeType.startsWith('image/')) {
      console.log("Processing image file...");
      return await analyzeDocument(base64Data, mimeType);
    } else {
      console.log("Unsupported file type:", mimeType);
      return {
        title: "Unsupported File Type",
        documentType: 'other',
        confidence: 0,
        extractedText: "File type not supported for AI analysis",
      };
    }
  } catch (error) {
    console.error("Error in analyzeDocumentFile:", error);
    // Always fallback to filename analysis for PDFs to prevent crashes
    if (mimeType === 'application/pdf' && filename) {
      console.log("Falling back to filename analysis for PDF...");
      return analyzeFromFilename(filename);
    }
    
    // For other errors, return a safe fallback result instead of throwing
    return {
      title: filename ? filename.replace(/\.[^/.]+$/, "") : "Analysis Failed",
      documentType: 'other',
      confidence: 0,
      extractedText: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Fallback filename analysis function
function analyzeFromFilename(filename?: string): DocumentAnalysisResult {
  let suggestedTitle = "PDF Document";
  let suggestedType: DocumentAnalysisResult['documentType'] = 'other';
  let confidence = 0.3;

  if (filename) {
    const name = filename.toLowerCase();
    suggestedTitle = filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    
    if (name.includes('invoice') || name.includes('bill') || name.includes('receipt')) {
      suggestedType = 'purchase_invoice';
      confidence = 0.7;
    } else if (name.includes('license') || name.includes('permit')) {
      suggestedType = 'company_license';
      confidence = 0.7;
    } else if (name.includes('certificate') || name.includes('cert')) {
      suggestedType = 'government_certificate';
      confidence = 0.7;
    } else if (name.includes('contract') || name.includes('agreement')) {
      suggestedType = 'legal_agreement';
      confidence = 0.7;
    } else if (name.includes('rental') || name.includes('lease')) {
      suggestedType = 'rental_agreement';
      confidence = 0.7;
    } else if (name.includes('utility') || name.includes('electric') || name.includes('water') || name.includes('gas')) {
      suggestedType = 'utility_bill';
      confidence = 0.7;
    } else if (name.includes('payment') || name.includes('reminder') || name.includes('notice')) {
      suggestedType = 'payment_reminder';
      confidence = 0.7;
    }
  }

  return {
    title: suggestedTitle,
    documentType: suggestedType,
    customType: suggestedType === 'other' ? "PDF Document" : undefined,
    confidence: confidence,
    extractedText: `Filename analysis: ${filename || 'No filename provided'}. PDF content analysis requires additional setup.`,
  };
}
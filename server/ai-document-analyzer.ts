import OpenAI from 'openai';

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

// Enhanced PDF analysis using intelligent filename and metadata extraction
export async function analyzePDF(base64PDF: string, filename?: string): Promise<DocumentAnalysisResult> {
  try {
    console.log("Analyzing PDF using intelligent filename parsing:", filename);
    
    // Extract information from filename
    let suggestedTitle = "PDF Document";
    let suggestedType: DocumentAnalysisResult['documentType'] = 'other';
    let suggestedIssueDate: string | undefined;
    let suggestedExpiryDate: string | undefined;
    let confidence = 0.3;

    if (filename) {
      const name = filename.toLowerCase();
      
      // Clean filename for title
      suggestedTitle = filename
        .replace(/\.[^/.]+$/, "") // Remove extension
        .replace(/[_-]/g, " ")    // Replace underscores/hyphens with spaces
        .replace(/\b\w/g, l => l.toUpperCase()); // Title case
      
      // Detect document type from filename patterns
      if (name.includes('invoice') || name.includes('bill') || name.includes('receipt')) {
        suggestedType = 'purchase_invoice';
        confidence = 0.85;
      } else if (name.includes('license') || name.includes('permit') || name.includes('registration')) {
        suggestedType = 'company_license';
        confidence = 0.85;
      } else if (name.includes('certificate') || name.includes('cert')) {
        suggestedType = 'government_certificate';
        confidence = 0.85;
      } else if (name.includes('contract') || name.includes('agreement')) {
        suggestedType = 'legal_agreement';
        confidence = 0.8;
      } else if (name.includes('rental') || name.includes('lease')) {
        suggestedType = 'rental_agreement';
        confidence = 0.8;
      } else if (name.includes('utility') || name.includes('electric') || name.includes('water') || name.includes('gas') || name.includes('internet')) {
        suggestedType = 'utility_bill';
        confidence = 0.8;
      } else if (name.includes('payment') || name.includes('reminder') || name.includes('notice') || name.includes('due')) {
        suggestedType = 'payment_reminder';
        confidence = 0.8;
      }

      // Extract dates from filename using multiple patterns
      const datePatterns = [
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g,  // MM/DD/YYYY or DD/MM/YYYY
        /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,  // YYYY/MM/DD
        /(\d{8})/g,                                 // YYYYMMDD
        /(\d{4})(\d{2})(\d{2})/g,                  // YYYYMMDD without separators
        /(\d{2})(\d{2})(\d{4})/g                   // MMDDYYYY or DDMMYYYY
      ];

      for (const pattern of datePatterns) {
        const matches = Array.from(filename.matchAll(pattern));
        if (matches.length > 0) {
          confidence = Math.min(confidence + 0.1, 0.9);
          
          // Try to parse the first date as issue date
          const firstMatch = matches[0];
          try {
            let dateStr = '';
            if (firstMatch[0].length === 8 && firstMatch[0].match(/^\d{8}$/)) {
              // YYYYMMDD format
              dateStr = `${firstMatch[0].substring(0,4)}-${firstMatch[0].substring(4,6)}-${firstMatch[0].substring(6,8)}`;
            } else if (firstMatch.length === 4) {
              // Groups captured (YYYY)(MM)(DD)
              dateStr = `${firstMatch[1]}-${firstMatch[2].padStart(2,'0')}-${firstMatch[3].padStart(2,'0')}`;
            } else {
              // Other formats - try to construct date
              dateStr = `${firstMatch[3]}-${firstMatch[1].padStart(2,'0')}-${firstMatch[2].padStart(2,'0')}`;
            }
            
            const testDate = new Date(dateStr);
            if (!isNaN(testDate.getTime()) && testDate.getFullYear() > 2000 && testDate.getFullYear() < 2030) {
              suggestedIssueDate = dateStr;
              
              // For certain document types, calculate typical expiry dates
              if (suggestedType === 'company_license' || suggestedType === 'government_certificate') {
                const expiryDate = new Date(testDate);
                expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Add 1 year
                suggestedExpiryDate = expiryDate.toISOString().split('T')[0];
              } else if (suggestedType === 'utility_bill') {
                const expiryDate = new Date(testDate);
                expiryDate.setMonth(expiryDate.getMonth() + 1); // Add 1 month
                suggestedExpiryDate = expiryDate.toISOString().split('T')[0];
              }
            }
          } catch (dateError) {
            console.log("Date parsing failed for:", firstMatch[0]);
          }
          break;
        }
      }
    }

    return {
      title: suggestedTitle,
      documentType: suggestedType,
      customType: suggestedType === 'other' ? "PDF Document" : undefined,
      issueDate: suggestedIssueDate,
      expiryDate: suggestedExpiryDate,
      confidence: confidence,
      extractedText: `Intelligent filename analysis completed. Document type detected with ${Math.round(confidence * 100)}% confidence based on filename patterns and content indicators.`,
    };

  } catch (error) {
    console.error("Error analyzing PDF:", error);
    throw new Error(`PDF analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    const fallbackResult = {
      title: filename ? filename.replace(/\.[^/.]+$/, "") : "Analysis Failed",
      documentType: 'other' as const,
      confidence: 0,
      extractedText: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
    
    console.log("Returning fallback result:", fallbackResult);
    return fallbackResult;
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
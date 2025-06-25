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

// Analyze PDF by extracting information from filename and providing smart suggestions
export async function analyzePDF(base64PDF: string, filename?: string): Promise<DocumentAnalysisResult> {
  try {
    // Smart analysis based on filename patterns
    let suggestedTitle = "PDF Document";
    let suggestedType: DocumentAnalysisResult['documentType'] = 'other';
    let suggestedCustomType = undefined;
    let confidence = 0.3;

    if (filename) {
      const name = filename.toLowerCase();
      
      // Extract potential title from filename
      suggestedTitle = filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      
      // Detect document type from filename patterns
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

      // Extract potential dates from filename
      const dateMatches = filename.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})|(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})|(\d{8})|(\d{4})(\d{2})(\d{2})/);
      if (dateMatches) {
        confidence = Math.min(confidence + 0.1, 0.8);
      }
    }

    return {
      title: suggestedTitle,
      documentType: suggestedType,
      customType: suggestedType === 'other' ? "PDF Document" : undefined,
      confidence: confidence,
      extractedText: `PDF filename analysis: ${filename || 'No filename provided'}. Suggestions based on filename patterns. Please verify and adjust details manually.`,
    };
  } catch (error) {
    console.error("Error analyzing PDF:", error);
    return {
      title: "PDF Analysis Failed",
      documentType: 'other',
      confidence: 0,
      extractedText: "PDF analysis failed. Please enter document details manually.",
    };
  }
}

// Main function to analyze any document type
export async function analyzeDocumentFile(base64Data: string, mimeType: string, filename?: string): Promise<DocumentAnalysisResult> {
  if (mimeType === 'application/pdf') {
    return analyzePDF(base64Data, filename);
  } else if (mimeType.startsWith('image/')) {
    return analyzeDocument(base64Data, mimeType);
  } else {
    return {
      title: "Unsupported File Type",
      documentType: 'other',
      confidence: 0,
      extractedText: "File type not supported for AI analysis",
    };
  }
}
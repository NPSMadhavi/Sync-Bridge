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

// Analyze PDF by converting first page to image
export async function analyzePDF(base64PDF: string): Promise<DocumentAnalysisResult> {
  try {
    // For now, we'll return a fallback for PDFs since we need additional libraries for PDF to image conversion
    // In a production environment, you would use libraries like pdf-poppler or pdf2pic
    return {
      title: "PDF Document",
      documentType: 'other',
      customType: "PDF Document (Analysis not available)",
      confidence: 0.3,
      extractedText: "PDF analysis requires additional processing. Please manually enter document details.",
    };
  } catch (error) {
    console.error("Error analyzing PDF:", error);
    return {
      title: "PDF Analysis Failed",
      documentType: 'other',
      confidence: 0,
    };
  }
}

// Main function to analyze any document type
export async function analyzeDocumentFile(base64Data: string, mimeType: string): Promise<DocumentAnalysisResult> {
  if (mimeType === 'application/pdf') {
    return analyzePDF(base64Data);
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
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCompanyDocumentSchema, companyDocumentTypeEnum, CompanyDocument } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, isAfter } from "date-fns";
import { Loader2, FileText, Upload, Plus, X, Clock } from "lucide-react";
import { SimpleDatePicker } from "@/components/ui/simple-date-picker";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Badge,
} from "@/components/ui/badge";

// Reminder schema for the form
const reminderSchema = z.object({
  daysBefore: z.number().min(1, "Must be at least 1 day").max(365, "Cannot exceed 365 days"),
});

// Extended document form schema with reminders and custom validation
const companyDocumentFormSchema = insertCompanyDocumentSchema.extend({
  title: z.string().min(2, "Title must be at least 2 characters"),
  documentType: z.enum(companyDocumentTypeEnum.enumValues),
  customType: z.string().optional(),
  issueDate: z.date().optional().nullable(),
  expiryDate: z.date().optional().nullable(),
  notes: z.string().optional(),
  fileData: z.string().min(1, "Document file is required"),
  reminders: z.array(reminderSchema).max(5, "Maximum 5 reminders allowed").optional(),
}).refine((data) => {
  // Require custom type if "other" is selected
  if (data.documentType === "other" && (!data.customType || data.customType.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Custom document type is required when 'Other' is selected",
  path: ["customType"],
}).refine((data) => {
  // Validate expiry date is after issue date
  if (data.issueDate && data.expiryDate) {
    return isAfter(data.expiryDate, data.issueDate);
  }
  return true;
}, {
  message: "Expiry date must be after issue date",
  path: ["expiryDate"],
});

type CompanyDocumentFormData = z.infer<typeof companyDocumentFormSchema>;

interface CompanyDocumentFormProps {
  document?: CompanyDocument;
  isOpen: boolean;
  onClose: () => void;
}

export default function CompanyDocumentForm({ document, isOpen, onClose }: CompanyDocumentFormProps) {
  const { toast } = useToast();
  const [isEditMode] = useState(!!document);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  
  const form = useForm<CompanyDocumentFormData>({
    resolver: zodResolver(companyDocumentFormSchema),
    defaultValues: {
      title: document?.title || "",
      documentType: document?.documentType || "company_license",
      customType: document?.customType || "",
      issueDate: document?.issueDate || null,
      expiryDate: document?.expiryDate || null,
      notes: document?.notes || "",
      fileData: "",
      reminders: [],
    },
  });

  const { fields: reminderFields, append: addReminder, remove: removeReminder } = useFieldArray({
    control: form.control,
    name: "reminders",
  });

  // Watch document type to show/hide custom type field
  const watchedDocumentType = form.watch("documentType");

  // AI Analysis function
  const analyzeDocumentWithAI = async (base64Data: string) => {
    try {
      setIsAnalyzing(true);
      const response = await apiRequest("POST", "/api/company-documents/analyze", {
        fileData: base64Data,
        filename: file?.name
      });
      const result = await response.json();
      setAnalysisResult(result);
      
      // Auto-fill form with AI results
      console.log("Processing analysis result:", result);
      
      if (result.title && result.title.trim() && result.title !== "PDF Document") {
        console.log("Setting title:", result.title);
        form.setValue("title", result.title, { shouldValidate: true, shouldDirty: true });
      }
      
      if (result.documentType) {
        console.log("Setting document type:", result.documentType);
        form.setValue("documentType", result.documentType, { shouldValidate: true, shouldDirty: true });
      }
      
      if (result.customType && result.documentType === "other") {
        console.log("Setting custom type:", result.customType);
        form.setValue("customType", result.customType, { shouldValidate: true, shouldDirty: true });
      }
      
      if (result.issueDate) {
        try {
          const issueDate = new Date(result.issueDate);
          if (!isNaN(issueDate.getTime())) {
            console.log("Setting issue date:", issueDate);
            form.setValue("issueDate", issueDate, { shouldValidate: true, shouldDirty: true });
          }
        } catch (e) {
          console.error("Invalid issue date:", result.issueDate, e);
        }
      }
      
      if (result.expiryDate) {
        try {
          const expiryDate = new Date(result.expiryDate);
          if (!isNaN(expiryDate.getTime())) {
            console.log("Setting expiry date:", expiryDate);
            form.setValue("expiryDate", expiryDate, { shouldValidate: true, shouldDirty: true });
          }
        } catch (e) {
          console.error("Invalid expiry date:", result.expiryDate, e);
        }
      }
      
      if (result.extractedText) {
        const currentNotes = form.getValues("notes") || "";
        // Only add meaningful analysis info, skip the generic confidence message
        if (result.confidence >= 0.8 && (result.issueDate || result.expiryDate)) {
          const analysisInfo = `Document analyzed: ${result.documentType === 'purchase_invoice' ? 'Invoice' : result.documentType}${result.issueDate ? `, Issue: ${result.issueDate}` : ''}${result.expiryDate ? `, Due: ${result.expiryDate}` : ''}`;
          if (!currentNotes.includes("Document analyzed:")) {
            console.log("Setting enhanced notes");
            form.setValue("notes", currentNotes + (currentNotes ? "\n\n" : "") + analysisInfo, { shouldValidate: true, shouldDirty: true });
          }
        }
      }

      // Force form to re-render and validate all fields
      setTimeout(() => {
        form.trigger();
      }, 100);
      
      const fieldsPopulated = (result.title && result.title !== "PDF Document") || result.issueDate || result.expiryDate;
      
      toast({
        title: "Analysis Complete",
        description: fieldsPopulated 
          ? `Document analyzed with ${Math.round(result.confidence * 100)}% confidence. Form fields populated.`
          : `Document type detected with ${Math.round(result.confidence * 100)}% confidence. Please verify details.`,
      });
    } catch (error) {
      console.error("AI analysis failed:", error);
      
      let errorMessage = "Unable to analyze document with AI. Please fill form manually.";
      if (error instanceof Error) {
        if (error.message.includes('Unexpected token')) {
          errorMessage = "Server error during analysis. Please try again or fill form manually.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "AI Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // File upload handler
  const handleFileUpload = async (selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File too large",
        description: "File size must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    if (!['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(selectedFile.type)) {
      toast({
        title: "Invalid file type",
        description: "Only PDF, JPG, and PNG files are allowed",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      form.setValue("fileData", base64String);
      
      // Trigger AI analysis for both images and PDFs
      if (selectedFile.type.startsWith('image/') || selectedFile.type === 'application/pdf') {
        await analyzeDocumentWithAI(base64String);
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Create document mutation
  const createMutation = useMutation({
    mutationFn: async (data: CompanyDocumentFormData) => {
      const response = await apiRequest("POST", "/api/company-documents", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document uploaded successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/company-documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      form.reset();
      setFile(null);
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  // Update document mutation
  const updateMutation = useMutation({
    mutationFn: async (data: CompanyDocumentFormData) => {
      const response = await apiRequest("PUT", `/api/company-documents/${document!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/company-documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update document",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: CompanyDocumentFormData) => {
    if (document) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  // Document type display names
  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      company_license: "Company License",
      government_certificate: "Government Certificate",
      purchase_invoice: "Purchase Invoice",
      rental_agreement: "Rental Agreement",
      utility_bill: "Utility Bill (Telco, PUB)",
      payment_reminder: "Payment Reminder",
      legal_agreement: "Legal Agreement",
      other: "Other",
    };
    return labels[type] || type;
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right"
        className="w-full max-w-[1200px] p-0 overflow-hidden sm:max-w-[900px] md:max-w-[1000px] lg:max-w-[1200px]"
        onKeyDown={handleKeyDown}
      >
        <Form {...form}>
          <div className="h-full flex flex-col">
            {/* Header */}
            <SheetHeader className="flex-shrink-0 px-8 py-4 border-b bg-background">
              <SheetTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-primary" />
                {isEditMode ? "Edit Company Document" : "Upload Company Document"}
              </SheetTitle>
            </SheetHeader>

            {/* Form Content - Scrollable Area */}
            <div className="flex-1 overflow-y-auto px-8 py-6 pb-24">
              {/* Responsive grid layout container */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl mx-auto">
                
                {/* Left Column */}
                <div className="space-y-6">
                  
                  {/* Document Information Section */}
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="h-4 w-4" />
                        Document Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">

                      {/* Document Title */}
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Title*</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Business License 2024, Office Rental Agreement"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Descriptive name for the document
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Document Type */}
                      <FormField
                        control={form.control}
                        name="documentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Type*</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select document type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {companyDocumentTypeEnum.enumValues.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {getDocumentTypeLabel(type)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription className="text-xs">
                              Category of the document
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Custom Document Type (conditional) */}
                      {watchedDocumentType === "other" && (
                        <FormField
                          control={form.control}
                          name="customType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Enter Custom Document Type*</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Insurance Policy, Warranty Document"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Specify the custom document type
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Issue Date */}
                      <FormField
                        control={form.control}
                        name="issueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                              <SimpleDatePicker
                                date={field.value}
                                setDate={field.onChange}
                                placeholder="Select issue date"
                                max={new Date().toISOString().split('T')[0]}
                                min="1900-01-01"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              When was this document issued (optional)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Expiry Date */}
                      <FormField
                        control={form.control}
                        name="expiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                              <SimpleDatePicker
                                date={field.value}
                                setDate={field.onChange}
                                placeholder="Select expiry date"
                                min="1900-01-01"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              When does this document expire (optional)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Notes */}
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Additional details or remarks about this document..."
                                className="min-h-[80px]"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Optional notes or additional information
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                  
                </div>

                {/* Right Column */}
                <div className="space-y-6">

                  {/* File Upload Section */}
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Upload className="h-4 w-4" />
                        Document File
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="fileData"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Upload Document*</FormLabel>
                            <FormControl>
                              <div
                                className={cn(
                                  "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                                  dragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400",
                                  file && "border-green-500 bg-green-50"
                                )}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                              >
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) => {
                                    const selectedFile = e.target.files?.[0];
                                    if (selectedFile) handleFileUpload(selectedFile);
                                  }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="space-y-2">
                                  {isAnalyzing ? (
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                  ) : (
                                    <Upload className={cn(
                                      "mx-auto h-8 w-8",
                                      file ? "text-green-600" : "text-gray-400"
                                    )} />
                                  )}
                                  
                                  {isAnalyzing ? (
                                    <div>
                                      <p className="text-sm font-medium text-blue-700">
                                        AI is analyzing your document...
                                      </p>
                                      <p className="text-xs text-blue-600">
                                        {file?.type === 'application/pdf' 
                                          ? 'Converting PDF and extracting details...' 
                                          : 'Extracting document details automatically'
                                        }
                                      </p>
                                    </div>
                                  ) : file ? (
                                    <div>
                                      <p className="text-sm font-medium text-green-700">
                                        File selected: {file.name}
                                      </p>
                                      <p className="text-xs text-green-600">
                                        {(file.size / 1024 / 1024).toFixed(1)} MB
                                      </p>
                                      {analysisResult && (
                                        <div className="mt-2 p-2 bg-blue-50 rounded-md">
                                          <p className="text-xs text-blue-700">
                                            AI Analysis: {Math.round(analysisResult.confidence * 100)}% confidence
                                          </p>
                                          {analysisResult.confidence > 0.7 && (
                                            <p className="text-xs text-green-700">
                                              Form auto-filled with detected information
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div>
                                      <p className="text-sm font-medium text-gray-700">
                                        Drop your file here or click to browse
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        PDF, JPG, PNG up to 10MB
                                      </p>
                                      <p className="text-xs text-blue-600 mt-1">
                                        AI will analyze images and convert PDFs for full analysis
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Reminder System Section */}
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Clock className="h-4 w-4" />
                        Expiry Reminders
                        <div className="ml-auto flex gap-2">
                          {analysisResult && analysisResult.expiryDate && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Add smart reminders based on document type
                                if (analysisResult.documentType === 'company_license' || analysisResult.documentType === 'government_certificate') {
                                  addReminder({ daysBefore: 30 });
                                  addReminder({ daysBefore: 7 });
                                } else if (analysisResult.documentType === 'utility_bill' || analysisResult.documentType === 'payment_reminder') {
                                  addReminder({ daysBefore: 3 });
                                } else {
                                  addReminder({ daysBefore: 14 });
                                }
                              }}
                              disabled={reminderFields.length >= 5}
                              className="text-xs"
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              Smart Reminders
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addReminder({ daysBefore: 30 })}
                            disabled={reminderFields.length >= 5}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Reminder
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {reminderFields.length === 0 ? (
                        <div className="text-center">
                          <p className="text-muted-foreground text-sm">
                            No reminders set. Click "Add Reminder" to get notified before document expiry.
                          </p>
                          {analysisResult && analysisResult.expiryDate && (
                            <p className="text-xs text-blue-600 mt-2">
                              AI detected expiry date: {new Date(analysisResult.expiryDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {reminderFields.map((reminder, index) => (
                            <div key={reminder.id} className="flex items-center gap-3 p-3 border rounded-lg">
                              <div className="flex-1">
                                <FormField
                                  control={form.control}
                                  name={`reminders.${index}.daysBefore`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm">Days before expiry</FormLabel>
                                      <Select
                                        onValueChange={(value) => field.onChange(parseInt(value))}
                                        defaultValue={field.value?.toString()}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select days" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="1">1 day</SelectItem>
                                          <SelectItem value="3">3 days</SelectItem>
                                          <SelectItem value="7">1 week</SelectItem>
                                          <SelectItem value="14">2 weeks</SelectItem>
                                          <SelectItem value="30">1 month</SelectItem>
                                          <SelectItem value="60">2 months</SelectItem>
                                          <SelectItem value="90">3 months</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeReminder(index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {reminderFields.map((reminder, index) => {
                              const days = form.watch(`reminders.${index}.daysBefore`);
                              return (
                                <Badge key={reminder.id} variant="secondary" className="text-xs">
                                  Remind {days} day{days !== 1 ? 's' : ''} before
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                </div>
              </div>
            </div>

            {/* Sticky Footer with Actions - Outside scrollable area */}
            <div className="flex-shrink-0 bg-background border-t px-8 py-4">
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="flex flex-col sm:flex-row justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto min-w-[120px]"
                    onClick={() => {
                      form.reset();
                      setFile(null);
                      setAnalysisResult(null);
                      onClose();
                    }}
                    disabled={createMutation.isPending || updateMutation.isPending || isAnalyzing}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending || isAnalyzing}
                    className="w-full sm:w-auto min-w-[140px]"
                  >
                    {(createMutation.isPending || updateMutation.isPending || isAnalyzing) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isAnalyzing ? "Analyzing..." : isEditMode ? "Update Document" : "Upload Document"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
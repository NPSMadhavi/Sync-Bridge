import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmployeeDocumentSchema, documentTypeEnum } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload } from "lucide-react";
import { Employee } from "@shared/schema";

type DocumentFormData = z.infer<typeof formSchema>;

// Extend the schema to add validation and handle file upload
const formSchema = insertEmployeeDocumentSchema
  .omit({ filePath: true })
  .extend({
    fileData: z.string().optional(),
    employeeId: z.number().or(z.string().transform(value => parseInt(value))),
  });

interface DocumentFormProps {
  documentId?: number;
  employeeId?: number;
  onSuccess?: () => void;
}

export default function DocumentForm({ documentId, employeeId, onSuccess }: DocumentFormProps) {
  const { toast } = useToast();
  const [isEditMode] = useState(!!documentId);
  const [file, setFile] = useState<File | null>(null);
  
  // Fetch employees for dropdown
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });
  
  // Fetch document data if in edit mode
  const { data: documentData, isLoading: isLoadingDocument } = useQuery({
    queryKey: ["/api/documents", documentId],
    enabled: !!documentId,
  });
  
  const form = useForm<DocumentFormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      employeeId: employeeId || 0,
      documentType: "passport",
      issueDate: null,
      expiryDate: null,
      notes: "",
    },
  });
  
  // Helper function to safely convert date to ISO string
  const safeDateToISO = (dateValue: any): string | null => {
    if (!dateValue) return null;
    try {
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
      return null;
    }
  };

  // Update form when document data is loaded
  useEffect(() => {
    if (documentData) {
      form.reset({
        ...documentData,
        employeeId: documentData.employeeId || 0,
        issueDate: safeDateToISO(documentData.issueDate),
        expiryDate: safeDateToISO(documentData.expiryDate),
      });
    } else if (employeeId) {
      form.setValue("employeeId", employeeId);
    }
  }, [documentData, employeeId, form]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    
    if (selectedFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        form.setValue("fileData", base64String);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      form.setValue("fileData", undefined);
    }
  };
  
  const uploadDocumentMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      const res = await apiRequest("POST", "/api/documents", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Document uploaded",
        description: "The document has been uploaded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      if (employeeId) {
        queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "documents"] });
      }
      form.reset();
      setFile(null);
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload document",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: DocumentFormData) => {
    if (!isEditMode && !data.fileData) {
      toast({
        title: "Missing file",
        description: "Please upload a document file.",
        variant: "destructive",
      });
      return;
    }
    uploadDocumentMutation.mutate(data);
  };
  
  if (isEditMode && isLoadingDocument) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  defaultValue={field.value.toString()}
                  value={field.value.toString()}
                  disabled={!!employeeId}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.name} ({employee.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Employee this document belongs to
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="documentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Document Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(documentTypeEnum.enumValues).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Type of document being uploaded
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="issueDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Issue Date</FormLabel>
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormDescription>
                  Date when the document was issued
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="expiryDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Expiry Date</FormLabel>
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormDescription>
                  Date when the document expires
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="col-span-2">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional information about this document"
                      className="resize-none"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="col-span-2">
            <FormField
              control={form.control}
              name="fileData"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document File</FormLabel>
                  <FormControl>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors cursor-pointer">
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleFileChange}
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      <div className="space-y-1 text-center pointer-events-none">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600">
                          <span className="font-medium text-primary-600">Upload a file</span>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          PDF, JPG, JPEG, PNG up to 10MB
                        </p>
                      </div>
                    </div>
                  </FormControl>
                  {file && (
                    <p className="mt-2 text-sm text-green-600">
                      File selected: {file.name}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <pre style={{fontSize:12, color:'#888', background:'#f8f8f8', padding:8, borderRadius:4, marginBottom:8}}>{JSON.stringify(form.formState, null, 2)}</pre>
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onSuccess && onSuccess()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={uploadDocumentMutation.isPending || !form.formState.isValid || (!file && !isEditMode)}
          >
            {uploadDocumentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload Document"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

import { useState } from "react";
import Dashboard from "@/components/layout/Dashboard";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CompanyDocument } from "@shared/schema";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CompanyDocumentForm from "@/components/forms/CompanyDocumentForm";
import { TableRowActions } from "@/components/ui/table-row-actions";
import {
  Plus,
  Loader2,
  Trash2,
  AlertCircle,
  FileText,
  Download,
  Eye,
  FileUp
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function DocumentsPage() {
  const { toast } = useToast();
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [viewingDocument, setViewingDocument] = useState<CompanyDocument | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  
  // Fetch company documents
  const { data: documents = [], isLoading } = useQuery<CompanyDocument[]>({
    queryKey: ["/api/company-documents"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  
  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/company-documents/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Document deleted",
        description: "The document has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/company-documents"] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete document",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleViewDocument = (doc: CompanyDocument) => {
    setViewingDocument(doc);
    setIsViewDialogOpen(true);
  };

  const handleDownloadDocument = (doc: CompanyDocument) => {
    if (!doc.filePath) return;
    // filePath is stored as "uploads/company-documents/filename.pdf" — serve via /uploads/...
    const url = "/" + doc.filePath.replace(/\\/g, "/");
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.title || "document";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  
  const handleDeleteDocument = (id: number) => {
    setSelectedDocumentId(id);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (selectedDocumentId) {
      deleteDocumentMutation.mutate(selectedDocumentId);
    }
  };
  
  // Filter documents based on active tab
  const filteredDocuments = documents.filter(doc => {
    if (activeTab === 'all') return true;
    if (activeTab === 'expiring') {
      // Documents expiring in the next 30 days
      if (!doc.expiryDate) return false;
      const expiryDate = new Date(doc.expiryDate);
      const today = new Date();
      
      // Reset time to start of day for accurate comparison
      expiryDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      thirtyDaysFromNow.setHours(0, 0, 0, 0);
      
      return expiryDate > today && expiryDate <= thirtyDaysFromNow;
    }
    if (activeTab === 'expired') {
      // Already expired documents
      if (!doc.expiryDate) return false;
      const expiryDate = new Date(doc.expiryDate);
      const today = new Date();
      
      // Reset time to start of day for accurate comparison
      expiryDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      return expiryDate <= today;
    }
    return true;
  });
  
  // Helper function for document type formatting
  const formatDocumentType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };
  
  // Helper function for expiry status
  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return { label: 'No Expiry', variant: 'secondary' as const };
    
    const expiry = new Date(expiryDate);
    const today = new Date();
    
    // Reset time to start of day for accurate comparison
    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (expiry < today) {
      return { label: '⚠️ EXPIRED', variant: 'destructive' as const };
    }
    
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 30) {
      return { label: `⚠️ EXPIRES IN ${daysUntilExpiry} DAYS`, variant: 'warning' as const };
    }
    
    return { label: 'Valid', variant: 'default' as const };
  };
  
  return (
  <Dashboard
    title={<span className="text-[32px] font-bold">Documents</span>}
    description="Manage your organization's assets."
  >
      <div className="mb-6">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="all">All Documents</TabsTrigger>
              <TabsTrigger value="expiring">Expiring Soon</TabsTrigger>
              <TabsTrigger value="expired">Expired</TabsTrigger>
            </TabsList>
            <Button onClick={() => setIsFormDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Upload Company Document
            </Button>
          </div>
          
          <TabsContent value="all" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Company Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {renderDocumentTable(filteredDocuments, isLoading, handleViewDocument, handleDownloadDocument, handleDeleteDocument)}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="expiring" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Documents Expiring Soon</CardTitle>
              </CardHeader>
              <CardContent>
                {renderDocumentTable(filteredDocuments, isLoading, handleViewDocument, handleDownloadDocument, handleDeleteDocument)}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="expired" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Expired Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {renderDocumentTable(filteredDocuments, isLoading, handleViewDocument, handleDownloadDocument, handleDeleteDocument)}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* View Document Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Document Details
            </DialogTitle>
          </DialogHeader>
          {viewingDocument && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-medium">Title</p>
                  <p className="font-semibold">{viewingDocument.title}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Document Type</p>
                  <p className="font-semibold">{formatDocumentType(viewingDocument.documentType)}</p>
                </div>
                {viewingDocument.customType && (
                  <div>
                    <p className="text-muted-foreground font-medium">Custom Type</p>
                    <p className="font-semibold">{viewingDocument.customType}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground font-medium">Issue Date</p>
                  <p className="font-semibold">
                    {viewingDocument.issueDate ? new Date(viewingDocument.issueDate).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Expiry Date</p>
                  <p className="font-semibold">
                    {viewingDocument.expiryDate ? new Date(viewingDocument.expiryDate).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Status</p>
                  <Badge variant={getExpiryStatus(viewingDocument.expiryDate).variant}>
                    {getExpiryStatus(viewingDocument.expiryDate).label}
                  </Badge>
                </div>
              </div>
              {viewingDocument.notes && (
                <div>
                  <p className="text-muted-foreground font-medium text-sm">Notes</p>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">{viewingDocument.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Company Document Form */}
      <CompanyDocumentForm
        document={selectedDocumentId ? documents.find(d => d.id === selectedDocumentId) : undefined}
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the document file and its metadata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteDocumentMutation.isPending}
            >
              {deleteDocumentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dashboard>
  );
  
  function renderDocumentTable(
    documents: any[],
    isLoading: boolean,
    onView: (doc: CompanyDocument) => void,
    onDownload: (doc: CompanyDocument) => void,
    onDelete: (id: number) => void
  ) {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      );
    }
    
    if (documents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <FileUp className="h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-lg font-medium text-gray-800 mb-1">No documents found</h3>
          <p className="text-sm text-gray-500 mb-4">
            {activeTab === 'expiring' 
              ? "No documents are expiring soon."
              : activeTab === 'expired'
                ? "No documents have expired yet."
                : "Upload documents for employees."
            }
          </p>
          <Button onClick={() => setIsFormDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Upload Document
          </Button>
        </div>
      );
    }
    
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Expiry Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => {
              const expiryStatus = getExpiryStatus(doc.expiryDate);
              
              return (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <FileText className="mr-2 h-4 w-4 text-primary-500" />
                      <span>{formatDocumentType(doc.documentType)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{doc.title}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-600">{doc.uploadedBy || "—"}</div>
                  </TableCell>
                  <TableCell>
                    {doc.issueDate ? new Date(doc.issueDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={expiryStatus.variant}>
                      {expiryStatus.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TableRowActions
                      actions={[
                        {
                          icon: Eye,
                          label: "View",
                          variant: "view",
                          onClick: () => onView(doc),
                        },
                        {
                          icon: Download,
                          label: "Download",
                          variant: "default",
                          onClick: () => onDownload(doc),
                        },
                        {
                          icon: Trash2,
                          label: "Delete",
                          variant: "delete",
                          onClick: () => onDelete(doc.id),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }
}

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
import { EmployeeDocument } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CompanyDocumentForm from "@/components/forms/CompanyDocumentForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Loader2,
  MoreHorizontal,
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
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  
  // Fetch company documents
  const { data: documents = [], isLoading } = useQuery<CompanyDocument[]>({
    queryKey: ["/api/company-documents"],
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
  
  const handleViewDocument = (filePath: string) => {
    window.open(filePath, '_blank');
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
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      return expiryDate > today && expiryDate <= thirtyDaysFromNow;
    }
    if (activeTab === 'expired') {
      // Already expired documents
      if (!doc.expiryDate) return false;
      return new Date(doc.expiryDate) <= new Date();
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
    
    if (expiry < today) {
      return { label: 'Expired', variant: 'destructive' as const };
    }
    
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 30) {
      return { label: `Expires in ${daysUntilExpiry} days`, variant: 'warning' as const };
    }
    
    return { label: 'Valid', variant: 'success' as const };
  };
  
  return (
    <Dashboard title="Documents" description="Manage company documents with AI-powered analysis.">
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
                {renderDocumentTable(filteredDocuments, isLoading, handleViewDocument, handleDeleteDocument)}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="expiring" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Documents Expiring Soon</CardTitle>
              </CardHeader>
              <CardContent>
                {renderDocumentTable(filteredDocuments, isLoading, handleViewDocument, handleDeleteDocument)}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="expired" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Expired Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {renderDocumentTable(filteredDocuments, isLoading, handleViewDocument, handleDeleteDocument)}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
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
    onView: (path: string) => void,
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
              <TableHead>Employee</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Expiry Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                    <div>
                      <div className="font-medium">{doc.employeeName}</div>
                      <div className="text-sm text-gray-500">{doc.employeeDepartment}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {doc.issueDate ? new Date(doc.issueDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={expiryStatus.variant}>
                      {expiryStatus.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {doc.notes || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(doc.filePath)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onView(doc.filePath)}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => onDelete(doc.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

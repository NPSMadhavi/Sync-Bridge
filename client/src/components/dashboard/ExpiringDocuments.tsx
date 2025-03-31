import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  IdCard, 
  FileText, 
  FileCog,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExpiringDocument {
  id: number;
  type: string;
  name: string;
  daysUntilExpiry: number;
  employeeId?: number;
  assetId?: number;
}

interface ExpiringDocumentsProps {
  documents: ExpiringDocument[];
  className?: string;
}

export default function ExpiringDocuments({ documents, className }: ExpiringDocumentsProps) {
  // Helper function to get the right icon for document type
  const getDocumentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'passport':
        return <IdCard />;
      case 'warranty':
      case 'purchase_order':
        return <FileCog />;
      default:
        return <FileText />;
    }
  };
  
  // Helper function to get the right color based on days until expiry
  const getExpiryColorClass = (days: number) => {
    if (days <= 15) return {
      bg: "bg-red-50",
      border: "border-red-100",
      icon: "bg-red-100 text-red-500"
    };
    if (days <= 45) return {
      bg: "bg-amber-50",
      border: "border-amber-100",
      icon: "bg-amber-100 text-amber-500"
    };
    return {
      bg: "bg-orange-50",
      border: "border-orange-100",
      icon: "bg-orange-100 text-orange-500"
    };
  };
  
  return (
    <div className={cn("bg-white rounded-lg shadow-sm border border-gray-200", className)}>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Expiring Documents</h3>
        <div className="flex space-x-2">
          <span className="text-sm text-gray-500">Last 90 days</span>
        </div>
      </div>
      <div className="p-5">
        {documents.length > 0 ? (
          <div className="space-y-4">
            {documents.map((doc) => {
              const { bg, border, icon } = getExpiryColorClass(doc.daysUntilExpiry);
              
              return (
                <div 
                  key={doc.id} 
                  className={cn("flex items-center p-3 rounded-md", bg, border)}
                >
                  <div className="flex-shrink-0 mr-3">
                    <span className={cn("inline-block h-8 w-8 rounded-full flex items-center justify-center", icon)}>
                      {getDocumentIcon(doc.type)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {doc.daysUntilExpiry <= 0 
                        ? "Expired" 
                        : `Expires in ${doc.daysUntilExpiry} days`}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs px-3 py-1 h-auto"
                    >
                      View
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-800 mb-1">No expiring documents</h3>
            <p className="text-sm text-gray-500">All your documents are up to date.</p>
          </div>
        )}
        
        {documents.length > 0 && (
          <div className="mt-4 text-center">
            <Link href="/documents">
              <Button variant="link" className="text-sm font-medium">
                View all expiring documents
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

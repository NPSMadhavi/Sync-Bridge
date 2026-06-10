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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AuditLog } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  FileText,
  Laptop,
  User,
  UserPlus,
  Settings,
  Store,
  AlertTriangle,
  Loader2,
  ClipboardList
} from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entity, setEntity] = useState<string | null>(null);
  const { user, tenantId } = useAuth();
  
  // Fetch audit logs
  const { data: auditLogs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
    queryFn: () => apiRequest("GET", "/api/audit-logs").then((res: Response) => res.json()),
    enabled: !!user, // Allow all authenticated users
    staleTime: 0, // Consider data stale immediately
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });
  
  // Filter logs based on search query and entity
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = searchQuery 
      ? log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.entity.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    
    const matchesEntity = entity
      ? log.entity === entity
      : true;
    
    return matchesSearch && matchesEntity;
  });
  
  // Pagination logic
  const logsPerPage = 10;
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * logsPerPage,
    currentPage * logsPerPage
  );
  
  // Get unique entities for filtering
  const uniqueEntities = Array.from(new Set(auditLogs.map(log => log.entity)));
  
  // Helper function to get the right icon for entity type
  const getEntityIcon = (entity: string) => {
    switch (entity.toLowerCase()) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'employee':
        return <UserPlus className="h-4 w-4" />;
      case 'asset':
        return <Laptop className="h-4 w-4" />;
      case 'asset_assignment':
        return <Laptop className="h-4 w-4" />;
      case 'document':
      case 'employee_document':
        return <FileText className="h-4 w-4" />;
      case 'vendor':
        return <Store className="h-4 w-4" />;
      case 'maintenance_record':
        return <Settings className="h-4 w-4" />;
      default:
        return <ClipboardList className="h-4 w-4" />;
    }
  };
  
  // Helper function to format action
  const formatAction = (action: string) => {
    return action.charAt(0).toUpperCase() + action.slice(1);
  };
  
  return (
    <Dashboard title="Audit Logs" description="View system activity and user actions.">
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="relative w-full md:w-1/3">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={entity === null ? "default" : "outline"}
              size="sm"
              onClick={() => setEntity(null)}
            >
              All
            </Button>
            
            {uniqueEntities.map((entityName) => (
              <Button
                key={entityName}
                variant={entity === entityName ? "default" : "outline"}
                size="sm"
                onClick={() => setEntity(entityName)}
              >
                {entityName.charAt(0).toUpperCase() + entityName.slice(1).replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>System Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
          ) : paginatedLogs.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Entity ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.timestamp), "MMM dd, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>{log.userId || "System"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            log.action === 'create' ? 'bg-green-100 text-green-800' :
                            log.action === 'update' ? 'bg-blue-100 text-blue-800' :
                            log.action === 'delete' ? 'bg-red-100 text-red-800' : 
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {formatAction(log.action)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <span className="inline-flex items-center justify-center h-8 w-8 rounded bg-gray-100 text-gray-500 mr-2">
                              {getEntityIcon(log.entity)}
                            </span>
                            <span className="capitalize">
                              {log.entity.replace('_', ' ')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{log.entityId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(5, totalPages) }).map((_, index) => {
                        const pageNumber = index + 1;
                        return (
                          <PaginationItem key={pageNumber}>
                            <PaginationLink
                              isActive={currentPage === pageNumber}
                              onClick={() => setCurrentPage(pageNumber)}
                            >
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      {totalPages > 5 && (
                        <>
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                          <PaginationItem>
                            <PaginationLink
                              isActive={currentPage === totalPages}
                              onClick={() => setCurrentPage(totalPages)}
                            >
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertTriangle className="h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-800 mb-1">No logs found</h3>
              <p className="text-sm text-gray-500">
                {searchQuery || entity
                  ? "Try adjusting your search or filter criteria."
                  : "System activity logs will appear here."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Dashboard>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import Dashboard from "@/components/layout/Dashboard";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TablePagination, paginateItems } from "@/components/ui/table-pagination";
import { TableRowActions } from "@/components/ui/table-row-actions";
import {
  documentExpiryStatus,
  expiryRecordDisplayTitle,
  expiryRecordDocumentNumberDisplay,
  expiryRecordEmployeeDisplayName,
  expiryRecordItemType,
  formatDisplayDate,
} from "@shared/document-reminder-utils";
import type { DocumentExpiryRecord } from "@shared/document-reminder-utils";
import { AlertCircle, ExternalLink, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type StatusTab = "expiring" | "expired";
type TypeFilter = "all" | "document" | "license";

function statusBadgeVariant(status: ReturnType<typeof documentExpiryStatus>) {
  return status === "Expired" ? "destructive" : "warning";
}

function getRecordViewHref(record: DocumentExpiryRecord): string | null {
  switch (record.reminderType) {
    case "license":
      return "/licenses";
    case "company_document":
      return "/documents";
    case "employee_passport":
    case "employee_visa":
    case "employee_nric":
    case "employee_document":
    case "dependent_passport":
    case "dependent_visa":
      return "/employees";
    default:
      return null;
  }
}

export default function ExpiringItemsPage() {
  const [, setLocation] = useLocation();
  const { user, tenantId } = useAuth();
  const { canView, canSeeOtherData } = usePermissions();
  const canAccess = canView("documents") || canView("licenses");

  const [activeTab, setActiveTab] = useState<StatusTab>("expiring");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "expiring" || tab === "expired") {
      setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeTab, typeFilter, searchTerm]);

  const canLoad =
    canSeeOtherData &&
    canAccess &&
    !!user &&
    (Boolean(tenantId) || user.role === "super_admin" || user.isSuperAdmin);

  const { data: expiringRecords = [], isLoading: expiringLoading } = useQuery<DocumentExpiryRecord[]>({
    queryKey: ["/api/document-reminders/expiring", "expiring", tenantId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/document-reminders/expiring?status=expiring");
      return res.json();
    },
    enabled: canLoad,
    staleTime: 0,
  });

  const { data: expiredRecords = [], isLoading: expiredLoading } = useQuery<DocumentExpiryRecord[]>({
    queryKey: ["/api/document-reminders/expiring", "expired", tenantId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/document-reminders/expiring?status=expired");
      return res.json();
    },
    enabled: canLoad,
    staleTime: 0,
  });

  const sourceRecords = activeTab === "expiring" ? expiringRecords : expiredRecords;
  const isLoading = activeTab === "expiring" ? expiringLoading : expiredLoading;

  const permissionFilteredRecords = useMemo(() => {
    return sourceRecords.filter((record) => {
      if (record.reminderType === "license") return canView("licenses");
      return canView("documents");
    });
  }, [sourceRecords, canView]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return permissionFilteredRecords.filter((record) => {
      if (typeFilter === "document" && record.reminderType === "license") return false;
      if (typeFilter === "license" && record.reminderType !== "license") return false;

      if (!query) return true;

      const haystack = [
        expiryRecordDocumentNumberDisplay(record),
        expiryRecordDisplayTitle(record),
        expiryRecordEmployeeDisplayName(record),
        record.documentType,
        expiryRecordItemType(record),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [permissionFilteredRecords, searchTerm, typeFilter]);

  const paginatedRecords = paginateItems(filteredRecords, page, PAGE_SIZE);

  if (!canAccess) {
    return (
      <Dashboard title="Expiring Documents">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              You do not have permission to view expiring documents or licenses.
            </p>
          </CardContent>
        </Card>
      </Dashboard>
    );
  }

  return (
    <Dashboard
      title="Expiring Documents"
      description="Documents and licenses expiring soon or already expired"
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusTab)}>
        <TabsList>
          <TabsTrigger value="expiring">Expiring Soon</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle>
                  {activeTab === "expiring"
                    ? "Expiring Documents & Licenses"
                    : "Expired Documents & Licenses"}
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <div className="relative flex-1 sm:min-w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by title, employee, or type..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  {/* <Select
                    value={typeFilter}
                    onValueChange={(v) => setTypeFilter(v as TypeFilter)}
                  >
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="document">Documents</SelectItem>
                      <SelectItem value="license">Licenses</SelectItem>
                    </SelectContent>
                  </Select> */}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {activeTab === "expiring"
                    ? "No documents or licenses are expiring soon."
                    : "No expired documents or licenses found."}
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document Type</TableHead>
                          <TableHead>Document Number</TableHead>
                          <TableHead>Employee</TableHead>
                          <TableHead>Expiry Date</TableHead>
                          <TableHead>
                            {activeTab === "expiring" ? "Days Remaining" : "Days Expired"}
                          </TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRecords.map((record) => {
                          const status = documentExpiryStatus(record);
                          const viewHref = getRecordViewHref(record);
                          return (
                            <TableRow key={record.recordKey}>
                              <TableCell>
                                <Badge variant="outline">{record.documentType}</Badge>
                              </TableCell>
                              <TableCell className="font-medium max-w-[220px]">
                                <span className="line-clamp-2">
                                  {expiryRecordDocumentNumberDisplay(record)}
                                </span>
                              </TableCell>
                              <TableCell>{expiryRecordEmployeeDisplayName(record)}</TableCell>
                              <TableCell>{formatDisplayDate(record.expiryDate)}</TableCell>
                              <TableCell>
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                                    activeTab === "expiring"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-red-50 text-red-700"
                                  )}
                                >
                                  {activeTab === "expiring"
                                    ? `${record.daysRemaining ?? 0} days`
                                    : `${record.daysExpired ?? 0} days`}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={statusBadgeVariant(status)}
                                  className={cn(
                                    status === "Expiring Soon" && "bg-amber-500 text-white"
                                  )}
                                >
                                  {status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {viewHref ? (
                                  <TableRowActions
                                    actions={[
                                      {
                                        icon: ExternalLink,
                                        label: "Open",
                                        variant: "view",
                                        onClick: () => {
                                          if (viewHref) setLocation(viewHref);
                                        },
                                      },
                                    ]}
                                  />
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <TablePagination
                    page={page}
                    pageSize={PAGE_SIZE}
                    totalItems={filteredRecords.length}
                    onPageChange={setPage}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Dashboard>
  );
}

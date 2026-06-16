import { useState, type ReactNode } from "react";
import Dashboard from "@/components/layout/Dashboard";
import DashboardExpiringTable from "@/components/dashboard/DashboardExpiringTable";
import DocumentOverviewChart from "@/components/dashboard/DocumentOverviewChart";
import DashboardRecentAssignments from "@/components/dashboard/DashboardRecentAssignments";
import type { AssetAssignment } from "@/components/dashboard/RecentAssignments";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Loader2, Package, Users, AlertTriangle, AlertCircle } from "lucide-react";
import DocumentExpiryListModal from "@/components/modals/DocumentExpiryListModal";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ModuleKey } from "@shared/permissions";
import type { DocumentExpiryRecord } from "@shared/document-reminder-utils";

type DashboardStatCard = {
  key: string;
  title: string;
  subtitle: string;
  href?: string;
  documentMode?: "expiring" | "expired";
  module: ModuleKey;
  count: number;
  icon: ReactNode;
  gradient: string;
};

function StatCard({
  card,
  onDocumentClick,
}: {
  card: DashboardStatCard;
  onDocumentClick?: (mode: "expiring" | "expired") => void;
}) {
  const cardClasses = cn(
    "group h-full border-2 border-transparent transition-all duration-200 cursor-pointer",
    "hover:border-primary hover:bg-primary/[0.06] hover:shadow-md",
    "active:border-primary active:bg-primary/10 active:shadow-sm active:scale-[0.99]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
  );

  const inner = (
    <Card className={cardClasses}>
      <CardContent className="p-6">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r transition-transform duration-200",
            "group-hover:scale-105 group-active:scale-100",
            card.gradient
          )}
        >
          {card.icon}
        </div>
        <h3 className="text-sm font-medium text-gray-600 mb-2 group-hover:text-primary/80 transition-colors">
          {card.title}
        </h3>
        <p className="text-3xl font-bold text-gray-900">{card.count}</p>
        <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
      </CardContent>
    </Card>
  );

  if (card.documentMode && onDocumentClick) {
    return (
      <div
        className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={() => onDocumentClick(card.documentMode!)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onDocumentClick(card.documentMode!)}
      >
        {inner}
      </div>
    );
  }

  if (card.href) {
    return (
      <Link href={card.href} className="block h-full rounded-xl outline-none">
        {inner}
      </Link>
    );
  }

  return inner;
}

export default function HomePage() {
  const { user, tenantId } = useAuth();
  const { canSeeOtherData, canView } = usePermissions();
  const [listModalOpen, setListModalOpen] = useState(false);
  const [listModalMode, setListModalMode] = useState<"expiring" | "expired">("expiring");
  const [documentRecords, setDocumentRecords] = useState<DocumentExpiryRecord[]>([]);

  const canLoadDashboardStats =
    canSeeOtherData &&
    !!user &&
    (Boolean(tenantId) || user.role === "super_admin" || user.isSuperAdmin);

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: canLoadDashboardStats,
  });

  const { data: expiringRecords = [] } = useQuery<DocumentExpiryRecord[]>({
    queryKey: ["/api/document-reminders/expiring", "expiring"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/document-reminders/expiring?status=expiring");
      return res.json();
    },
    enabled: canLoadDashboardStats && canView("documents"),
    staleTime: 60_000,
  });

  const handleDocumentCardClick = async (mode: "expiring" | "expired") => {
    try {
      const res = await apiRequest("GET", `/api/document-reminders/expiring?status=${mode}`);
      const records = await res.json();
      setDocumentRecords(records);
      setListModalMode(mode);
      setListModalOpen(true);
    } catch {
      setDocumentRecords([]);
      setListModalMode(mode);
      setListModalOpen(true);
    }
  };

  const documentStatus = dashboardData?.documentStatus || {
    valid: { count: 0, percentage: 0 },
    expiringSoon: { count: 0, percentage: 0 },
    expired: { count: 0, percentage: 0 },
  };

  const documentOverview = {
    valid: documentStatus.valid.count,
    expiring: dashboardData?.counts?.expiringDocuments ?? documentStatus.expiringSoon.count,
    expired: dashboardData?.counts?.expiredDocuments ?? documentStatus.expired.count,
  };

  const recentAssignments: AssetAssignment[] = Array.isArray(dashboardData?.recentAssignments)
    ? dashboardData.recentAssignments.map((assignment: any) => ({
        id: assignment.id,
        asset: assignment.asset
          ? {
              id: assignment.asset.id || 0,
              name: assignment.asset.name || "Unknown",
              type: assignment.asset.type || "Unknown",
              tag: assignment.asset.tag || "",
              serial: assignment.asset.serial || "",
            }
          : {
              id: assignment.assetId || 0,
              name: assignment.assetName || "Unknown",
              type: assignment.assetType || "Unknown",
              tag: assignment.assetTag || "",
              serial: assignment.assetSerial || "",
            },
        employee: assignment.employee
          ? {
              id: assignment.employee.id || 0,
              name: assignment.employee.name || "Unknown",
              department: assignment.employee.department || "Unknown",
            }
          : {
              id: assignment.employeeId || 0,
              name: assignment.employeeName || "Unknown",
              department: assignment.employeeDepartment || "Unknown",
            },
        dateAssigned: assignment.dateAssigned || assignment.assignedAt || "",
        status: assignment.status || "active",
      }))
    : [];

  const statCards: DashboardStatCard[] = canSeeOtherData
    ? [
        {
          key: "assets",
          title: "Total Assets",
          subtitle: "All registered assets",
          href: "/assets",
          module: "assets",
          count: dashboardData?.counts?.assets || 0,
          icon: <Package className="h-6 w-6" />,
          gradient: "from-blue-500 to-blue-700",
        },
        {
          key: "employees",
          title: "Total Employees",
          subtitle: "All registered employees",
          href: "/employees",
          module: "employee",
          count: dashboardData?.counts?.employees || 0,
          icon: <Users className="h-6 w-6" />,
          gradient: "from-teal-500 to-teal-700",
        },
        {
          key: "expiring-documents",
          title: "Expiring Documents",
          subtitle: "All documents expiring within 30 days",
          documentMode: "expiring",
          module: "documents",
          count: dashboardData?.counts?.expiringDocuments || 0,
          icon: <AlertTriangle className="h-6 w-6" />,
          gradient: "from-orange-400 to-orange-600",
        },
        {
          key: "expired-documents",
          title: "Expired Documents",
          subtitle: "Requires immediate attention",
          documentMode: "expired",
          module: "documents",
          count: dashboardData?.counts?.expiredDocuments || 0,
          icon: <AlertCircle className="h-6 w-6" />,
          gradient: "from-red-400 to-red-600",
        },
      ].filter((card) => canView(card.module))
    : [];

  return (
    <Dashboard title="Dashboard">
      {!canSeeOtherData ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Dashboard statistics unavailable</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              You do not have permission to view dashboard statistics. Contact your administrator if
              you need access.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">Error loading dashboard data</p>
            <p className="text-sm text-gray-500">{error.message}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 min-h-[calc(100dvh-11.5rem)]">
          {statCards.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 shrink-0">
              {statCards.map((card) => (
                <StatCard
                  key={card.key}
                  card={card}
                  onDocumentClick={card.documentMode ? handleDocumentCardClick : undefined}
                />
              ))}
            </div>
          ) : (
            <Card className="shrink-0">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No dashboard cards available for your assigned module permissions.
                </p>
              </CardContent>
            </Card>
          )}

          {(canView("documents") || canView("assets")) && (
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-[480px]">
              <div
                className={cn(
                  "xl:col-span-7 grid gap-4 min-h-0 h-full",
                  canView("documents") && canView("assets") ? "grid-rows-2" : "grid-rows-1"
                )}
              >
                {canView("documents") && (
                  <DashboardExpiringTable records={expiringRecords} />
                )}
                {canView("assets") && (
                  <DashboardRecentAssignments assignments={recentAssignments} />
                )}
              </div>

              {canView("documents") && (
                <div className="xl:col-span-5 min-h-0 h-full">
                  <DocumentOverviewChart data={documentOverview} className="h-full" />
                </div>
              )}
            </div>
          )}
          </div>

          <DocumentExpiryListModal
            open={listModalOpen}
            onOpenChange={setListModalOpen}
            title={listModalMode === "expiring" ? "Expiring Documents" : "Expired Documents"}
            mode={listModalMode}
            records={documentRecords}
          />
        </>
      )}
    </Dashboard>
  );
}

import { useState } from "react";
import Dashboard from "@/components/layout/Dashboard";
import StatCard from "@/components/dashboard/StatCard";
import ExpiringDocuments, { ExpiringDocument } from "@/components/dashboard/ExpiringDocuments";
import RecentActivity, { Activity } from "@/components/dashboard/RecentActivity";
import AssetDistribution, { AssetDistributionData } from "@/components/dashboard/AssetDistribution";
import DocumentStatus from "@/components/dashboard/DocumentStatus";
import RecentAssignments, { AssetAssignment } from "@/components/dashboard/RecentAssignments";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { 
  Laptop, 
  Users, 
  AlertTriangle, 
  AlertCircle 
} from "lucide-react";
import AssignAssetModal from "@/components/modals/AssignAssetModal";
import { Card, CardContent } from "@/components/ui/card";

export default function HomePage() {
  const { user, tenantId } = useAuth();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  
  // Fetch dashboard data only when user and tenant are available
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard"],
    queryFn: () => apiRequest("GET", "/api/dashboard").then((res: Response) => res.json()),
    staleTime: 0, // Consider data stale immediately
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
    enabled: !!user && (Boolean(tenantId) || user.role === 'super_admin' || user.isSuperAdmin), // Allow super admins without tenant
  });

  // Debug logging
  console.log("HomePage - user:", user);
  console.log("HomePage - tenantId:", tenantId);
  console.log("HomePage - dashboardData:", dashboardData);
  console.log("HomePage - error:", error);
  
  // Map data for the dashboard components
  const expiringDocuments: ExpiringDocument[] = Array.isArray(dashboardData?.expiringDocuments)
    ? dashboardData.expiringDocuments.map((doc: any) => ({
        id: doc.id,
        type: doc.type || doc.documentType || "other",
        name: doc.name || doc.employeeName || doc.title || "Unknown",
        daysUntilExpiry: doc.daysUntilExpiry ?? 0,
        employeeId: doc.employeeId,
      }))
    : [];
  
  const recentActivities: Activity[] = Array.isArray(dashboardData?.recentActivities) 
    ? dashboardData.recentActivities.map((activity: any) => ({
        id: activity.id,
        type: activity.type,
        message: activity.message,
        timestamp: activity.timestamp,
      })) 
    : [];
  
  const assetDistribution: AssetDistributionData[] = Array.isArray(dashboardData?.assetDistribution) 
    ? dashboardData.assetDistribution.map((item: any) => ({
        type: item.type,
        count: item.count,
        percentage: item.percentage,
      })) 
    : [];
  
  const documentStatus = dashboardData?.documentStatus || {
    valid: { count: 0, percentage: 0 },
    expiringSoon: { count: 0, percentage: 0 },
    expired: { count: 0, percentage: 0 },
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
  
  return (
    <Dashboard
      title="Dashboard"
      description={`Welcome back, ${user?.name}. Here's what's happening with your assets and documents.`}
    >
      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <div className="flex justify-center items-center py-10">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">Error loading dashboard data</p>
            <p className="text-sm text-gray-500">{error.message}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Status Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r from-teal-400 to-teal-600">
                  <Laptop className="h-6 w-6" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Assets</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.counts?.assets || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Managed assets</p>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r from-teal-500 to-teal-700">
                  <Users className="h-6 w-6" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Employees</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.counts?.employees || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Active employees</p>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r from-orange-400 to-orange-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Expiring Documents</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.counts?.expiringDocuments || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r from-red-400 to-red-600">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">License Expiry</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.counts?.licenseExpiry || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Expiring soon</p>
              </CardContent>
            </Card>
          </div>

          {/* Alerts and Notifications */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <ExpiringDocuments
              documents={expiringDocuments}
              className="lg:col-span-2"
            />
            <RecentActivity activities={recentActivities} />
          </div>

          {/* Assets & Documents Management */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <AssetDistribution data={assetDistribution} />
            <DocumentStatus data={documentStatus} />
          </div>

          {/* Recent Asset Assignments */}
          <RecentAssignments
            assignments={recentAssignments}
            onNewAssignment={() => setIsAssignModalOpen(true)}
            className="mb-6"
          />
          
          {/* Asset Assignment Modal */}
          <AssignAssetModal 
            open={isAssignModalOpen} 
            onClose={() => setIsAssignModalOpen(false)} 
          />
        </>
      )}
    </Dashboard>
  );
}

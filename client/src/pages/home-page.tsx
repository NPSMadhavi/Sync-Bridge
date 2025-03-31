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
import { Loader2 } from "lucide-react";
import { 
  Laptop, 
  Users, 
  AlertTriangle, 
  WrenchIcon 
} from "lucide-react";
import AssignAssetModal from "@/components/modals/AssignAssetModal";

export default function HomePage() {
  const { user } = useAuth();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  
  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["/api/dashboard"],
  });
  
  // Map data for the dashboard components
  const expiringDocuments: ExpiringDocument[] = dashboardData?.expiringDocuments?.map((doc: any) => ({
    id: doc.id,
    type: doc.documentType,
    name: doc.name,
    daysUntilExpiry: doc.daysUntilExpiry,
    employeeId: doc.employeeId,
  })) || [];
  
  const recentActivities: Activity[] = dashboardData?.recentActivities?.map((activity: any) => ({
    id: activity.id,
    type: activity.type,
    message: activity.message,
    timestamp: activity.timestamp,
  })) || [];
  
  const assetDistribution: AssetDistributionData[] = dashboardData?.assetDistribution?.map((item: any) => ({
    type: item.type,
    count: item.count,
    percentage: item.percentage,
  })) || [];
  
  const documentStatus = dashboardData?.documentStatus || {
    valid: { count: 0, percentage: 0 },
    expiringSoon: { count: 0, percentage: 0 },
    expired: { count: 0, percentage: 0 },
  };
  
  const recentAssignments: AssetAssignment[] = dashboardData?.recentAssignments?.map((assignment: any) => ({
    id: assignment.id,
    asset: {
      id: assignment.asset.id,
      name: assignment.asset.name,
      type: assignment.asset.type,
      tag: assignment.asset.tag,
      serial: assignment.asset.serial,
    },
    employee: {
      id: assignment.employee.id,
      name: assignment.employee.name,
      department: assignment.employee.department,
    },
    dateAssigned: assignment.dateAssigned,
    status: assignment.status,
  })) || [];
  
  return (
    <Dashboard
      title="Dashboard"
      description={`Welcome back, ${user?.name}. Here's what's happening with your assets and documents.`}
    >
      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<Laptop size={24} />}
              title="Total Assets"
              value={dashboardData?.counts?.assets || 0}
              iconColor="primary"
            />
            <StatCard
              icon={<Users size={24} />}
              title="Employees"
              value={dashboardData?.counts?.employees || 0}
              iconColor="success"
            />
            <StatCard
              icon={<AlertTriangle size={24} />}
              title="Expiring Documents"
              value={dashboardData?.counts?.expiringDocuments || 0}
              iconColor="warning"
            />
            <StatCard
              icon={<WrenchIcon size={24} />}
              title="Maintenance Due"
              value={dashboardData?.counts?.maintenanceDue || 0}
              iconColor="danger"
            />
          </div>

          {/* Alerts and Notifications */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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

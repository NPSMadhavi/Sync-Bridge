import { Link } from "wouter";
import {
  UserPlus,
  FileUp,
  Settings,
  AlertTriangle,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface Activity {
  id: number;
  type: 'assignment' | 'upload' | 'system' | 'maintenance' | 'return';
  message: string;
  timestamp: string;
}

interface RecentActivityProps {
  activities: Activity[];
  className?: string;
}

export default function RecentActivity({ activities, className }: RecentActivityProps) {
  // Helper function to get the right icon and color for activity type
  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'assignment':
        return {
          icon: <UserPlus size={16} />,
          bgColor: "bg-blue-100",
          textColor: "text-primary-500"
        };
      case 'upload':
        return {
          icon: <FileUp size={16} />,
          bgColor: "bg-green-100",
          textColor: "text-green-500"
        };
      case 'system':
        return {
          icon: <Settings size={16} />,
          bgColor: "bg-purple-100",
          textColor: "text-purple-500"
        };
      case 'maintenance':
        return {
          icon: <AlertTriangle size={16} />,
          bgColor: "bg-amber-100",
          textColor: "text-amber-500"
        };
      case 'return':
        return {
          icon: <Check size={16} />,
          bgColor: "bg-teal-100",
          textColor: "text-teal-500"
        };
    }
  };
  
  return (
    <div className={cn("bg-white rounded-lg shadow-sm border border-gray-200", className)}>
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Recent Activity</h3>
      </div>
      <div className="p-5">
        {activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity) => {
              const { icon, bgColor, textColor } = getActivityIcon(activity.type);
              
              return (
                <div key={activity.id} className="flex">
                  <div className="flex-shrink-0 mr-3">
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", bgColor, textColor)}>
                      {icon}
                    </div>
                  </div>
                  <div>
                    <p 
                      className="text-sm text-gray-800"
                      dangerouslySetInnerHTML={{ __html: activity.message }}
                    />
                    <p className="text-xs text-gray-500">{activity.timestamp}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Settings className="h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-800 mb-1">No recent activity</h3>
            <p className="text-sm text-gray-500">Activity will appear here as you use the system.</p>
          </div>
        )}
        
        {activities.length > 0 && (
          <div className="mt-4 text-center">
            <Link href="/audit-logs">
              <Button variant="link" className="text-sm font-medium">
                View all activity
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

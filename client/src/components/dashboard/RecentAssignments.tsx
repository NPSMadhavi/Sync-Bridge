import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  Laptop,
  Monitor,
  Smartphone,
  MoreHorizontal,
  ChevronsUp,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface AssetAssignment {
  id: number;
  asset: {
    id: number;
    name: string;
    type: string;
    tag: string;
    serial: string;
  };
  employee: {
    id: number;
    name: string;
    department: string;
  };
  dateAssigned: string;
  status: 'active' | 'returned' | 'overdue';
}

interface RecentAssignmentsProps {
  assignments: AssetAssignment[];
  onNewAssignment?: () => void;
  className?: string;
}

export default function RecentAssignments({ 
  assignments, 
  onNewAssignment,
  className 
}: RecentAssignmentsProps) {
  // Helper function to get the right icon for asset type
  const getAssetIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'laptop':
        return <Laptop className="text-gray-500" size={16} />;
      case 'monitor':
        return <Monitor className="text-gray-500" size={16} />;
      case 'mobile':
      case 'phone':
        return <Smartphone className="text-gray-500" size={16} />;
      default:
        return <Monitor className="text-gray-500" size={16} />;
    }
  };
  
  return (
    <div className={cn("bg-white rounded-lg shadow-sm border border-gray-200", className)}>
      <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Recent Asset Assignments</h3>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            className="text-sm bg-primary-500 text-white hover:bg-primary-600"
            onClick={onNewAssignment}
          >
            <Plus size={16} className="mr-1" /> New Assignment
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Asset
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assigned To
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date Assigned
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assignments.length > 0 ? (
              assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 rounded bg-gray-100 flex items-center justify-center">
                        {getAssetIcon(assignment.asset.type)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{assignment.asset.name} ({assignment.asset.tag})</div>
                        <div className="text-xs text-gray-500">Serial: {assignment.asset.serial}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{assignment.employee.name}</div>
                    <div className="text-xs text-gray-500">{assignment.employee.department}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{assignment.dateAssigned}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge 
                      variant={
                        assignment.status === 'active' ? 'success' :
                        assignment.status === 'returned' ? 'secondary' : 'destructive'
                      }
                      className="text-xs font-semibold capitalize"
                    >
                      {assignment.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/assets/assignments/${assignment.id}`}>
                      <Button variant="link" className="text-primary-500 hover:text-primary-600">
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <ChevronsUp className="h-12 w-12 text-gray-300 mb-3" />
                    <h3 className="text-lg font-medium text-gray-800 mb-1">No asset assignments yet</h3>
                    <p className="text-sm text-gray-500 mb-4">Start assigning assets to employees</p>
                    <Button
                      size="sm"
                      className="text-sm bg-primary-500 text-white hover:bg-primary-600"
                      onClick={onNewAssignment}
                    >
                      <Plus size={16} className="mr-1" /> New Assignment
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {assignments.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-200 text-center">
          <Link href="/assets">
            <Button variant="link" className="text-sm font-medium">
              View all assignments
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

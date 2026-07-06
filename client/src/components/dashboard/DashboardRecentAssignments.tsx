import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Package, ChevronRight } from "lucide-react";
import type { AssetAssignment } from "@/components/dashboard/RecentAssignments";

const DISPLAY_LIMIT = 3;

interface DashboardRecentAssignmentsProps {
  assignments: AssetAssignment[];
  className?: string;
}

function statusLabel(status: AssetAssignment["status"]) {
  if (status === "active") return "Assigned";
  if (status === "returned") return "Returned";
  return "Overdue";
}

function statusClass(status: AssetAssignment["status"]) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "returned") return "bg-gray-100 text-gray-600";
  return "bg-red-50 text-red-700";
}

export default function DashboardRecentAssignments({
  assignments,
  className,
}: DashboardRecentAssignmentsProps) {
  const displayAssignments = assignments.slice(0, DISPLAY_LIMIT);

  return (
    <div
      className={cn(
        "bg-white rounded-xl shadow-sm border border-gray-200/80 flex flex-col h-full min-h-0 overflow-hidden",
        className
      )}
    >
      <div className="px-5 py-3 flex items-center gap-2.5 border-b border-gray-100 shrink-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <Package className="h-4 w-4" />
        </span>
        <h3 className="text-[16px] font-semibold text-gray-900">Recent Asset Assignments</h3>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-5 py-2 text-left text-[14px] font-medium text-gray-600 tracking-wide">
                Asset Name
              </th>
              <th className="px-3 py-2 text-left text-[14px] font-medium text-gray-600 tracking-wide">
                Employee Name
              </th>
              <th className="px-3 py-2 text-left text-[14px] font-medium text-gray-600 tracking-wide">
                Assigned Date
              </th>
              <th className="px-5 py-2 text-right text-[14px] font-medium text-gray-600 tracking-wide">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {displayAssignments.length > 0 ? (
              displayAssignments.map((assignment) => (
                <tr key={assignment.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {assignment.asset.name}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                    {assignment.employee.name}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                    {assignment.dateAssigned}
                  </td>
                  <td className="px-5 py-2.5 text-right whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                        statusClass(assignment.status)
                      )}
                    >
                      {statusLabel(assignment.status)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-sm text-gray-500">
                  No asset assignments yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-2 border-t border-gray-100 flex justify-end shrink-0 bg-white">
        <Link href="/assets">
          <span className="inline-flex items-center gap-0.5 text-sm font-medium cursor-pointer transition-colors text-blue-600 hover:text-blue-700">
            View All <ChevronRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}

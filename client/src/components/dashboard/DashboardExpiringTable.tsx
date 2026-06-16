import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@shared/document-reminder-utils";
import type { DocumentExpiryRecord } from "@shared/document-reminder-utils";
import { CalendarDays, ChevronRight } from "lucide-react";

const DISPLAY_LIMIT = 3;

interface DashboardExpiringTableProps {
  records: DocumentExpiryRecord[];
  className?: string;
}

export default function DashboardExpiringTable({
  records,
  className,
}: DashboardExpiringTableProps) {
  const displayRecords = records.slice(0, DISPLAY_LIMIT);

  return (
    <div
      className={cn(
        "bg-white rounded-xl shadow-sm border border-gray-200/80 flex flex-col h-full min-h-0 overflow-hidden",
        className
      )}
    >
      <div className="px-5 py-3 flex items-center gap-2.5 border-b border-gray-100 shrink-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <CalendarDays className="h-4 w-4" />
        </span>
        <h3 className="text-[16px] font-semibold text-gray-900">Expiring Documents</h3>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-5 py-2 text-left text-[14px] font-medium text-gray-600 tracking-wide">
                Employee ID
              </th>
              <th className="px-3 py-2 text-left text-[14px] font-medium text-gray-600 tracking-wide">
                Employee Name
              </th>
              <th className="px-3 py-2 text-left text-[14px] font-medium text-gray-600 tracking-wide">
                Document Type
              </th>
              <th className="px-3 py-2 text-left text-[14px] font-medium text-gray-600 tracking-wide">
                Expiry Date
              </th>
              <th className="px-5 py-2 text-right text-[14px] font-medium text-gray-600 tracking-wide">
                Days Remaining
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRecords.length > 0 ? (
              displayRecords.map((record) => (
                <tr key={record.recordKey} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {record.employeeId}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                    {record.employeeName}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                    {record.documentType}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                    {formatDisplayDate(record.expiryDate)}
                  </td>
                  <td className="px-5 py-2.5 text-right whitespace-nowrap">
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      {record.daysRemaining ?? 0} Days
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-gray-500">
                  No expiring documents
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-2 border-t border-gray-100 flex justify-end shrink-0 bg-white">
        <Link href="/documents?tab=expiring">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-sm font-medium cursor-pointer transition-colors",
              displayRecords.length > 0
                ? "text-blue-600 hover:text-blue-700"
                : "text-gray-300 pointer-events-none"
            )}
          >
            View All <ChevronRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}

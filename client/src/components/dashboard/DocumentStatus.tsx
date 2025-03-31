import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DocumentStatusData {
  status: 'valid' | 'expiringSoon' | 'expired';
  count: number;
  percentage: number;
}

interface DocumentStatusProps {
  data: {
    valid: DocumentStatusData;
    expiringSoon: DocumentStatusData;
    expired: DocumentStatusData;
  };
  className?: string;
}

export default function DocumentStatus({ data, className }: DocumentStatusProps) {
  return (
    <div className={cn("bg-white rounded-lg shadow-sm border border-gray-200", className)}>
      <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Document Status</h3>
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-5">
        <div className="flex flex-col mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Valid</span>
            <span className="text-sm font-medium text-green-600">
              {data.valid.count} ({data.valid.percentage}%)
            </span>
          </div>
          <Progress 
            value={data.valid.percentage} 
            className="h-2.5 bg-gray-200"
            indicatorClassName="bg-green-500"
          />
        </div>
        
        <div className="flex flex-col mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Expiring Soon (30 days)</span>
            <span className="text-sm font-medium text-amber-600">
              {data.expiringSoon.count} ({data.expiringSoon.percentage}%)
            </span>
          </div>
          <Progress 
            value={data.expiringSoon.percentage} 
            className="h-2.5 bg-gray-200"
            indicatorClassName="bg-amber-500"
          />
        </div>
        
        <div className="flex flex-col">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Expired</span>
            <span className="text-sm font-medium text-red-600">
              {data.expired.count} ({data.expired.percentage}%)
            </span>
          </div>
          <Progress 
            value={data.expired.percentage} 
            className="h-2.5 bg-gray-200"
            indicatorClassName="bg-red-500"
          />
        </div>
      </div>
    </div>
  );
}

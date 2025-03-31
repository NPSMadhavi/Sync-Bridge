import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AssetDistributionData {
  type: string;
  count: number;
  percentage: number;
  color?: string;
}

interface AssetDistributionProps {
  data: AssetDistributionData[];
  className?: string;
}

export default function AssetDistribution({ data, className }: AssetDistributionProps) {
  // Default colors if not provided in the data
  const defaultColors = ["bg-primary-500", "bg-green-500", "bg-purple-500", "bg-gray-500"];
  
  return (
    <div className={cn("bg-white rounded-lg shadow-sm border border-gray-200", className)}>
      <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Asset Distribution</h3>
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-5">
        {data.map((item, index) => (
          <div key={item.type} className="flex flex-col mb-4 last:mb-0">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">{item.type}</span>
              <span className="text-sm font-medium text-gray-800">
                {item.count} ({item.percentage}%)
              </span>
            </div>
            <Progress 
              value={item.percentage}
              className="h-2.5 bg-gray-200"
              indicatorClassName={item.color || defaultColors[index % defaultColors.length]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

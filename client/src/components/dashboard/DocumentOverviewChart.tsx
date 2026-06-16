import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";

export interface DocumentOverviewData {
  valid: number;
  expiring: number;
  expired: number;
}

interface DocumentOverviewChartProps {
  data: DocumentOverviewData;
  className?: string;
}

const COLORS = {
  valid: "#22c55e",
  expiring: "#f97316",
  expired: "#ef4444",
};

export default function DocumentOverviewChart({
  data,
  className,
}: DocumentOverviewChartProps) {
  const total = data.valid + data.expiring + data.expired;

  const chartData = [
    { name: "Valid", value: data.valid, color: COLORS.valid },
    { name: "Expiring", value: data.expiring, color: COLORS.expiring },
    { name: "Expired", value: data.expired, color: COLORS.expired },
  ].filter((item) => item.value > 0);

  const displayData =
    chartData.length > 0
      ? chartData
      : [{ name: "No Data", value: 1, color: "#e5e7eb" }];

  const pct = (count: number) =>
    total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

  const legendItems = [
    { label: "Valid Documents", color: COLORS.valid, count: data.valid },
    { label: "Expiring Documents", color: COLORS.expiring, count: data.expiring },
    { label: "Expired Documents", color: COLORS.expired, count: data.expired },
  ];

  return (
    <div
      className={cn(
        "bg-white rounded-xl shadow-sm border border-gray-200/80 flex flex-col h-full min-h-0 overflow-hidden",
        className
      )}
    >
      <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 shrink-0">
        <h3 className="text-[15px] font-semibold text-gray-900">Document Overview</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-5 py-5">
        <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
          <div className="relative w-full max-w-[260px] flex-1 min-h-[180px] max-h-[320px] mx-auto aspect-square">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={displayData}
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="85%"
                  paddingAngle={chartData.length > 1 ? 3 : 0}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {displayData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[32px] font-bold text-gray-900 leading-none">{total}</span>
              <span className="text-xs text-gray-500 mt-1.5">Total Documents</span>
            </div>
          </div>
        </div>

        <div className="w-full mt-2 shrink-0 divide-y divide-gray-100 border-t border-gray-100">
          {legendItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 py-3 first:pt-4 last:pb-1"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 shrink-0 tabular-nums">
                {item.count}{" "}
                <span className="font-normal text-gray-500">({pct(item.count)}%)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

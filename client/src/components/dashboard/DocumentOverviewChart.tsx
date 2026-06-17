import { cn } from "@/lib/utils";
import { PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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
      <div className="px-5 py-3 flex items-center gap-2.5 border-b border-gray-100 shrink-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <PieChartIcon className="h-4 w-4" />
        </span>
        <h3 className="text-[16px] font-semibold text-gray-900">Document Overview</h3>
      </div>

      <div className="flex-1 flex flex-col items-stretch min-h-0 px-5 py-5 gap-4">
        <div className="flex items-center justify-center shrink-0 min-h-[220px]">
          <div className="relative w-full max-w-[280px] aspect-square mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} (${pct(value)}%)`,
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "13px",
                  }}
                />
                <Pie
                  data={displayData}
                  cx="50%"
                  cy="50%"
                  innerRadius="58%"
                  outerRadius="92%"
                  paddingAngle={chartData.length > 1 ? 4 : 0}
                  dataKey="value"
                  stroke="#fff"
                  strokeWidth={3}
                >
                  {displayData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[40px] font-bold text-gray-900 leading-none tracking-tight">
                {total}
              </span>
              <span className="text-sm text-gray-500 mt-2 font-medium">Total Documents</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 shrink-0">
          <div className="flex flex-col divide-y divide-gray-100">
            {legendItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="h-3 w-3 rounded-full shrink-0 ring-2 ring-white shadow-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium text-gray-700 truncate">{item.label}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base font-bold text-gray-900 tabular-nums">{item.count}</span>
                  <span className="block text-xs text-gray-500 tabular-nums">{pct(item.count)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

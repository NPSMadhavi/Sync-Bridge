import { Link } from "wouter";
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

function StatusRow({
  label,
  count,
  percentage,
  valueClassName,
  indicatorClassName,
  href,
}: {
  label: string;
  count: number;
  percentage: number;
  valueClassName: string;
  indicatorClassName: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className={cn("text-sm font-medium", valueClassName)}>
          {count} ({percentage}%)
        </span>
      </div>
      <Progress
        value={percentage}
        className="h-2.5 bg-gray-200"
        indicatorClassName={indicatorClassName}
      />
    </>
  );

  if (!href) {
    return <div className="flex flex-col mb-4 last:mb-0">{content}</div>;
  }

  return (
    <Link href={href}>
      <div className="flex flex-col mb-4 last:mb-0 rounded-md p-2 -mx-2 transition-colors hover:bg-gray-50 cursor-pointer">
        {content}
      </div>
    </Link>
  );
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
        <StatusRow
          label="Valid"
          count={data.valid.count}
          percentage={data.valid.percentage}
          valueClassName="text-green-600"
          indicatorClassName="bg-green-500"
          href="/documents?tab=all"
        />
        <StatusRow
          label="Expiring Soon (30 days)"
          count={data.expiringSoon.count}
          percentage={data.expiringSoon.percentage}
          valueClassName="text-amber-600"
          indicatorClassName="bg-amber-500"
          href="/documents?tab=expiring"
        />
        <StatusRow
          label="Expired"
          count={data.expired.count}
          percentage={data.expired.percentage}
          valueClassName="text-red-600"
          indicatorClassName="bg-red-500"
          href="/documents?tab=expired"
        />
      </div>
    </div>
  );
}

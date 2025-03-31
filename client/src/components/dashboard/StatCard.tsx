import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: ReactNode;
  title: string;
  value: string | number;
  iconColor?: "primary" | "success" | "warning" | "danger";
  className?: string;
}

export default function StatCard({ icon, title, value, iconColor = "primary", className }: StatCardProps) {
  // Color mapping
  const colorMap = {
    primary: {
      bg: "bg-primary-100",
      text: "text-primary-500"
    },
    success: {
      bg: "bg-green-100",
      text: "text-green-500"
    },
    warning: {
      bg: "bg-amber-100",
      text: "text-amber-500"
    },
    danger: {
      bg: "bg-red-100",
      text: "text-red-500"
    }
  };
  
  const { bg, text } = colorMap[iconColor];
  
  return (
    <div className={cn("bg-white rounded-lg shadow-sm p-5 border border-gray-200", className)}>
      <div className="flex items-center">
        <div className={cn("flex-shrink-0 rounded-full p-3", bg)}>
          <div className={text}>{icon}</div>
        </div>
        <div className="ml-4">
          <h2 className="text-sm font-medium text-gray-500">{title}</h2>
          <p className="text-2xl font-semibold text-gray-800">{value}</p>
        </div>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type TableActionVariant = "edit" | "view" | "delete" | "default";

export interface TableAction {
  icon: LucideIcon;
  onClick: () => void;
  label: string;
  variant?: TableActionVariant;
  disabled?: boolean;
}

const variantClasses: Record<TableActionVariant, string> = {
  edit: "hover:bg-teal-50 hover:text-teal-700",
  view: "hover:bg-blue-50 hover:text-blue-700",
  delete: "hover:bg-red-50 hover:text-red-700",
  default: "",
};

export function TableRowActions({ actions }: { actions: TableAction[] }) {
  return (
    <div className="flex gap-2">
      {actions.map((action, index) => (
        <Button
          key={index}
          type="button"
          variant="ghost"
          size="sm"
          title={action.label}
          aria-label={action.label}
          onClick={action.onClick}
          disabled={action.disabled}
          className={cn(variantClasses[action.variant || "default"])}
        >
          <action.icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
}

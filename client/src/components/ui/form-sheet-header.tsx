import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface FormSheetHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  icon?: ReactNode;
  className?: string;
}

export function FormSheetHeader({
  title,
  description,
  onClose,
  icon,
  className,
}: FormSheetHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0 flex items-start justify-between gap-4",
        className
      )}
    >
      <SheetHeader className="flex-1 space-y-1 text-left p-0">
        <SheetTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          {icon}
          {title}
        </SheetTitle>
        {description ? (
          <p className="text-sm text-gray-600 mt-2">{description}</p>
        ) : null}
      </SheetHeader>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 shrink-0"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

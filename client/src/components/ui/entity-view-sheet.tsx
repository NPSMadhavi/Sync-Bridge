import * as React from "react";
import { History } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function formatViewDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatViewValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function formatViewStatus(status?: string | null): string {
  if (!status) return "—";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface EntityViewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  onHistory?: () => void;
  showHistory?: boolean;
}

export function EntityViewSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  onClose,
  onHistory,
  showHistory = false,
}: EntityViewSheetProps) {
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="p-0 flex flex-col w-full sm:max-w-none"
        style={{ width: "min(100vw, 640px)", maxWidth: "none", minWidth: "320px" }}
      >
        <div className="sticky top-0 z-10 bg-background border-b px-4 sm:px-6 py-4 shrink-0">
          <SheetHeader>
            <SheetTitle className="text-xl sm:text-2xl font-bold text-gray-900">
              {title}
            </SheetTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">{children}</div>

        <div className="sticky bottom-0 z-10 bg-background border-t px-4 sm:px-6 py-4 shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-3">
          {footer ?? (
            <>
              {showHistory && onHistory && (
                <Button type="button" variant="outline" onClick={onHistory}>
                  <History className="mr-2 h-4 w-4" />
                  History
                </Button>
              )}
              <Button type="button" variant="outline" onClick={handleClose}>
                Close
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function EntityViewSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-sm mb-4 last:mb-0", className)}>
      <div className="border-b bg-muted/30 px-4 py-3">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

export function EntityViewFieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">{children}</dl>
  );
}

export function EntityViewField({
  label,
  value,
  children,
  className,
  fullWidth = false,
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}) {
  const display =
    children ??
    (value === null || value === undefined || value === "" ? "—" : value);

  return (
    <div className={cn("min-w-0", fullWidth && "md:col-span-2", className)}>
      <dt className="text-sm font-semibold text-gray-900 mb-1">{label}</dt>
      <dd className="text-sm text-gray-600 break-words">{display}</dd>
    </div>
  );
}

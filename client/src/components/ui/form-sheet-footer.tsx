import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormSheetFooterProps {
  children: ReactNode;
  className?: string;
}

export function FormSheetFooter({ children, className }: FormSheetFooterProps) {
  return (
    <div className={cn("flex-shrink-0 bg-background border-t px-6 py-4 sm:px-8", className)}>
      <div className="flex flex-col sm:flex-row justify-end gap-3">{children}</div>
    </div>
  );
}

export const formSheetCancelClass = "w-full sm:w-auto min-w-[120px]";
export const formSheetSubmitClass = "w-full sm:w-auto min-w-[140px]";

/** Blue submit buttons — keeps appearance on hover when disabled */
export const formSheetBlueSubmitClass =
  "w-full sm:w-auto min-w-[140px] bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-auto disabled:transition-none disabled:hover:bg-blue-600 disabled:hover:text-white disabled:hover:shadow-lg disabled:active:bg-blue-600 disabled:active:text-white disabled:focus-visible:bg-blue-600 disabled:focus-visible:text-white";

/** Payroll table — active (unprocessed) process button */
export const payrollTableProcessButtonClass =
  "min-w-[120px] bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl";

/** Payroll table — processed status button (no hover/visual change when disabled) */
export const payrollTableProcessedButtonClass =
  "min-w-[120px] bg-blue-600 text-white shadow-lg cursor-not-allowed pointer-events-auto !transition-none hover:!bg-blue-600 hover:!text-white hover:!shadow-lg focus-visible:!bg-blue-600 focus-visible:!text-white focus-visible:!shadow-lg active:!bg-blue-600 active:!text-white disabled:pointer-events-auto disabled:!cursor-not-allowed disabled:!opacity-100 disabled:!transition-none disabled:hover:!bg-blue-600 disabled:hover:!text-white disabled:hover:!shadow-lg disabled:active:!bg-blue-600 disabled:active:!text-white disabled:focus-visible:!bg-blue-600 disabled:focus-visible:!text-white disabled:focus-visible:!shadow-lg";

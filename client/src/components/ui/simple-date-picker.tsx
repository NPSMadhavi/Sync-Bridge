import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SimpleDatePickerProps {
  date?: Date | null;
  setDate: (date?: Date | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: string; // YYYY-MM-DD format
  max?: string; // YYYY-MM-DD format
}

export function SimpleDatePicker({ 
  date, 
  setDate, 
  placeholder = "Select date",
  className,
  disabled,
  min,
  max
}: SimpleDatePickerProps) {
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      setDate(new Date(value));
    } else {
      setDate(undefined);
    }
  };

  const formatDateForInput = (date?: Date | null) => {
    if (!date) return "";
    return date.toISOString().split('T')[0];
  };

  return (
    <Input
      type="date"
      value={formatDateForInput(date || undefined)}
      onChange={handleDateChange}
      placeholder={placeholder}
      className={cn("w-full", className)}
      disabled={disabled}
      min={min}
      max={max}
    />
  );
}
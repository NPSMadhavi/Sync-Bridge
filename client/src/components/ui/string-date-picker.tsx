/**
 * StringDatePicker — YYYY-MM-DD string values with SyncBridge calendar UI.
 */
import { SyncBridgeDatePicker, type SyncBridgeDatePickerProps } from "@/components/ui/sync-bridge-date-picker";

export interface StringDatePickerProps extends Omit<SyncBridgeDatePickerProps, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

export function StringDatePicker({ value, onChange, ...props }: StringDatePickerProps) {
  return (
    <SyncBridgeDatePicker
      value={value}
      onChange={onChange}
      mode="date"
      {...props}
    />
  );
}

/**
 * DatePicker — ISO / YYYY-MM-DD strings with SyncBridge calendar UI.
 */
import { SyncBridgeDatePicker, type SyncBridgeDatePickerProps } from "@/components/ui/sync-bridge-date-picker";

export interface DatePickerProps extends Omit<SyncBridgeDatePickerProps, "value" | "onChange"> {
  value?: string | null;
  onChange: (value?: string | null) => void;
}

export function DatePicker({ value, onChange, ...props }: DatePickerProps) {
  return (
    <SyncBridgeDatePicker
      value={value ?? ""}
      onChange={(v) => onChange(v || null)}
      mode="date"
      {...props}
    />
  );
}

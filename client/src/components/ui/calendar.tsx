/**
 * Calendar — legacy export; renders SyncBridge date panel for Popover usages.
 * Prefer SyncBridgeDatePicker / StringDatePicker for new code.
 */
import * as React from "react";
import {
  DatePickerPanel,
  parseYmd,
  toYmd,
} from "@/components/ui/sync-bridge-date-picker";

export type CalendarProps = {
  mode?: "single";
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  initialFocus?: boolean;
  className?: string;
};

function Calendar({
  selected,
  onSelect,
  disabled,
  className,
}: CalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = React.useState(
    selected?.getFullYear() ?? today.getFullYear()
  );
  const [viewMonth, setViewMonth] = React.useState(
    selected?.getMonth() ?? today.getMonth()
  );
  const [panelView, setPanelView] = React.useState<"month" | "year" | "day">("month");

  React.useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [selected]);

  return (
    <div className={className}>
      <DatePickerPanel
        viewYear={viewYear}
        viewMonth={viewMonth}
        selected={selected ?? null}
        mode="date"
        panelView={panelView}
        onPanelViewChange={setPanelView}
        onViewYearChange={setViewYear}
        onViewMonthChange={setViewMonth}
        onSelect={(d) => onSelect?.(d)}
        onClear={() => onSelect?.(undefined)}
        disabledDate={disabled}
      />
    </div>
  );
}

Calendar.displayName = "Calendar";

export { Calendar, parseYmd, toYmd };

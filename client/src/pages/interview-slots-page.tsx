import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Mail,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DayStatus = "available" | "not_available";

type RoundState = {
  id: string;
  title: string;
  duration: string;
  slots: string[];
  activeSlots: string[];
  accent: string;
  border: string;
};

type InterviewSlotsState = {
  focusedMonth: string;
  dayStatuses: Record<string, DayStatus>;
  rounds: RoundState[];
};

const STORAGE_KEY = "wings-interview-slots-v1";
const DEFAULT_MONTH = new Date(2026, 4, 1);

const DEFAULT_ROUNDS: RoundState[] = [
  {
    id: "technical",
    title: "Round 1 - Technical",
    duration: "1 hr",
    slots: ["7:30 AM", "8:30 AM", "9:30 AM", "10:30 AM", "11:30 AM", "1:30 PM", "2:30 PM", "3:30 PM"],
    activeSlots: ["7:30 AM", "9:30 AM", "11:30 AM", "1:30 PM", "2:30 PM", "3:30 PM"],
    accent: "text-violet-200",
    border: "border-violet-500/30",
  },
  {
    id: "lsp-e",
    title: "Round 2 - LSP-E",
    duration: "2 hrs",
    slots: ["7:30 AM", "9:30 AM", "11:30 AM", "1:30 PM", "3:30 PM"],
    activeSlots: ["7:30 AM", "9:30 AM", "11:30 AM", "1:30 PM", "3:30 PM"],
    accent: "text-cyan-200",
    border: "border-white/80",
  },
  {
    id: "manager",
    title: "Round 3 - Manager/HR",
    duration: "1 hr",
    slots: ["7:30 AM", "8:30 AM", "9:30 AM", "10:30 AM", "11:30 AM", "1:30 PM", "2:30 PM", "3:30 PM"],
    activeSlots: ["7:30 AM", "8:30 AM", "9:30 AM", "10:30 AM", "11:30 AM", "1:30 PM", "2:30 PM", "3:30 PM"],
    accent: "text-emerald-200",
    border: "border-emerald-500/30",
  },
];

const DEFAULT_DAY_STATUSES: Record<string, DayStatus> = {
  "2026-05-22": "available",
};

function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function formatDisplayDate(isoDate: string) {
  return format(parseISO(isoDate), "EEEE, d MMMM yyyy");
}

function readStoredState(): InterviewSlotsState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InterviewSlotsState>;

    return {
      focusedMonth: parsed.focusedMonth || format(DEFAULT_MONTH, "yyyy-MM-dd"),
      dayStatuses: parsed.dayStatuses && typeof parsed.dayStatuses === "object" ? parsed.dayStatuses : DEFAULT_DAY_STATUSES,
      rounds: Array.isArray(parsed.rounds) && parsed.rounds.length ? parsed.rounds : DEFAULT_ROUNDS,
    };
  } catch {
    return null;
  }
}

function buildMonthGrid(month: Date) {
  const firstVisibleDay = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  return Array.from({ length: 42 }, (_, index) => addDays(firstVisibleDay, index));
}

export default function InterviewSlotsPage() {
  const stored = useMemo(() => readStoredState(), []);
  const [focusedMonth, setFocusedMonth] = useState<Date>(
    stored ? parseISO(stored.focusedMonth) : DEFAULT_MONTH,
  );
  const [dayStatuses, setDayStatuses] = useState<Record<string, DayStatus>>(
    stored?.dayStatuses ?? DEFAULT_DAY_STATUSES,
  );
  const [rounds, setRounds] = useState<RoundState[]>(stored?.rounds ?? DEFAULT_ROUNDS);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  useEffect(() => {
    const snapshot: InterviewSlotsState = {
      focusedMonth: toIsoDate(focusedMonth),
      dayStatuses,
      rounds,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [focusedMonth, dayStatuses, rounds]);

  const monthGrid = useMemo(() => buildMonthGrid(focusedMonth), [focusedMonth]);

  const currentMonthAvailableDates = useMemo(() => {
    return Object.entries(dayStatuses)
      .filter(([isoDate, status]) => status === "available" && isSameMonth(parseISO(isoDate), focusedMonth))
      .map(([isoDate]) => isoDate)
      .sort((a, b) => a.localeCompare(b));
  }, [dayStatuses, focusedMonth]);

  const toggleDaySelection = (isoDate: string) => {
    setSelectedDates((prev) =>
      prev.includes(isoDate) ? prev.filter((date) => date !== isoDate) : [...prev, isoDate],
    );
  };

  const markSelection = (status: DayStatus) => {
    if (!selectedDates.length) return;

    setDayStatuses((prev) => {
      const next = { ...prev };
      selectedDates.forEach((date) => {
        next[date] = status;
      });
      return next;
    });
    setSelectedDates([]);
  };

  const removeAvailableDate = (isoDate: string) => {
    setDayStatuses((prev) => {
      const next = { ...prev };
      delete next[isoDate];
      return next;
    });
  };

  const toggleSlot = (roundId: string, slot: string) => {
    setRounds((prev) =>
      prev.map((round) =>
        round.id === roundId
          ? {
              ...round,
              activeSlots: round.activeSlots.includes(slot)
                ? round.activeSlots.filter((item) => item !== slot)
                : [...round.activeSlots, slot],
            }
          : round,
      ),
    );
  };

  return (
    <div className="min-h-screen bg-[#040712] text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.20),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.08),transparent_22%),linear-gradient(180deg,#050816_0%,#040712_100%)]" />

      <div className="relative z-10 mx-auto max-w-[1520px] px-4 py-4 md:px-6 md:py-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
          <div className="space-y-6">
            <Card className="border border-violet-500/35 bg-[#111523]/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)] rounded-2xl">
              <div className="p-6 md:p-7">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md border border-violet-500/35 bg-violet-500/10 p-1.5 text-violet-300">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <h1 className="text-[22px] font-semibold tracking-tight text-white">
                      Interview Availability Calendar
                    </h1>
                    <p className="mt-3 text-sm text-slate-400">
                      Select dates and mark them Available or Not Available. Candidates see only available dates when booking.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setFocusedMonth((month) => addMonths(month, -1))}
                    className="grid h-8 w-8 place-items-center rounded-xl bg-[#22293b] text-slate-200 transition hover:bg-[#2a3247]"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="text-[18px] font-semibold text-slate-100">
                    {format(focusedMonth, "MMMM yyyy")}
                  </div>

                  <button
                    type="button"
                    onClick={() => setFocusedMonth((month) => addMonths(month, 1))}
                    className="grid h-8 w-8 place-items-center rounded-xl bg-[#22293b] text-slate-200 transition hover:bg-[#2a3247]"
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-7 gap-1.5 text-center text-[13px] font-medium text-slate-400 md:gap-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                  {monthGrid.map((date) => {
                    const sameMonth = isSameMonth(date, focusedMonth);
                    const isoDate = toIsoDate(date);
                    const status = dayStatuses[isoDate];
                    const isSelected = selectedDates.includes(isoDate);

                    if (!sameMonth) {
                      return <div key={isoDate} className="h-10 rounded-xl md:h-[42px]" />;
                    }

                    const baseStyles =
                      "flex h-10 items-center justify-center rounded-xl border text-sm font-semibold transition-all duration-200 md:h-[42px]";

                    const statusStyles =
                      status === "available"
                        ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-200"
                        : status === "not_available"
                          ? "border-rose-500/45 bg-rose-500/10 text-rose-200"
                          : "border-[#2c3548] bg-[#18202e] text-slate-500";

                    const selectedStyles = isSelected
                      ? "border-violet-400 bg-[#1d2434] text-slate-100 ring-1 ring-violet-400/60"
                      : "";

                    return (
                      <button
                        key={isoDate}
                        type="button"
                        onClick={() => toggleDaySelection(isoDate)}
                        className={cn(baseStyles, statusStyles, selectedStyles, "hover:border-slate-400/60")}
                        aria-pressed={isSelected}
                        title={formatDisplayDate(isoDate)}
                      >
                        {format(date, "d")}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-600/50 bg-[#131a28] p-4 md:p-5">
                  <p className="text-sm text-slate-400">Click on dates to select them</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => markSelection("available")}
                      disabled={!selectedDates.length}
                      className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-emerald-900/50 disabled:text-emerald-200/60"
                    >
                      <Check className="h-4 w-4" />
                      Mark Available
                    </Button>
                    <Button
                      type="button"
                      onClick={() => markSelection("not_available")}
                      disabled={!selectedDates.length}
                      className="h-11 rounded-xl bg-rose-700 px-5 text-sm font-semibold text-white hover:bg-rose-600 disabled:bg-rose-950/50 disabled:text-rose-200/60"
                    >
                      <X className="h-4 w-4" />
                      Mark Not Available
                    </Button>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-slate-400">
                  <LegendItem color="bg-emerald-500" label="Available" />
                  <LegendItem color="bg-rose-500" label="Not Available" />
                  <LegendItem color="bg-violet-400" label="Selected" />
                  <LegendItem color="bg-slate-700" label="Not Set" />
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border border-slate-600/50 bg-[#111523]/95 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
              <div className="p-6 md:p-7">
                <h2 className="text-[18px] font-semibold text-white">
                  Available Dates ({currentMonthAvailableDates.length})
                </h2>
                <div className="mt-5 space-y-3">
                  {currentMonthAvailableDates.length ? (
                    currentMonthAvailableDates.map((isoDate) => (
                      <div
                        key={isoDate}
                        className="flex items-center justify-between rounded-2xl border border-slate-600/50 bg-[#182130] px-4 py-4"
                      >
                        <div className="flex items-center gap-3">
                          <CalendarDays className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm font-medium text-slate-100">
                            {formatDisplayDate(isoDate)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAvailableDate(isoDate)}
                          className="rounded-lg p-2 text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                          aria-label={`Remove ${formatDisplayDate(isoDate)}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-600/60 bg-[#182130] px-4 py-8 text-sm text-slate-400">
                      No available dates yet. Select one or more dates above and mark them available.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-2xl border border-violet-500/35 bg-[#111523]/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)] min-h-[98px]">
              <div className="flex items-center gap-3 p-6 md:p-7">
                <div className="grid h-9 w-9 place-items-center rounded-md border border-violet-400/45 bg-violet-500/10 text-violet-300">
                  <Mail className="h-4 w-4" />
                </div>
                <h2 className="text-[18px] font-semibold text-white">Interview Bookings</h2>
              </div>
            </Card>

            <Card className="rounded-2xl border border-cyan-500/35 bg-[#111523]/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="p-6 md:p-7">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md border border-cyan-400/40 bg-cyan-500/10 p-1.5 text-cyan-300">
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-[18px] font-semibold text-white">Time Slot Control</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Toggle which time slots candidates can book for each round.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  {rounds.map((round) => (
                    <div
                      key={round.id}
                      className={cn(
                        "rounded-2xl border bg-[#141a28] p-4 md:p-5",
                        round.border,
                      )}
                    >
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <div className={cn("text-[15px] font-semibold", round.accent)}>
                            {round.title}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {round.duration} - {round.activeSlots.length}/{round.slots.length} active
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {round.slots.map((slot) => {
                          const active = round.activeSlots.includes(slot);
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => toggleSlot(round.id, slot)}
                              className={cn(
                                "rounded-md border px-3 py-1.5 text-[13px] font-semibold transition-all",
                                active
                                  ? "border-emerald-500/70 bg-emerald-500/20 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]"
                                  : "border-slate-500/40 bg-[#1a2230] text-slate-500 hover:border-slate-400/70 hover:text-slate-300",
                              )}
                              aria-pressed={active}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-4 w-4 rounded-[4px] border border-white/10", color)} />
      <span>{label}</span>
    </div>
  );
}

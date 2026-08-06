import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Granularity } from "@/lib/reports/transactionReport";

// PresetKey/PresetDef/REPORT_PRESETS nay ở ./reportPresets — re-export type để
// call site cũ không phải đổi (re-export CHỈ type không vi phạm react-refresh).
import { REPORT_PRESETS, type PresetDef, type PresetKey } from "./reportPresets";
// Re-export type cho call site cũ (re-export CHỈ type không vi phạm react-refresh).
export type { PresetKey, PresetDef } from "./reportPresets";

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "day", label: "Theo ngày" },
  { key: "week", label: "Theo tuần" },
  { key: "month", label: "Theo tháng" },
];

const pill = (active: boolean) =>
  [
    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
    active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground",
  ].join(" ");

interface Props {
  range: DateRange;
  preset: PresetKey;
  granularity: Granularity;
  onPresetChange: (p: PresetKey) => void;
  onRangeChange: (r: DateRange) => void;
  onGranularityChange: (g: Granularity) => void;
  presets?: PresetDef[];
  showGranularity?: boolean;
  calOpen: boolean;
  onCalOpenChange: (open: boolean) => void;
}

export default function DateRangeGranularityBar({
  range,
  preset,
  granularity,
  onPresetChange,
  onRangeChange,
  onGranularityChange,
  presets = REPORT_PRESETS,
  showGranularity = true,
  calOpen,
  onCalOpenChange,
}: Props) {
  const isCustom = preset === "custom";
  const customLabel =
    isCustom && range.from && range.to
      ? `${format(range.from, "dd/MM/yyyy")} – ${format(range.to, "dd/MM/yyyy")}`
      : "Tùy chọn";

  const handleCalendarSelect = (r: DateRange | undefined) => {
    if (!r) return;
    onPresetChange("custom");
    onRangeChange(r);
    if (r.from && r.to) onCalOpenChange(false);
  };

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      {/* Presets + custom */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              onPresetChange(p.key);
              onRangeChange(p.range());
            }}
            className={pill(preset === p.key)}
          >
            {p.label}
          </button>
        ))}
        <Popover open={calOpen} onOpenChange={onCalOpenChange}>
          <PopoverTrigger asChild>
            <button className={`flex items-center gap-1.5 ${pill(isCustom)}`}>
              <CalendarIcon className="h-3 w-3" />
              {customLabel}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={range}
              onSelect={handleCalendarSelect}
              disabled={{ after: new Date() }}
              locale={vi}
              numberOfMonths={2}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Granularity */}
      {showGranularity && (
        <div className="flex items-center gap-1.5">
          {GRANULARITIES.map((g) => (
            <button key={g.key} onClick={() => onGranularityChange(g.key)} className={pill(granularity === g.key)}>
              {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

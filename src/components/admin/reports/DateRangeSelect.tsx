import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, ChevronsUpDown, Check, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { REPORT_PRESETS, type PresetDef, type PresetKey } from "./reportPresets";

interface Props {
  range: DateRange;
  preset: PresetKey;
  onPresetChange: (p: PresetKey) => void;
  onRangeChange: (r: DateRange) => void;
  presets?: PresetDef[];
  className?: string;
}

/**
 * Bộ lọc thời gian dạng DROPDOWN — để đứng cùng hàng với các bộ lọc khác thay
 * vì chiếm nguyên một hàng nút như DateRangeGranularityBar.
 *
 * MỘT popover duy nhất, đổi nội dung giữa danh sách preset và lịch: dùng hai
 * popover thì cái thứ hai không có phần tử neo thật, vị trí sẽ lệch.
 *
 * KHÔNG kèm granularity: Ngày/Tuần/Tháng chỉ ảnh hưởng biểu đồ chuỗi thời gian
 * nên được đặt ngay trên biểu đồ đó, không phải ở thanh lọc cấp trang.
 */
export default function DateRangeSelect({
  range,
  preset,
  onPresetChange,
  onRangeChange,
  presets = REPORT_PRESETS,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"presets" | "calendar">("presets");

  const isCustom = preset === "custom";
  const label = isCustom
    ? range.from && range.to
      ? `${format(range.from, "dd/MM/yyyy")} – ${format(range.to, "dd/MM/yyyy")}`
      : "Tùy chọn"
    : (presets.find((p) => p.key === preset)?.label ?? "Chọn khoảng");

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setView("presets"); // mở lại luôn bắt đầu từ danh sách preset
  };

  const handleCalendarSelect = (r: DateRange | undefined) => {
    if (!r) return;
    onPresetChange("custom");
    onRangeChange(r);
    if (r.from && r.to) handleOpenChange(false);
  };

  const item =
    "w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-between gap-2 font-normal min-w-[180px] max-w-[280px]",
            isCustom && "border-primary/40 bg-primary/5",
            className,
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="text-muted-foreground">Thời gian:</span>
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={view === "calendar" ? "w-auto p-0" : "w-[220px] p-1"}
        align="start"
      >
        {view === "calendar" ? (
          <div>
            <button
              onClick={() => setView("presets")}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border-b border-border"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Khoảng dựng sẵn
            </button>
            <Calendar
              mode="range"
              selected={range}
              onSelect={handleCalendarSelect}
              disabled={{ after: new Date() }}
              locale={vi}
              numberOfMonths={2}
              initialFocus
            />
          </div>
        ) : (
          <>
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  onPresetChange(p.key);
                  onRangeChange(p.range());
                  handleOpenChange(false);
                }}
                className={item}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    preset === p.key ? "opacity-100 text-primary" : "opacity-0",
                  )}
                />
                {p.label}
              </button>
            ))}
            <div className="my-1 border-t border-border" />
            <button onClick={() => setView("calendar")} className={item}>
              <Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  isCustom ? "opacity-100 text-primary" : "opacity-0",
                )}
              />
              Tùy chọn…
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

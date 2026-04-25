import { useMemo, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  formatPeriodLabel,
  getAvailablePeriods,
  parsePeriod,
  type PeriodKind,
} from "@/lib/reportPeriods";

interface PeriodPickerCompactProps {
  value: string;
  onChange: (periodId: string) => void;
  className?: string;
  label?: string;
}

/**
 * Bộ chọn kỳ FREE — không có giá / khóa / badge mua.
 * Dùng cho báo cáo tổng quan (/report) — mọi kỳ đều mở.
 */
export const PeriodPickerCompact = ({
  value,
  onChange,
  className,
  label = "Kỳ báo cáo:",
}: PeriodPickerCompactProps) => {
  const all = getAvailablePeriods();

  const detectKind = (id: string): PeriodKind => {
    if (id.startsWith("m-")) return "month";
    if (id.startsWith("q-")) return "quarter";
    return "year";
  };

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PeriodKind>(detectKind(value));

  const allYears = useMemo(() => {
    const ys = new Set<number>();
    all.months.forEach((m) => {
      const p = parsePeriod(m);
      if (p) ys.add(p.year);
    });
    all.years.forEach((y) => {
      const p = parsePeriod(y);
      if (p) ys.add(p.year);
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [all]);

  const currentParsed = parsePeriod(value);
  const [yearFilter, setYearFilter] = useState<number>(
    currentParsed?.year ?? allYears[0],
  );

  const periods = useMemo(() => {
    if (tab === "year") return all.years;
    if (tab === "month") {
      return all.months.filter((m) => parsePeriod(m)?.year === yearFilter);
    }
    return all.quarters.filter((q) => parsePeriod(q)?.year === yearFilter);
  }, [tab, all, yearFilter]);

  const handleSelect = (pid: string) => {
    onChange(pid);
    setOpen(false);
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2",
        className,
      )}
    >
      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs font-semibold text-muted-foreground shrink-0">
        {label}
      </span>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 px-3 font-semibold"
          >
            <span>{formatPeriodLabel(value)}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[340px] p-3" align="start">
          <Tabs value={tab} onValueChange={(v) => setTab(v as PeriodKind)}>
            <TabsList className="grid w-full grid-cols-3 h-8">
              <TabsTrigger value="month" className="text-xs">Tháng</TabsTrigger>
              <TabsTrigger value="quarter" className="text-xs">Quý</TabsTrigger>
              <TabsTrigger value="year" className="text-xs">Năm</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab !== "year" && (
            <div className="flex items-center justify-between mt-3 mb-2">
              <span className="text-xs font-semibold text-foreground">
                {tab === "month" ? "Chọn tháng" : "Chọn quý"}
              </span>
              <Select
                value={String(yearFilter)}
                onValueChange={(v) => setYearFilter(Number(v))}
              >
                <SelectTrigger className="h-7 w-[100px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allYears.map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs">
                      Năm {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div
            className={cn(
              "grid gap-1.5 mt-2",
              tab === "month" ? "grid-cols-4" : "grid-cols-2",
            )}
          >
            {periods.map((pid) => {
              const isCurrent = pid === value;
              const shortLabel =
                tab === "month"
                  ? `T${formatPeriodLabel(pid).split(" ")[1]}`
                  : tab === "quarter"
                  ? formatPeriodLabel(pid).replace("Quý ", "Q")
                  : formatPeriodLabel(pid);

              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => handleSelect(pid)}
                  className={cn(
                    "rounded border px-2 py-1.5 text-left transition-all",
                    isCurrent
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-card hover:border-primary/50 hover:bg-muted/30",
                  )}
                >
                  <p className="text-xs font-semibold text-foreground leading-tight">
                    {shortLabel}
                  </p>
                  {isCurrent && (
                    <p className="text-[10px] text-primary mt-0.5">Đang xem</p>
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

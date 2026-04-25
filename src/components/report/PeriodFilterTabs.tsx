import { useMemo, useState } from "react";
import { Calendar, Check, ChevronDown, Coins, Lock, Sparkles } from "lucide-react";
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
import { useCredits } from "@/hooks/useCredits";
import {
  formatPeriodLabel,
  getAvailablePeriods,
  parsePeriod,
  type PeriodKind,
} from "@/lib/reportPeriods";

interface PeriodFilterTabsProps {
  reportSlug: string;
  currentPeriodId: string;
  onSelectUnlocked: (periodId: string) => void;
  onSelectLocked: (periodId: string) => void;
}

export const PeriodFilterTabs = ({
  reportSlug,
  currentPeriodId,
  onSelectUnlocked,
  onSelectLocked,
}: PeriodFilterTabsProps) => {
  const { isReportPeriodUnlocked, getUnlockedPeriodsForReport, DEEP_REPORT_PERIOD_PRICES } =
    useCredits();
  const all = getAvailablePeriods();

  const detectKind = (id: string): PeriodKind => {
    if (id.startsWith("m-")) return "month";
    if (id.startsWith("q-")) return "quarter";
    return "year";
  };

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PeriodKind>(detectKind(currentPeriodId));

  // Năm đang xem trong popover (chỉ áp dụng tab Tháng/Quý)
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

  const currentParsed = parsePeriod(currentPeriodId);
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

  const cost = DEEP_REPORT_PERIOD_PRICES[tab];
  const unlockedCount = getUnlockedPeriodsForReport(reportSlug).length;
  const totalCount = all.months.length + all.quarters.length + all.years.length;
  const currentUnlocked = isReportPeriodUnlocked(reportSlug, currentPeriodId);

  const handleSelect = (pid: string) => {
    if (isReportPeriodUnlocked(reportSlug, pid)) {
      onSelectUnlocked(pid);
    } else {
      onSelectLocked(pid);
    }
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs font-semibold text-muted-foreground shrink-0">
        Kỳ báo cáo:
      </span>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 px-3 font-semibold"
          >
            <span>{formatPeriodLabel(currentPeriodId)}</span>
            {currentUnlocked ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                <Check className="h-2.5 w-2.5" />
                Đã mở
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                <Lock className="h-2.5 w-2.5" />
                Khóa
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[360px] p-3" align="start">
          {/* Tabs Tháng / Quý / Năm */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as PeriodKind)}>
            <TabsList className="grid w-full grid-cols-3 h-8">
              <TabsTrigger value="month" className="text-xs">Tháng</TabsTrigger>
              <TabsTrigger value="quarter" className="text-xs">Quý</TabsTrigger>
              <TabsTrigger value="year" className="text-xs">Năm</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Year selector cho Tháng / Quý */}
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

          {/* Grid kỳ */}
          <div
            className={cn(
              "grid gap-1.5 mt-2",
              tab === "month"
                ? "grid-cols-4"
                : tab === "quarter"
                ? "grid-cols-2"
                : "grid-cols-2",
            )}
          >
            {periods.map((pid) => {
              const unlocked = isReportPeriodUnlocked(reportSlug, pid);
              const isCurrent = pid === currentPeriodId;
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
                      : unlocked
                      ? "border-primary/40 bg-primary/5 hover:border-primary"
                      : "border-dashed border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40",
                  )}
                >
                  <p className="text-xs font-semibold text-foreground leading-tight">
                    {shortLabel}
                  </p>
                  {unlocked ? (
                    <p className="text-[10px] text-primary inline-flex items-center gap-0.5 mt-0.5">
                      <Check className="h-2.5 w-2.5" />
                      {isCurrent ? "Đang xem" : "Đã mở"}
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5 mt-0.5">
                      <Coins className="h-2.5 w-2.5" />
                      {cost.toLocaleString("vi-VN")}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Hint upgrade */}
          {tab !== "year" && (
            <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                {tab === "quarter"
                  ? "Mua 1 Quý = mở 3 Tháng"
                  : "Mua 1 Năm = mở 12 Tháng"}
              </span>
              <button
                type="button"
                className="text-primary font-semibold hover:underline"
                onClick={() => setTab(tab === "month" ? "quarter" : "year")}
              >
                Xem {tab === "month" ? "Quý" : "Năm"} →
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
        {unlockedCount}/{totalCount} kỳ đã mở
      </span>
    </div>
  );
};

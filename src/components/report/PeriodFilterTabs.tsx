import { useState } from "react";
import { Check, Coins, Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useCredits } from "@/hooks/useCredits";
import {
  formatPeriodLabel,
  getAvailablePeriods,
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
  const { isReportPeriodUnlocked, DEEP_REPORT_PERIOD_PRICES } = useCredits();
  const all = getAvailablePeriods();

  // Suy ra tab mặc định từ kỳ đang chọn
  const detectKind = (id: string): PeriodKind => {
    if (id.startsWith("m-")) return "month";
    if (id.startsWith("q-")) return "quarter";
    return "year";
  };
  const [tab, setTab] = useState<PeriodKind>(detectKind(currentPeriodId));

  const periods = tab === "month" ? all.months : tab === "quarter" ? all.quarters : all.years;
  const cost = DEEP_REPORT_PERIOD_PRICES[tab];

  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Chọn kỳ báo cáo
          </p>
          <p className="text-sm text-foreground">
            Mỗi kỳ mua 1 lần, mở khóa{" "}
            <span className="font-semibold">vĩnh viễn</span>.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as PeriodKind)}>
          <TabsList>
            <TabsTrigger value="month">Tháng</TabsTrigger>
            <TabsTrigger value="quarter">Quý</TabsTrigger>
            <TabsTrigger value="year">Năm</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {periods.map((pid, idx) => {
          const unlocked = isReportPeriodUnlocked(reportSlug, pid);
          const isCurrent = pid === currentPeriodId;
          const isLatest = idx === 0;

          return (
            <button
              key={pid}
              type="button"
              onClick={() => (unlocked ? onSelectUnlocked(pid) : onSelectLocked(pid))}
              className={cn(
                "relative text-left p-3 rounded-lg border-2 transition-all",
                isCurrent && unlocked
                  ? "border-primary bg-primary/5 shadow-sm"
                  : unlocked
                  ? "border-border bg-card hover:border-primary/40"
                  : "border-dashed border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              {isLatest && !unlocked && (
                <span className="absolute -top-2 left-3 text-[10px] font-bold uppercase bg-accent text-accent-foreground px-1.5 py-0.5 rounded">
                  Mới
                </span>
              )}
              {unlocked && (
                <span className="absolute -top-2 right-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                  <Check className="h-2.5 w-2.5" />
                  Đã mở
                </span>
              )}

              <p className="text-sm font-semibold text-foreground">
                {formatPeriodLabel(pid)}
              </p>

              {unlocked ? (
                <p className="text-[11px] text-primary mt-1 inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Vĩnh viễn
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  <Coins className="h-3 w-3" />
                  {cost.toLocaleString("vi-VN")}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {tab !== "month" && (
        <div className="mt-3 flex items-center gap-2">
          <Badge variant="secondary" className="font-normal text-[11px]">
            <Sparkles className="h-3 w-3 mr-1" />
            {tab === "quarter"
              ? "Mua 1 Quý mở luôn 3 Tháng bên trong"
              : "Mua 1 Năm mở luôn 4 Quý + 12 Tháng"}
          </Badge>
        </div>
      )}
    </div>
  );
};

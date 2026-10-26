import { useMemo, useState } from "react";
import { FileBarChart, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroFigure } from "@/components/asset-owner-portal/ui/HeroFigure";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { usePlanPeriod } from "@/hooks/useAuctionPlanPeriod";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { planHealthToday } from "@/lib/auctionPlan/health";
import {
  defaultPlanPeriod,
  parsePlanPeriodKey,
  planPeriodItems,
  planPeriodKey,
  planPeriodLabel,
  planPeriodOptions,
} from "@/lib/auctionPlan/period";
import type { AuctionPlan, AuctionPlanItem } from "@/lib/auctionPlan/types";
import { formatMoneyShort, moneyShortParts } from "@/utils/money";
import { GeneratePlanTargetsDialog } from "./GeneratePlanTargetsDialog";
import { PlanPeriodChart } from "./PlanPeriodChart";
import { PlanPeriodItemsTable } from "./PlanPeriodItemsTable";
import { PlanPeriodStats } from "./PlanPeriodStats";

export interface PlanPeriodTabProps {
  plan: AuctionPlan;
  items: readonly AuctionPlanItem[];
  isLoading: boolean;
  /** `chi-tieu:create` — điều kiện hiện nút "Tạo chỉ tiêu từ kế hoạch". */
  canCreateTarget: boolean;
}

/**
 * Tab "Theo kỳ" (A6): L1 câu trả lời của kỳ → L3 ô chỉ số + biểu đồ 12 tháng →
 * L4 bảng tài sản của kỳ.
 *
 * Số tính Ở CLIENT bằng `planVsActual` (A5); bản sao SQL
 * `auction_plan_period_metrics` có test đối chiếu 68 cặp trên mẫu demo, nên con
 * số ở đây, ở báo cáo định kỳ và ở roll-up tỉnh là một.
 *
 * Cột KẾ HOẠCH đọc BẢN MỐC mới nhất — không phải danh mục hiện tại. Kế hoạch
 * chưa từng duyệt thì dùng tháng / giá trị đang có và có một dòng nói rõ.
 */
export function PlanPeriodTab({ plan, items, isLoading, canCreateTarget }: PlanPeriodTabProps) {
  const options = useMemo(() => planPeriodOptions(plan.plan_year), [plan.plan_year]);
  const fallback = useMemo(() => planPeriodKey(defaultPlanPeriod(plan.plan_year, planHealthToday())), [plan.plan_year]);
  const [filters, setFilter] = useUrlFilterState(
    { ky: fallback },
    { ky: options.map((o) => o.key) },
  );
  const period = useMemo(() => parsePlanPeriodKey(filters.ky) ?? parsePlanPeriodKey(fallback)!, [filters.ky, fallback]);
  const [targetsOpen, setTargetsOpen] = useState(false);

  const { rows, metrics, series, quarterGoals, hasBaseline, isLoading: periodLoading } = usePlanPeriod(plan, items, period);
  const periodItems = useMemo(() => planPeriodItems(rows, period), [rows, period]);
  const label = planPeriodLabel(period);

  if (isLoading || periodLoading) {
    return (
      <SectionCard title="Theo kỳ" icon={FileBarChart}>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[104px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-60 w-full rounded-2xl" />
        </div>
      </SectionCard>
    );
  }

  const collected = moneyShortParts(metrics.collected);

  return (
    <>
      <div className="space-y-6">
        <OwnerFilterBar>
          <OwnerFilterSelect label="Kỳ" value={planPeriodKey(period)} onValueChange={(v) => setFilter("ky", v)}>
            {options.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                {o.label}
              </SelectItem>
            ))}
          </OwnerFilterSelect>
          {canCreateTarget && plan.status === "approved" && (
            <Button variant="outline" onClick={() => setTargetsOpen(true)}>
              <Target />
              Tạo chỉ tiêu từ kế hoạch
            </Button>
          )}
        </OwnerFilterBar>

        <HeroFigure
          label={`Kết quả ${label}`}
          value={`${metrics.soldCount}/${metrics.plannedCount}`}
          unit="tài sản đấu thành"
          progress={metrics.donePct === null ? undefined : Math.min(100, metrics.donePct)}
          context={
            <span>
              Đã thu{" "}
              <strong className="font-semibold text-foreground tabular-nums">
                {collected.value} {collected.unit}
              </strong>{" "}
              / {formatMoneyShort(metrics.plannedStartValue)} giá khởi điểm dự kiến
              {metrics.donePct !== null ? ` · hoàn thành ${metrics.donePct}%` : ""}
            </span>
          }
        />

        {!hasBaseline && (
          <p className="text-xs text-muted-foreground">
            Kế hoạch chưa từng được phê duyệt nên cột kế hoạch lấy theo danh mục hiện tại. Sau khi được duyệt, con số
            so sánh sẽ là bản mốc đã đóng băng.
          </p>
        )}

        <PlanPeriodStats metrics={metrics} />

        <PlanPeriodChart series={series} planYear={plan.plan_year} />

        <PlanPeriodItemsTable items={periodItems} periodLabel={label} />
      </div>

      <GeneratePlanTargetsDialog open={targetsOpen} onOpenChange={setTargetsOpen} plan={plan} goals={quarterGoals} />
    </>
  );
}

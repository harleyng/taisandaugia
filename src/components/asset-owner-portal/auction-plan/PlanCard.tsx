import { useNavigate } from "react-router-dom";
import { CalendarRange, ChevronRight } from "lucide-react";
import { IconTile } from "@/components/asset-owner-portal/ui/IconTile";
import { formatMoneyShort } from "@/utils/money";
import { ownerPlanHref } from "@/lib/auctionPlan/routes";
import { AUCTION_PLAN_KIND_LABELS, auctionPlanAutoTitle, type AuctionPlan } from "@/lib/auctionPlan/types";
import type { PlanTotals } from "@/lib/auctionPlan/totals";
import { PlanStatusChip } from "./PlanStatusChip";

interface PlanCardProps {
  plan: AuctionPlan;
  totals: PlanTotals;
  /** Nhãn đơn vị lập kế hoạch ("Toàn đơn vị" / tên chi nhánh) + tên ĐVHC nếu biết. */
  unitLabel: string;
  loading?: boolean;
}

/** Một kế hoạch = một thẻ-dòng; bấm vào mở trang chi tiết (không dùng Button asChild + Link). */
export function PlanCard({ plan, totals, unitLabel, loading }: PlanCardProps) {
  const navigate = useNavigate();
  const title = plan.title?.trim() || auctionPlanAutoTitle(plan.plan_year, unitLabel);

  return (
    <button
      type="button"
      onClick={() => navigate(ownerPlanHref(plan.id))}
      className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-card transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
    >
      <IconTile icon={CalendarRange} tone={plan.status === "returned" ? "destructive" : "primary"} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{title}</span>
          <PlanStatusChip status={plan.status} />
          {plan.kind === "supplement" && (
            <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground">
              {AUCTION_PLAN_KIND_LABELS.supplement}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {unitLabel}
          {loading ? (
            " · đang tính…"
          ) : (
            <>
              {" · "}
              <span className="tabular-nums">{totals.count}</span> tài sản
              {totals.expected > 0 && <> · {formatMoneyShort(totals.expected)} dự kiến</>}
              {totals.withoutMonth > 0 && (
                <span className="text-warning">
                  {" · "}
                  <span className="tabular-nums">{totals.withoutMonth}</span> chưa có tháng
                </span>
              )}
              {plan.baseline_version > 0 && <> · bản mốc v{plan.baseline_version}</>}
            </>
          )}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}

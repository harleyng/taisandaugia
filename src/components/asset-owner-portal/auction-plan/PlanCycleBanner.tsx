import { CalendarClock, Clock } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { formatMoneyShort } from "@/utils/money";
import { AUCTION_PLAN_KIND_LABELS } from "@/lib/auctionPlan/types";
import { daysToDeadline, deadlineText, type PlanCycleContext } from "@/lib/auctionPlan/cycles";

const formatDay = (iso: string) => iso.split("-").reverse().join("/");

interface PlanCycleBannerProps {
  cycle: PlanCycleContext;
  today: string;
}

/**
 * "Tỉnh yêu cầu trình trước 15/12/2026" — bảng thông báo của đợt lập kế hoạch,
 * kèm chỉ tiêu thu được giao cho chính đơn vị này (nếu đợt có giao).
 *
 * Đợt và dòng giao việc là dữ liệu CHỈ ĐỌC với client: bảng này không có một
 * thao tác ghi nào (mở / đóng đợt, giao chỉ tiêu là của cấp tỉnh — Phase 7).
 */
export function PlanCycleBanner({ cycle: { cycle, unit }, today }: PlanCycleBannerProps) {
  const days = daysToDeadline(cycle.submit_deadline, today);
  const overdue = days !== null && days < 0;
  const text = deadlineText(days);

  return (
    <SectionCard
      title={`${AUCTION_PLAN_KIND_LABELS[cycle.kind]} ${cycle.plan_year} · cấp trên đã mở đợt lập kế hoạch`}
      icon={CalendarClock}
      tone={overdue ? "destructive" : "primary"}
    >
      <div className="space-y-3">
        {cycle.submit_deadline && (
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Clock
              className={overdue ? "h-4 w-4 shrink-0 text-destructive" : "h-4 w-4 shrink-0 text-muted-foreground"}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <span>
              Hạn trình: <span className="font-semibold">{formatDay(cycle.submit_deadline)}</span>
              {text && <span className={overdue ? "text-destructive" : "text-muted-foreground"}> · {text}</span>}
            </span>
          </p>
        )}

        {unit && (unit.assigned_revenue !== null || unit.assigned_count !== null) && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-muted/40 px-3 py-2.5">
            {unit.assigned_revenue !== null && (
              <p className="text-sm">
                <span className="text-xs text-muted-foreground">Chỉ tiêu thu giao</span>
                <span className="ml-2 font-semibold tabular-nums">{formatMoneyShort(unit.assigned_revenue)}</span>
              </p>
            )}
            {unit.assigned_count !== null && (
              <p className="text-sm">
                <span className="text-xs text-muted-foreground">Số tài sản giao</span>
                <span className="ml-2 font-semibold tabular-nums">{unit.assigned_count}</span>
              </p>
            )}
          </div>
        )}

        {cycle.instructions && (
          <p className="whitespace-pre-line text-sm text-muted-foreground">{cycle.instructions}</p>
        )}
        {!unit && (
          <p className="text-xs text-muted-foreground">
            Đợt này chưa gọi tên đơn vị của bạn — vẫn lập và trình kế hoạch được như bình thường.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

import { useNavigate } from "react-router-dom";
import { CalendarRange, History, KanbanSquare, Loader2, LandPlot, Send, Undo2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { StatTile } from "@/components/asset-owner-portal/ui/StatTile";
import { ReadOnlyNote } from "@/components/asset-owner-portal/pulse/PulseListParts";
import { moneyShortParts } from "@/utils/money";
import { ownerPlanTabHref } from "@/lib/auctionPlan/routes";
import { planNextAction, type PlanTotals } from "@/lib/auctionPlan/totals";
import {
  AUCTION_PLAN_KIND_LABELS,
  AUCTION_PLAN_LEVEL_LABELS,
  auctionPlanAutoTitle,
  type AuctionPlan,
} from "@/lib/auctionPlan/types";
import { PlanReviewActions } from "../approval/PlanReviewActions";
import { PlanStatusChip } from "../PlanStatusChip";

interface PlanDetailHeaderProps {
  plan: AuctionPlan;
  totals: PlanTotals;
  /** "Toàn đơn vị" hoặc tên chi nhánh. */
  unitLabel: string;
  /** Tên đơn vị hành chính của kế hoạch ("Xã Tân Dĩnh, Tỉnh Bắc Ninh"). */
  adminUnitLabel: string | null;
  canFinalize: boolean;
  canReopen: boolean;
  reopening: boolean;
  onSubmit: () => void;
  onReopen: () => void;
}

/**
 * Đầu trang chi tiết: tên · viên trạng thái · đơn vị · ba ô tổng · MỘT nút
 * chính theo trạng thái (§A8.10 "một nút chính mỗi màn").
 *
 * Nút "Ghi nhận phê duyệt" / "Trả lại" (cấp trên) và "Điều chỉnh kế hoạch" (đơn
 * vị lập) nằm trong `PlanReviewActions` — component đó tự hỏi
 * `auction_plan_reviewer_ok` nên trang chi tiết không phải truyền thêm props.
 */
export function PlanDetailHeader({
  plan,
  totals,
  unitLabel,
  adminUnitLabel,
  canFinalize,
  canReopen,
  reopening,
  onSubmit,
  onReopen,
}: PlanDetailHeaderProps) {
  const navigate = useNavigate();
  const next = planNextAction(plan.status);
  const expected = moneyShortParts(totals.expected);
  const title = plan.title?.trim() || auctionPlanAutoTitle(plan.plan_year, unitLabel);

  const actions = (() => {
    if (next === "submit") {
      return canFinalize ? (
        <Button className="gap-1.5" onClick={onSubmit}>
          <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Trình kế hoạch
        </Button>
      ) : (
        <ReadOnlyNote>Bạn không có quyền trình kế hoạch.</ReadOnlyNote>
      );
    }
    if (next === "reopen") {
      // `returned` KHÔNG mở khoá trường mốc — phải mở lại về nháp mới sửa được.
      return canReopen ? (
        <Button className="gap-1.5" disabled={reopening} onClick={onReopen}>
          {reopening ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Undo2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          Mở lại để sửa
        </Button>
      ) : (
        <ReadOnlyNote>Kế hoạch bị trả lại — cần người có quyền sửa mở lại.</ReadOnlyNote>
      );
    }
    if (next === "closed") return <ReadOnlyNote>Kế hoạch đã đóng.</ReadOnlyNote>;
    // `waiting` (đã trình) và `approved`: hành động của cấp trên / của đơn vị lập.
    return <PlanReviewActions plan={plan} canFinalize={canFinalize} />;
  })();

  return (
    <div className="space-y-5">
      <OwnerPageHeader
        title={title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <PlanStatusChip status={plan.status} />
            <span>
              {AUCTION_PLAN_KIND_LABELS[plan.kind]} · {AUCTION_PLAN_LEVEL_LABELS[plan.level]} · {unitLabel}
              {adminUnitLabel && ` · ${adminUnitLabel}`}
              {plan.baseline_version > 0 && ` · bản mốc v${plan.baseline_version}`}
            </span>
          </span>
        }
        actions={actions}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile
          label="Số tài sản"
          value={String(totals.count)}
          unit="tài sản"
          icon={KanbanSquare}
          context={totals.withoutMonth > 0 ? `${totals.withoutMonth} chưa có tháng dự kiến` : "Đã xếp kỳ đầy đủ"}
          tone={totals.withoutMonth > 0 ? "warning" : "primary"}
        />
        <StatTile
          label="Tổng diện tích"
          value={totals.area > 0 ? Math.round(totals.area).toLocaleString("en-US") : "—"}
          unit={totals.area > 0 ? "m²" : undefined}
          icon={LandPlot}
          context={totals.dropped > 0 ? `${totals.dropped} tài sản đã bỏ khỏi kế hoạch` : "Theo danh mục hiện tại"}
        />
        <StatTile
          label="Giá trị khởi điểm dự kiến"
          value={expected.value}
          unit={expected.unit}
          icon={Wallet}
          tone="primary"
          context={`Năm kế hoạch ${plan.plan_year}`}
        />
      </div>

      {plan.status === "returned" && plan.review_comment?.trim() && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-foreground sm:flex-row sm:items-start"
        >
          <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-destructive" strokeWidth={1.5} aria-hidden="true" />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">Cấp trên đã trả lại kế hoạch: </span>
            <span className="whitespace-pre-line">{plan.review_comment}</span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 self-start text-muted-foreground"
            onClick={() => navigate(ownerPlanTabHref(plan.id, "phe-duyet"))}
          >
            <History className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Xem lịch sử xử lý
          </Button>
        </div>
      )}
    </div>
  );
}

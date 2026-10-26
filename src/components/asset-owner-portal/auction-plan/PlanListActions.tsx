import { useNavigate } from "react-router-dom";
import { CalendarRange, CheckCircle2, Clock, Send, Stamp, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { usePlanCanApprove } from "@/hooks/useAuctionPlanApproval";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { formatPlanDate } from "@/lib/auctionPlan/print";
import { ownerPlanHref } from "@/lib/auctionPlan/routes";
import { auctionPlanAutoTitle, type AuctionPlan } from "@/lib/auctionPlan/types";
import type { PlanTotals } from "@/lib/auctionPlan/totals";
import { daysToDeadline, type PlanCycleContext } from "@/lib/auctionPlan/cycles";

interface PlanListActionsProps {
  plans: readonly AuctionPlan[];
  totalsOf: (planId: string) => PlanTotals;
  unitLabel: (branchId: string | null) => string;
  cycle: PlanCycleContext | null;
  today: string;
}

const MAX_VISIBLE = 5;

/**
 * Tầng L2 "việc cần làm" của trang danh sách (§A8.2): kế hoạch bị trả lại, kế
 * hoạch còn tài sản chưa chọn tháng, kế hoạch chưa trình khi đợt sắp hết hạn.
 *
 * Thẻ "chờ xem xét" chỉ hiện với NGƯỜI DUYỆT: quyền hỏi một lần cho cả Trạm
 * (`auction_plan_can_approve`) chứ không hỏi `reviewer_ok` từng kế hoạch — trang
 * danh sách chỉ liệt kê kế hoạch của Trạm đang chọn, nên hai cách cho cùng kết
 * quả ở hình A và rẻ hơn N lần gọi mạng. Chữ ký props giữ nguyên.
 */
export function PlanListActions({ plans, totalsOf, unitLabel, cycle, today }: PlanListActionsProps) {
  const navigate = useNavigate();
  const { workspaceId } = useOwnerWorkspace();
  const { data: canApprove } = usePlanCanApprove(workspaceId);
  const deadlineDays = daysToDeadline(cycle?.cycle.submit_deadline ?? null, today);
  const dueSoon = deadlineDays !== null && deadlineDays <= 30;

  const open = (plan: AuctionPlan) => (
    <Button size="sm" variant="outline" onClick={() => navigate(ownerPlanHref(plan.id))}>
      Mở kế hoạch
    </Button>
  );
  const nameOf = (plan: AuctionPlan) =>
    plan.title?.trim() || auctionPlanAutoTitle(plan.plan_year, unitLabel(plan.branch_id));

  const cards = plans.flatMap((plan) => {
    if (plan.status === "returned") {
      return [
        <ActionCard
          key={`${plan.id}-returned`}
          icon={Undo2}
          tone="destructive"
          title={`${nameOf(plan)} bị trả lại — xem góp ý`}
          meta={plan.review_comment?.trim() || "Mở kế hoạch để xem góp ý của cấp trên rồi sửa lại."}
          actions={open(plan)}
        />,
      ];
    }
    if (plan.status === "submitted") {
      // Thẻ của NGƯỜI DUYỆT: kế hoạch đã trình đang chờ mình xem xét.
      return canApprove
        ? [
            <ActionCard
              key={`${plan.id}-review`}
              icon={Stamp}
              tone="primary"
              title={`${nameOf(plan)} chờ xem xét`}
              meta={`Đơn vị trình ngày ${formatPlanDate(plan.submitted_at)} · ${totalsOf(plan.id).count} tài sản.`}
              actions={
                <Button size="sm" onClick={() => navigate(ownerPlanHref(plan.id))}>
                  Xem xét
                </Button>
              }
            />,
          ]
        : [];
    }
    if (plan.status !== "draft" && plan.status !== "adjusting") return [];
    const totals = totalsOf(plan.id);
    if (totals.withoutMonth > 0) {
      return [
        <ActionCard
          key={`${plan.id}-no-month`}
          icon={CalendarRange}
          tone="warning"
          title={`${totals.withoutMonth} tài sản chưa chọn tháng dự kiến`}
          meta={`${nameOf(plan)} — chưa chọn tháng thì không trình được.`}
          actions={open(plan)}
        />,
      ];
    }
    if (dueSoon && totals.count > 0) {
      return [
        <ActionCard
          key={`${plan.id}-due`}
          icon={deadlineDays !== null && deadlineDays < 0 ? Clock : Send}
          tone={deadlineDays !== null && deadlineDays < 0 ? "destructive" : "warning"}
          title={`${nameOf(plan)} chưa trình lên cấp trên`}
          meta={`${totals.count} tài sản đã sẵn sàng.`}
          actions={open(plan)}
        />,
      ];
    }
    return [];
  });

  return (
    <SectionCard title="Việc cần làm" icon={CheckCircle2} tone={cards.length ? "warning" : "success"} count={cards.length}>
      {cards.length === 0 ? (
        <EmptyState compact icon={CheckCircle2} tone="success" title="Không có việc tồn — tốt lắm." />
      ) : (
        <div className="space-y-2">{cards.slice(0, MAX_VISIBLE)}</div>
      )}
    </SectionCard>
  );
}

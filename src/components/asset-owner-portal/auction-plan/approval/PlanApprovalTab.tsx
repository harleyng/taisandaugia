import { useNavigate } from "react-router-dom";
import { MessageSquareWarning, PencilRuler, Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { usePlanBaselineDiff } from "@/hooks/useAuctionPlanApproval";
import { ownerPlanPrintHref } from "@/lib/auctionPlan/routes";
import { formatPlanDate } from "@/lib/auctionPlan/print";
import type { AuctionPlan } from "@/lib/auctionPlan/types";
import { PlanBaselinesCard } from "./PlanBaselinesCard";
import { PlanDiffSummary } from "./PlanDiffSummary";
import { PlanHistoryTimeline } from "./PlanHistoryTimeline";
import { PlanPublicCard } from "../public/PlanPublicCard";

export interface PlanApprovalTabProps {
  plan: AuctionPlan;
  /** Quyền `ke-hoach:finalize` trong chi nhánh của kế hoạch — chỉ để nhắc việc tiếp theo. */
  canFinalize: boolean;
}

/** Một câu trả lời cho "kế hoạch này đang ở đâu trong luồng duyệt". */
function statusLine(plan: AuctionPlan): string {
  switch (plan.status) {
    case "draft":
      return "Bản nháp — chưa trình lên cấp trên.";
    case "submitted":
      return `Đã trình ngày ${formatPlanDate(plan.submitted_at)} — đang chờ cấp trên xem xét.`;
    case "returned":
      return `Cấp trên trả lại ngày ${formatPlanDate(plan.reviewed_at)} — mở lại để sửa rồi trình lại.`;
    case "approved":
      return `Đã duyệt ngày ${formatPlanDate(plan.reviewed_at)} · bản mốc v${plan.baseline_version}.`;
    case "adjusting":
      return `Đang điều chỉnh từ bản mốc v${plan.baseline_version} — sửa xong phải trình lại để được duyệt.`;
    case "closed":
      return "Kế hoạch đã đóng — chỉ còn để tra cứu.";
  }
}

/**
 * Tab "Phê duyệt & lịch sử" (§A6): tình trạng → thay đổi so với bản mốc → các
 * lần phê duyệt → dòng thời gian (L1 → L4 của §A8.2).
 *
 * Nút "Trả lại" / "Ghi nhận phê duyệt" / "Điều chỉnh kế hoạch" nằm ở ĐẦU TRANG
 * (`PlanReviewActions`), không nhân bản xuống đây — một nút chính mỗi màn.
 */
export function PlanApprovalTab({ plan, canFinalize }: PlanApprovalTabProps) {
  const navigate = useNavigate();
  const showDiff = plan.baseline_version > 0 && (plan.status === "adjusting" || plan.status === "submitted");
  const { data: diff, isLoading: diffLoading } = usePlanBaselineDiff(plan, showDiff);
  const leftoverComment = plan.review_comment?.trim() && plan.status !== "returned" ? plan.review_comment : null;

  return (
    <div className="space-y-5">
      <SectionCard
        title="Tình trạng phê duyệt"
        icon={ShieldCheck}
        tone={plan.status === "approved" ? "success" : plan.status === "returned" ? "destructive" : "primary"}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(ownerPlanPrintHref(plan.id))}>
            <Printer className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            In theo mẫu
          </Button>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-foreground">{statusLine(plan)}</p>
          {plan.approval_doc_no && (
            <p className="text-sm text-muted-foreground">
              Quyết định phê duyệt số <span className="font-medium text-foreground">{plan.approval_doc_no}</span>
              {plan.approval_doc_date ? ` ngày ${formatPlanDate(plan.approval_doc_date)}` : ""} — ký ngoài ứng dụng, ở
              đây chỉ ghi nhận.
            </p>
          )}
          {plan.status === "adjusting" && canFinalize && (
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <PencilRuler className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.5} aria-hidden="true" />
              Thêm / bỏ tài sản, dời sang quý khác, đổi giá trị khởi điểm quá 10% đều phải được duyệt lại.
            </p>
          )}
        </div>
      </SectionCard>

      {leftoverComment && (
        <SectionCard title="Góp ý gần nhất của cấp trên" icon={MessageSquareWarning} tone="warning">
          <p className="whitespace-pre-line text-sm text-foreground">{leftoverComment}</p>
        </SectionCard>
      )}

      {showDiff && (
        <SectionCard title={`Thay đổi so với bản mốc v${plan.baseline_version}`} icon={PencilRuler} tone="warning">
          {diffLoading ? (
            <p className="text-sm text-muted-foreground">Đang so với bản mốc…</p>
          ) : (
            <PlanDiffSummary
              diff={diff}
              emptyText={`Danh mục hiện tại giống bản mốc v${plan.baseline_version}.`}
            />
          )}
        </SectionCard>
      )}

      <PlanBaselinesCard plan={plan} />

      {/* Phase 10 — công khai danh mục dự kiến ra trang tìm tài sản. Ở đây vì
          bật/tắt là quyền của CẤP DUYỆT, cùng cổng với Ghi nhận phê duyệt. */}
      <PlanPublicCard plan={plan} />

      <PlanHistoryTimeline plan={plan} />
    </div>
  );
}

import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoneyShort } from "@/utils/money";
import { useSubmitPlan } from "@/hooks/useAuctionPlan";
import { usePlanBaselineDiff } from "@/hooks/useAuctionPlanApproval";
import { QUARTERS, QUARTER_LABELS, type PlanTotals } from "@/lib/auctionPlan/totals";
import type { AuctionPlan } from "@/lib/auctionPlan/types";
import { PlanDiffSummary } from "../approval/PlanDiffSummary";

interface SubmitPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AuctionPlan;
  totals: PlanTotals;
}

/**
 * Xác nhận "Trình kế hoạch": bảng tổng theo QUÝ để cán bộ soát lại trước khi
 * gửi lên cấp trên. Sau khi trình, danh mục bị khoá (trigger trường mốc) nên
 * đây là chốt cuối.
 *
 * Khi kế hoạch đang ở `adjusting`, hộp thoại hiện thêm "thay đổi so với bản
 * mốc" — ĐÚNG con số server dùng để báo cáo luật D4 lúc trình
 * (`auction_plan_baseline_diff`), không tính lại ở client.
 */
export function SubmitPlanDialog({ open, onOpenChange, plan, totals }: SubmitPlanDialogProps) {
  const submitM = useSubmitPlan(plan);
  const adjusting = plan.status === "adjusting";
  const { data: diff, isLoading: diffLoading } = usePlanBaselineDiff(plan, open && adjusting);
  const blocked = totals.count === 0 || totals.withoutMonth > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !submitM.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{adjusting ? "Trình bản điều chỉnh" : "Trình kế hoạch lên cấp trên"}</DialogTitle>
          <DialogDescription>
            Sau khi trình, danh mục tài sản bị khoá cho tới khi cấp trên trả lại hoặc ghi nhận phê duyệt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Kỳ</th>
                  <th className="px-3 py-2 text-right font-medium">Số tài sản</th>
                  <th className="px-3 py-2 text-right font-medium">Giá trị khởi điểm</th>
                </tr>
              </thead>
              <tbody>
                {QUARTERS.map((q) => (
                  <tr key={q} className="border-b last:border-0">
                    <td className="px-3 py-2">{QUARTER_LABELS[q]}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{totals.byQuarter[q].count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {totals.byQuarter[q].expected > 0 ? formatMoneyShort(totals.byQuarter[q].expected) : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-3 py-2">Cả năm {plan.plan_year}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totals.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoneyShort(totals.expected)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {adjusting && (
            <div className="space-y-1.5 rounded-xl bg-warning/10 px-3 py-2.5">
              <p className="text-xs font-medium text-foreground">Thay đổi so với bản mốc v{plan.baseline_version}</p>
              {diffLoading ? (
                <p className="text-sm text-muted-foreground">Đang so với bản mốc…</p>
              ) : (
                <PlanDiffSummary
                  diff={diff}
                  emptyText="Danh mục giống bản mốc đã duyệt — trình lại chỉ để xác nhận."
                />
              )}
            </div>
          )}

          {totals.count === 0 && (
            <p className="text-sm text-destructive">
              Kế hoạch chưa có tài sản nào — thêm ít nhất một lô trước khi trình.
            </p>
          )}
          {totals.withoutMonth > 0 && (
            <p className="text-sm text-destructive">
              Còn {totals.withoutMonth} tài sản chưa chọn tháng dự kiến. Mở từng tài sản để chọn tháng.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={submitM.isPending} onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            className="gap-1.5"
            disabled={blocked || submitM.isPending}
            onClick={() => submitM.mutate(undefined, { onSuccess: () => onOpenChange(false) })}
          >
            {submitM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            Trình kế hoạch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

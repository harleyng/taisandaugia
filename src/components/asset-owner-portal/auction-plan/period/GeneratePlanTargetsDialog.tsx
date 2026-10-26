import { useEffect, useMemo, useState } from "react";
import { Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { useGeneratePlanTargets } from "@/hooks/useAuctionPlanPeriod";
import { useOwnerTargets } from "@/hooks/useOwnerTargets";
import { formatMoneyFull } from "@/utils/money";
import type { PlanQuarterGoal } from "@/lib/auctionPlan/period";
import type { AuctionPlan } from "@/lib/auctionPlan/types";
import type { OwnerTarget } from "@/lib/ownerTargets";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AuctionPlan;
  goals: readonly PlanQuarterGoal[];
}

/**
 * "Tạo chỉ tiêu từ kế hoạch" — mỗi quý CÓ tài sản theo bản mốc thành một chỉ
 * tiêu quý của ĐÚNG đơn vị lập kế hoạch (`branch_id` của kế hoạch), hai tiêu
 * chí: `offered_count` = số tài sản, `winning_total` = Σ giá trị khởi điểm dự kiến.
 *
 * ⚠️ `owner_save_target` THAY TOÀN BỘ tiêu chí của chỉ tiêu đó. Quý đã có chỉ
 * tiêu vì thế mặc định KHÔNG tích: người dùng phải tự chọn ghi đè, và hộp thoại
 * in rõ con số đang có để họ biết sẽ mất gì.
 */
export function GeneratePlanTargetsDialog({ open, onOpenChange, plan, goals }: Props) {
  const { targets } = useOwnerTargets(plan.workspace_id);
  const generateM = useGeneratePlanTargets(plan);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  /** Chỉ tiêu quý ĐÃ CÓ của đúng đơn vị này, tra theo ngày đầu kỳ. */
  const existing = useMemo(() => {
    const map = new Map<string, OwnerTarget>();
    for (const t of targets) {
      if (t.periodType === "quarter" && (t.branchId ?? null) === (plan.branch_id ?? null)) map.set(t.periodStart, t);
    }
    return map;
  }, [targets, plan.branch_id]);

  useEffect(() => {
    if (!open) return;
    setPicked(Object.fromEntries(goals.map((g) => [g.periodStart, !existing.has(g.periodStart)])));
  }, [open, goals, existing]);

  const chosen = goals.filter((g) => picked[g.periodStart]);
  const overwriting = chosen.filter((g) => existing.has(g.periodStart)).length;

  const submit = () => {
    generateM.mutate(
      { quarters: chosen.map(({ periodStart, offeredCount, winningTotal, label }) => ({ periodStart, offeredCount, winningTotal, label })), existing },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Tạo chỉ tiêu từ kế hoạch</DialogTitle>
          <DialogDescription>
            Mỗi quý có tài sản trong bản mốc thành một chỉ tiêu quý của {plan.branch_id ? "chi nhánh này" : "toàn đơn vị"}:
            số tài sản đưa ra đấu giá và tổng giá trị khởi điểm dự kiến.
          </DialogDescription>
        </DialogHeader>

        {goals.length === 0 ? (
          <EmptyState
            compact
            icon={Target}
            tone="muted"
            title="Bản mốc chưa có tài sản nào theo quý."
            description="Bổ sung tháng dự kiến và giá khởi điểm cho tài sản, trình và được phê duyệt, rồi quay lại đây."
          />
        ) : (
          <ul className="space-y-2">
            {goals.map((g) => {
              const current = existing.get(g.periodStart) ?? null;
              const id = `quy-${g.periodStart}`;
              return (
                <li key={g.periodStart} className="rounded-xl border border-border px-3 py-2.5">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      checked={!!picked[g.periodStart]}
                      onCheckedChange={(v) => setPicked((prev) => ({ ...prev, [g.periodStart]: v === true }))}
                    />
                    <div className="min-w-0 flex-1">
                      <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                        {g.label}
                        {current && (
                          <Badge variant="outline" className="border-warning/50">
                            Đã có chỉ tiêu
                          </Badge>
                        )}
                      </label>
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {g.offeredCount} tài sản · {formatMoneyFull(g.winningTotal)}
                      </p>
                      {current && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Đang có {current.criteria.length} tiêu chí — lưu sẽ thay bằng hai tiêu chí trên.
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {overwriting > 0 && (
          <p className="text-xs text-warning">
            {overwriting} quý đã có chỉ tiêu sẽ bị thay tiêu chí. Bỏ tích nếu muốn giữ nguyên.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button onClick={submit} disabled={chosen.length === 0 || generateM.isPending}>
            {generateM.isPending && <Loader2 className="animate-spin" />}
            Lưu {chosen.length > 0 ? `${chosen.length} chỉ tiêu` : "chỉ tiêu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

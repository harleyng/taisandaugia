import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMovePlanItemForecast } from "@/hooks/useAuctionPlanPeriod";
import { monthLabel } from "@/lib/auctionPlan/totals";

/** Một tài sản bất kỳ trên trang vận hành — chỉ cần bốn trường này. */
export interface MoveForecastTarget {
  planId: string;
  itemId: string;
  itemTitle: string | null;
  baselineMonth: string | null;
  forecastMonth: string | null;
  forecastReason?: string | null;
}

const Star = () => <span className="text-destructive">*</span>;

const toMonthInput = (iso: string | null): string => (iso ? iso.slice(0, 7) : "");
const fromMonthInput = (v: string): string | null => (/^\d{4}-\d{2}$/.test(v) ? `${v}-01` : null);

/**
 * "Dời dự kiến" ngay trên trang "Vận hành tháng".
 *
 * Giống `PlanForecastDialog` của tab "Tiến độ" về LUẬT (chỉ đặt
 * `forecast_month` + lý do, tháng bản mốc không đổi), nhưng trang vận hành gom
 * tài sản của NHIỀU kế hoạch nên nó chỉ nhận id, không nhận cả bản ghi kế hoạch.
 */
export function MoveForecastDialog({
  target,
  workspaceId,
  onOpenChange,
}: {
  target: MoveForecastTarget | null;
  workspaceId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [month, setMonth] = useState("");
  const [reason, setReason] = useState("");
  const moveM = useMovePlanItemForecast(workspaceId);

  useEffect(() => {
    if (!target) return;
    setMonth(toMonthInput(target.forecastMonth));
    setReason(target.forecastReason ?? "");
  }, [target]);

  if (!target) return null;

  const parsed = fromMonthInput(month);
  const canSave = !!parsed && reason.trim().length > 0;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Dời dự kiến</DialogTitle>
          <DialogDescription>
            {target.itemTitle || "Tài sản"} · theo kế hoạch {monthLabel(target.baselineMonth)}. Tháng của bản mốc
            không đổi — đây là ghi nhận thực tế sẽ muộn hơn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="forecast-month" className="text-sm font-medium text-foreground">
              Tháng dự kiến mới <Star />
            </label>
            <Input id="forecast-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="forecast-reason" className="text-sm font-medium text-foreground">
              Lý do <Star />
            </label>
            <Textarea
              id="forecast-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Chưa phê duyệt giá khởi điểm, chờ hồ sơ pháp lý thửa đất…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            onClick={() =>
              moveM.mutate(
                { planId: target.planId, itemId: target.itemId, month: parsed, reason: reason.trim() },
                { onSuccess: () => onOpenChange(false) },
              )
            }
            disabled={!canSave || moveM.isPending}
          >
            {moveM.isPending && <Loader2 className="animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

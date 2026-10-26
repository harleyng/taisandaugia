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
import { useSavePlanItemExec } from "@/hooks/useAuctionPlanProgress";
import { monthLabel } from "@/lib/auctionPlan/totals";
import type { AuctionPlan, AuctionPlanItem } from "@/lib/auctionPlan/types";

interface PlanForecastDialogProps {
  item: AuctionPlanItem | null;
  plan: AuctionPlan;
  onOpenChange: (open: boolean) => void;
}

const Star = () => <span className="text-destructive">*</span>;

/** "2026-11-01" ⇄ "2026-11" cho input type=month. */
const toMonthInput = (iso: string | null): string => (iso ? iso.slice(0, 7) : "");
const fromMonthInput = (v: string): string | null => (/^\d{4}-\d{2}$/.test(v) ? `${v}-01` : null);

/**
 * "Dời dự kiến": đặt THÁNG DỰ KIẾN MỚI + lý do.
 *
 * Tháng của bản mốc KHÔNG đổi ở đây — đó là trường mốc, chỉ sửa được khi kế
 * hoạch ở nháp / đang điều chỉnh và phải trình lại. `forecast_month` là lời khai
 * "thực tế sẽ muộn hơn", luôn sửa được, và kéo tài sản sang "Nguy cơ trễ".
 */
export function PlanForecastDialog({ item, plan, onOpenChange }: PlanForecastDialogProps) {
  const [month, setMonth] = useState("");
  const [reason, setReason] = useState("");
  const saveM = useSavePlanItemExec(plan);

  useEffect(() => {
    if (!item) return;
    setMonth(toMonthInput(item.forecast_month));
    setReason(item.forecast_reason ?? "");
  }, [item]);

  if (!item) return null;

  const parsed = fromMonthInput(month);
  const clearing = month.trim() === "";
  const invalid = (!clearing && !parsed) || (!clearing && !reason.trim());

  const submit = () => {
    saveM.mutate(
      {
        itemId: item.id,
        values: clearing
          ? { forecast_month: null, forecast_reason: null }
          : { forecast_month: parsed, forecast_reason: reason.trim() },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !saveM.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Dời dự kiến</DialogTitle>
          <DialogDescription>
            Tháng theo kế hoạch đã duyệt là {monthLabel(item.planned_month)} và không đổi ở đây. Ghi tháng dự kiến mới để
            lưới tiến độ và báo cáo nói đúng thực tế.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="forecast-month" className="text-sm font-medium text-foreground">
              Tháng dự kiến mới
            </label>
            <Input id="forecast-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <p className="text-xs text-muted-foreground">Để trống để bỏ tháng dự kiến, quay về đúng kế hoạch.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="forecast-reason" className="text-sm font-medium text-foreground">
              Lý do {!clearing && <Star />}
            </label>
            <Textarea
              id="forecast-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Chưa xong giải phóng mặt bằng, chờ phê duyệt giá khởi điểm…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saveM.isPending} onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button disabled={saveM.isPending || invalid} onClick={submit}>
            {saveM.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {clearing ? "Bỏ tháng dự kiến" : "Lưu dự kiến mới"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

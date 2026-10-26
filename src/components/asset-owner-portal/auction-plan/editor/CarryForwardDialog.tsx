import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { formatMoneyShort } from "@/utils/money";
import { useImportPlanItems } from "@/hooks/useAuctionPlan";
import { carryForwardPayload, usePlanCarryForward } from "@/hooks/useAuctionPlanCarryForward";
import type { AuctionPlan } from "@/lib/auctionPlan/types";

interface CarryForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AuctionPlan;
}

/**
 * "Chuyển tiếp từ năm trước": các tài sản của kế hoạch năm trước (cùng đơn vị)
 * chưa bỏ khỏi kế hoạch và chưa thu đủ tiền. Người dùng tự chọn dòng nào mang
 * sang; tài sản mới được cấp MÃ MỚI và XOÁ TRẮNG tháng dự kiến.
 */
export function CarryForwardDialog({ open, onOpenChange, plan }: CarryForwardDialogProps) {
  const { previousYear, hasPreviousPlan, candidates, isLoading } = usePlanCarryForward(plan);
  const importM = useImportPlanItems(plan);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setPicked(new Set(candidates.map((c) => c.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidates.length]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = candidates.filter((c) => picked.has(c.id));

  const run = () => {
    importM.mutate(chosen.map(carryForwardPayload), { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !importM.isPending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Chuyển tiếp từ năm {previousYear}</DialogTitle>
          <DialogDescription>
            Tài sản năm trước chưa đấu xong sẽ được thêm vào kế hoạch này với mã mới; tháng dự kiến để trống để bạn
            chọn lại kỳ.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : !hasPreviousPlan ? (
          <EmptyState
            icon={History}
            tone="muted"
            title={`Đơn vị chưa có kế hoạch năm ${previousYear}.`}
            description="Không có gì để chuyển tiếp."
          />
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={History}
            tone="success"
            title={`Năm ${previousYear} không còn tài sản dở dang.`}
            description="Mọi tài sản đã đấu xong hoặc đã bỏ khỏi kế hoạch."
          />
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-xl border">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-3 py-2.5">
                <Checkbox
                  id={`cf-${c.id}`}
                  checked={picked.has(c.id)}
                  onCheckedChange={() => toggle(c.id)}
                  className="mt-0.5"
                />
                <label htmlFor={`cf-${c.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block truncate text-sm font-medium text-foreground">{c.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.itemCode}
                    {c.areaM2 !== null && ` · ${Number(c.areaM2).toLocaleString("en-US")} m²`}
                    {c.expectedStartValue !== null && ` · ${formatMoneyShort(c.expectedStartValue)}`}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={importM.isPending} onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          {candidates.length > 0 && (
            <Button disabled={chosen.length === 0 || importM.isPending} onClick={run}>
              {importM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Chuyển tiếp {chosen.length} tài sản
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

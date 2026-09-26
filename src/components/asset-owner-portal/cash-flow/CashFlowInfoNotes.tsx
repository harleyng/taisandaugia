import { useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WaterfallTotals } from "@/lib/ownerCashFlow";
import { formatMoneyShort } from "@/utils/money";

/**
 * Tài sản bán trong kỳ mà trang này KHÔNG theo dõi tiền: bán trên sàn (sàn theo dõi
 * thanh toán) và kết quả từ nguồn khác mà đơn vị chưa tự khai.
 */
export function CashFlowInfoNotes({
  notes,
  canReport,
}: {
  notes: WaterfallTotals["notes"];
  /** Người xem khai được kết quả cho tài sản chưa theo dõi của CHÍNH đơn vị mình. */
  canReport: boolean;
}) {
  const navigate = useNavigate();
  const { platform, untracked } = notes;
  if (!platform.count && !untracked.count) return null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-muted/40 p-4 text-sm sm:flex-row sm:items-center">
      <Info className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-0.5 text-muted-foreground">
        {platform.count > 0 && (
          <p>
            {platform.count} tài sản bán trên sàn trong kỳ ({formatMoneyShort(platform.value)}) — sàn theo dõi thanh toán, không
            ghi ở đây.
          </p>
        )}
        {untracked.count > 0 && (
          <p>
            {untracked.count} tài sản bán theo số của tổ chức hoặc tin đăng ({formatMoneyShort(untracked.value)}) chưa có kết quả
            đơn vị tự khai nên chưa theo dõi được tiền.
          </p>
        )}
      </div>
      {untracked.count > 0 && canReport && (
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => navigate("/chu-tai-san/ket-qua")}>
          Khai kết quả để theo dõi thu tiền
        </Button>
      )}
    </div>
  );
}

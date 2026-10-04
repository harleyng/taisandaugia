import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { cn } from "@/lib/utils";
import { usePostingValuationOrders } from "@/hooks/useValuationOrders";
import { summarizeValuations } from "@/lib/valuation/status";
import { ActiveValuationOrder } from "@/components/valuation/ActiveValuationOrder";
import { RequestValuationDialog } from "@/components/valuation/RequestValuationDialog";
import { ValuationHistory } from "@/components/valuation/ValuationHistory";
import { ValuationResult } from "@/components/valuation/ValuationResult";
import type { AssetPosting } from "@/types/asset-posting";
import { usePostingCanWrite } from "../postingAccess";
import { CardAux, EmptyServiceCard, KvList } from "./detailParts";

const day = (iso: string | null) => (iso ? format(new Date(iso), "dd/MM/yyyy", { locale: vi }) : "—");

/**
 * Nhánh "Dịch vụ của sàn" của tab Thẩm định giá: kết quả hiện hành (giá trị + chứng thư) +
 * thẻ đơn vị bên phải; đơn đang chạy và các kết quả cũ. BR-TDG-03: chỉ tham khảo — không
 * tự đổi giá khởi điểm hay trạng thái hồ sơ.
 */
export function PostingValuationTab({ posting: p, locked }: { posting: AssetPosting; locked: boolean }) {
  const [open, setOpen] = useState(false);
  const canWrite = usePostingCanWrite();
  const { data: rows = [], isLoading } = usePostingValuationOrders(p.id);
  const { active, current, history } = summarizeValuations(rows);
  const canRequest = canWrite && !active && !locked;

  const dialog = canWrite && (
    <RequestValuationDialog
      open={open}
      onOpenChange={setOpen}
      resolvePostingId={async () => p.id}
      isFollowUp={!!current}
    />
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải thẩm định giá…
      </div>
    );
  }

  if (!current && !active) {
    return (
      <>
        <EmptyServiceCard
          title="Chưa có yêu cầu thẩm định giá"
          description="Đơn vị thẩm định giá đối tác của sàn khảo sát, định giá tài sản và cấp chứng thư — căn cứ để bạn đặt giá khởi điểm."
          action={canRequest && <Button onClick={() => setOpen(true)}>Yêu cầu thẩm định giá</Button>}
        />
        {dialog}
      </>
    );
  }

  const previous = history.filter((h) => h.status === "superseded");

  return (
    <div className={cn("grid items-start gap-5", current && "xl:grid-cols-[minmax(0,1fr)_330px]")}>
      <div className="flex min-w-0 flex-col gap-4">
        {active && (
          <SectionCard title="Yêu cầu đang xử lý">
            <ActiveValuationOrder row={active} mode="owner" />
          </SectionCard>
        )}

        {current && (
          <SectionCard
            title="Kết quả thẩm định giá"
            actions={
              <CardAux>
                {current.code} · hoàn tất {day(current.completed_at)}
              </CardAux>
            }
          >
            <ValuationResult row={current} />
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Giá trị thẩm định mang tính tham khảo, không tự trở thành giá khởi điểm và không thay việc sàn duyệt hồ sơ.
            </p>
          </SectionCard>
        )}

        {previous.length > 0 && (
          <div className="rounded-2xl bg-card p-4 shadow-card sm:p-5">
            <ValuationHistory history={history} />
          </div>
        )}
      </div>

      {current && (
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6">
          <SectionCard title="Đơn vị thẩm định">
            <div>
              <KvList
                rows={[
                  { k: "Thẩm định viên", v: current.expert_name ?? "—" },
                  ...(current.partner_name ? [{ k: "Đơn vị", v: current.partner_name }] : []),
                  { k: "Số lần thẩm định", v: String(history.length) },
                ]}
              />
              {canRequest && (
                <Button variant="outline" className="mt-3 w-full" onClick={() => setOpen(true)}>
                  Thẩm định giá lại
                </Button>
              )}
            </div>
          </SectionCard>
        </aside>
      )}

      {dialog}
    </div>
  );
}

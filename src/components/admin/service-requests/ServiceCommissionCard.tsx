import { useNavigate } from "react-router-dom";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/advertising/slug";
import { useServiceCommissionOrder } from "@/hooks/useServiceCommissionOrder";
import { DetailRow, Wide } from "./DetailSection";

/** Dòng hoa hồng đối tác trong sổ orders — server ghi đúng 1 dòng lúc hoàn tất/giao. */
export function ServiceCommissionCard({
  commissionOrderId,
  pendingText,
}: {
  commissionOrderId: string | null;
  /** Hiển thị khi chưa có dòng hoa hồng: nói rõ mốc nào sẽ ghi. */
  pendingText: string;
}) {
  const navigate = useNavigate();
  const { data: ledger, isLoading } = useServiceCommissionOrder(commissionOrderId);

  if (!commissionOrderId) {
    return (
      <Wide>
        <p className="text-sm text-muted-foreground">{pendingText}</p>
      </Wide>
    );
  }
  if (isLoading) {
    return (
      <Wide>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
        </div>
      </Wide>
    );
  }
  if (!ledger) {
    return (
      <Wide>
        <p className="text-sm text-muted-foreground">Không đọc được dòng hoa hồng (cần quyền xem đơn hàng).</p>
      </Wide>
    );
  }

  const gross = Number(ledger.gross_amount);
  const platform = Number(ledger.amount);
  const contract = ledger.supplier_contracts as { code: string | null; contract_no: string } | null;

  return (
    <>
      <DetailRow label="Mã đơn hàng" value={<span className="font-mono">{ledger.code ?? "—"}</span>} />
      <DetailRow label="Giá trị dịch vụ (thu hộ)" value={formatVnd(gross)} />
      <DetailRow
        label="Mức hoa hồng"
        value={ledger.commission_type === "percent" ? `${Number(ledger.commission_value)}%` : formatVnd(ledger.commission_value)}
      />
      <DetailRow label="Sàn hưởng" value={<span className="text-primary">{formatVnd(platform)}</span>} />
      <DetailRow label="Phải trả đối tác" value={formatVnd(gross - platform)} />
      <DetailRow
        label="Hợp đồng"
        value={contract ? `${contract.contract_no}${contract.code ? ` (${contract.code})` : ""}` : "—"}
      />
      {ledger.supplier_id && (
        <Wide>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/admin/doi-tac/${ledger.supplier_id}`)}>
            Xem đối tác & sổ đơn hàng <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Button>
        </Wide>
      )}
    </>
  );
}

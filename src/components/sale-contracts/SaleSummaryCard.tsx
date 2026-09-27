import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDate } from "@/lib/dateUtils";
import { SALE_STATUS_LABELS, type SaleContractDetail } from "@/types/auction-sale-contract";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={strong ? "text-right font-semibold text-foreground" : "text-right font-medium text-foreground"}>
        {value}
      </dd>
    </div>
  );
}

/**
 * Tóm tắt số liệu chính của hợp đồng — cột phải của bố cục `split`. Số dư lấy
 * thẳng từ RPC `sale_contract_detail` (server tính), không tự cộng lại ở đây.
 */
export function SaleSummaryCard({ detail }: { detail: SaleContractDetail }) {
  const { contract: c } = detail;
  const open = c.status !== "cancelled" && c.status !== "completed";

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tóm tắt</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2.5">
          <Row label="Trạng thái" value={SALE_STATUS_LABELS[c.status]} />
          <Row label="Số hợp đồng" value={c.contract_no || "—"} />
          <Row label="Giá mua" value={formatVnd(c.price)} strong />
          <Row label="Tiền đặt trước" value={formatVnd(c.deposit_credit)} />
          <Row label="Đã thanh toán" value={formatVnd(detail.net_paid)} />
          <div className="border-t pt-2.5">
            <Row label="Còn phải thanh toán" value={formatVnd(Math.max(detail.balance, 0))} strong />
          </div>
          {open && c.sign_due_at ? <Row label="Hạn ký" value={formatDate(c.sign_due_at)} /> : null}
          {open && c.handover_due_at ? <Row label="Hạn bàn giao" value={formatDate(c.handover_due_at)} /> : null}
          {c.handover_scheduled_at ? (
            <Row label="Lịch bàn giao" value={formatDate(c.handover_scheduled_at)} />
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dateUtils";
import { SALE_STATUS_LABELS, type SaleContractDetail } from "@/types/auction-sale-contract";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Tóm tắt hợp đồng — cột phải của bố cục `split`: trạng thái, số hợp đồng và
 * các mốc hạn. Tiền nằm ở hero của trang và ở thẻ tài sản, không lặp lại ở đây.
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

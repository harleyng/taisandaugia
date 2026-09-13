import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ContractFileButton } from "@/components/consignment/ContractFileButton";
import { SALE_BUCKET } from "@/lib/saleContracts/files";
import { allocateFifo, netPaidOf, payableOf } from "@/lib/saleContracts/money";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDate } from "@/lib/dateUtils";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import {
  SALE_PAYMENT_METHOD_LABELS,
  type SaleContract,
  type SaleInstallment,
  type SalePayment,
} from "@/types/auction-sale-contract";

/**
 * Sổ tiền + tiến độ kỳ hạn. Phân bổ tính LẠI ở client bằng cùng thuật toán FIFO
 * với server (`_sale_reallocate`) nên bảng luôn khớp `paid_amount` trong DB.
 */
export function SalePaymentsCard({
  contract, installments, payments, canRecord, isBusy, onRecord, onReverse,
}: {
  contract: SaleContract;
  installments: SaleInstallment[];
  payments: SalePayment[];
  canRecord: boolean;
  isBusy?: boolean;
  onRecord?: () => void;
  onReverse?: (p: SalePayment) => void;
}) {
  const payable = payableOf(contract);
  const netPaid = netPaidOf(payments);
  const balance = payable - netPaid;
  const allocated = allocateFifo(
    installments.map((i) => ({
      id: i.id, seq: i.seq, label: i.label, due_at: i.due_at, amount: Number(i.amount),
    })),
    netPaid,
  );
  const pct = payable > 0 ? Math.min(100, Math.round((netPaid / payable) * 100)) : 100;
  const now = Date.now();
  const reversedIds = new Set(payments.map((p) => p.reversed_payment_id).filter(Boolean) as string[]);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-base">Thanh toán</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Đã thu {formatVnd(netPaid)} / {formatVnd(payable)} · còn{" "}
            <strong className={balance > 0 ? "text-foreground" : "text-success"}>{formatVnd(balance)}</strong>
          </p>
        </div>
        {canRecord && onRecord ? (
          <Button type="button" size="sm" disabled={isBusy || balance <= 0} onClick={onRecord}>
            Ghi nhận khoản thu
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-5">
        <Progress value={pct} aria-label={`Đã thanh toán ${pct}%`} />

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Kỳ hạn</h3>
          {allocated.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có kỳ hạn nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Kỳ</th>
                    <th className="py-2 pr-3 font-medium">Hạn</th>
                    <th className="py-2 pr-3 text-right font-medium">Số tiền</th>
                    <th className="py-2 pr-3 text-right font-medium">Đã thu</th>
                    <th className="py-2 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {allocated.map((i) => {
                    const overdue = !i.settled && i.due_at && new Date(i.due_at).getTime() < now;
                    return (
                      <tr key={i.id ?? i.seq} className="border-b last:border-0">
                        <td className="py-2 pr-3">{i.label || `Đợt ${i.seq}`}</td>
                        <td className={`py-2 pr-3 ${overdue ? "text-destructive" : ""}`}>
                          {i.due_at ? formatDate(i.due_at) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right">{formatVnd(i.amount)}</td>
                        <td className="py-2 pr-3 text-right">{formatVnd(i.paid_amount)}</td>
                        <td className="py-2">
                          {i.settled ? (
                            <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                              đã đủ
                            </Badge>
                          ) : overdue ? (
                            <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                              quá hạn
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">còn {formatVnd(i.remaining)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Separator />

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Sổ thu tiền</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có khoản thu nào được ghi nhận.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Thời điểm</th>
                    <th className="py-2 pr-3 text-right font-medium">Số tiền</th>
                    <th className="py-2 pr-3 font-medium">Hình thức</th>
                    <th className="py-2 pr-3 font-medium">Mã GD</th>
                    <th className="py-2 font-medium">Chứng từ</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const isReversal = !!p.reversed_payment_id;
                    const wasReversed = reversedIds.has(p.id);
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(p.received_at)}</td>
                        <td
                          className={`py-2 pr-3 text-right font-medium ${
                            isReversal ? "text-destructive" : wasReversed ? "text-muted-foreground line-through" : ""
                          }`}
                        >
                          {isReversal ? "−" : ""}
                          {formatVnd(p.amount)}
                        </td>
                        <td className="py-2 pr-3">
                          {isReversal ? (
                            <Badge variant="outline" className="border-destructive/30 text-destructive">
                              hoàn bút toán
                            </Badge>
                          ) : (
                            SALE_PAYMENT_METHOD_LABELS[p.method]
                          )}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{p.txn_ref || "—"}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {p.evidence_path ? (
                              <ContractFileButton path={p.evidence_path} bucket={SALE_BUCKET} label="Mở" />
                            ) : null}
                            {canRecord && onReverse && !isReversal && !wasReversed ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={isBusy}
                                onClick={() => onReverse(p)}
                              >
                                Hoàn
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {payments.some((p) => p.note) ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {payments
                .filter((p) => p.note || p.reversal_reason)
                .map((p) => (
                  <li key={`note-${p.id}`}>
                    {formatDate(p.received_at)}: {p.reversal_reason ?? p.note}
                  </li>
                ))}
            </ul>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}

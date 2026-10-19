import { formatDateTime } from "@/lib/auctionCore/datetime";
import { formatMoneyFull } from "@/utils/money";
import { cn } from "@/lib/utils";
import { isLiveLot, LOT_STATE_LABELS, type MonitorLot } from "@/lib/auctionMonitor/monitor";

const PAYMENT_LABELS: Record<NonNullable<MonitorLot["payment_status"]>, string> = {
  pending: "chờ thanh toán",
  paid: "đã thanh toán",
  defaulted: "bỏ cọc",
};

function resultText(l: MonitorLot): string {
  if (l.state === "withdrawn") return "Rút khỏi phiên";
  if (l.result === "sold") {
    const pay = l.payment_status ? ` · ${PAYMENT_LABELS[l.payment_status]}` : "";
    return `Trúng ${formatMoneyFull(l.winning_amount)}${pay}`;
  }
  if (l.result === "unsold") return "Không thành";
  return "—";
}

/** Lô của phiên + trạng thái điều hành sống (auction_lot_states). */
export function MonitorLotsTable({ lots }: { lots: MonitorLot[] }) {
  if (lots.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Phiên chưa có tài sản.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Lô</th>
            <th className="px-4 py-2.5 font-medium">Tài sản</th>
            <th className="px-4 py-2.5 text-right font-medium">Giá khởi điểm</th>
            <th className="px-4 py-2.5 font-medium">Trạng thái</th>
            <th className="px-4 py-2.5 text-right font-medium">Giá hiện tại</th>
            <th className="px-4 py-2.5 text-right font-medium">Lượt trả</th>
            <th className="px-4 py-2.5 font-medium">Kết quả</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((l) => {
            const live = isLiveLot(l.state);
            return (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 tabular-nums text-foreground">{l.lot_no}</td>
                <td className="max-w-[260px] px-4 py-3">
                  <span className="block truncate text-foreground" title={l.title}>
                    {l.title}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {formatMoneyFull(l.starting_price)}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("whitespace-nowrap text-sm", live ? "font-medium text-primary" : "text-muted-foreground")}>
                    {LOT_STATE_LABELS[l.state ?? "pending"]}
                    {l.round_no && l.round_no > 1 ? ` · vòng ${l.round_no}` : ""}
                  </span>
                  {live && l.ends_at && (
                    <span className="block text-[11px] text-muted-foreground">Đóng lúc {formatDateTime(l.ends_at)}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-foreground">
                  {l.current_price != null ? formatMoneyFull(l.current_price) : "—"}
                  {l.leading_bidder_no != null && (
                    <span className="block text-[11px] text-muted-foreground">Số {l.leading_bidder_no} dẫn đầu</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">{l.bid_count}</td>
                <td className="px-4 py-3 text-muted-foreground">{resultText(l)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

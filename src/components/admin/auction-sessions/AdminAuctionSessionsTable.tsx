import { formatDateTime } from "@/lib/auctionCore/datetime";
import {
  BIDDING_METHOD_LABELS,
  monitorStateOf,
  upcomingDetailOf,
  type AdminAuctionSessionRow,
} from "@/lib/auctionMonitor/monitor";
import { MonitorStateBadge } from "./MonitorStateBadge";

/** Danh sách phiên trên sàn (mọi tổ chức, mọi trạng thái) — bấm dòng mở chi tiết giám sát. */
export function AdminAuctionSessionsTable({
  rows,
  now,
  onOpen,
}: {
  rows: AdminAuctionSessionRow[];
  now: Date;
  onOpen: (row: AdminAuctionSessionRow) => void;
}) {
  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Không có phiên đấu giá nào.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Mã</th>
            <th className="px-4 py-2.5 font-medium">Phiên</th>
            <th className="px-4 py-2.5 font-medium">Tổ chức</th>
            <th className="px-4 py-2.5 font-medium">Thời gian đấu</th>
            <th className="px-4 py-2.5 font-medium">Trạng thái</th>
            <th className="px-4 py-2.5 text-right font-medium">Lô</th>
            <th className="px-4 py-2.5 text-right font-medium">Hồ sơ</th>
            <th className="px-4 py-2.5 text-right font-medium">HĐ mua bán</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const state = monitorStateOf(r, now);
            return (
              <tr
                key={r.id}
                onClick={() => onOpen(r)}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-foreground">{r.code}</td>
                <td className="max-w-[260px] px-4 py-3">
                  <span className="block truncate text-foreground" title={r.title}>
                    {r.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {BIDDING_METHOD_LABELS[r.bidding_method] ?? r.bidding_method}
                    {r.province ? ` · ${r.province}` : ""}
                  </span>
                </td>
                <td className="max-w-[200px] px-4 py-3 text-muted-foreground">
                  <span className="block truncate" title={r.org_name ?? undefined}>
                    {r.org_name ?? "—"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(r.starts_at)}</td>
                <td className="px-4 py-3">
                  <MonitorStateBadge state={state} detail={upcomingDetailOf(r, now)} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-foreground">
                  {r.lot_count}
                  {r.live_lot_count > 0 && <span className="ml-1 text-xs text-primary">({r.live_lot_count} đang đấu)</span>}
                  {r.sold_lot_count > 0 && <span className="ml-1 text-xs text-muted-foreground">· {r.sold_lot_count} trúng</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-foreground">
                  {r.paid_dossier_count}/{r.dossier_count}
                  {r.checked_in_count > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">· {r.checked_in_count} điểm danh</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">{r.sale_contract_count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

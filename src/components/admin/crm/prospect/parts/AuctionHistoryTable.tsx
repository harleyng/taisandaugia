import { Badge } from "@/components/ui/badge";
import ReportCard from "@/components/admin/reports/ReportCard";
import { formatVnd } from "@/lib/advertising/slug";
import type { AuctionHistoryRow } from "@/lib/prospects/types";

const TH = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
const THR = "px-3 py-2 text-right text-xs font-medium text-muted-foreground";

const BUCKET_STYLE: Record<string, string> = {
  "Đã thành": "bg-success/15 text-success border-success/30",
  "Không thành": "bg-destructive/10 text-destructive border-destructive/25",
  "Tồn đọng": "bg-warning/15 text-warning border-warning/30",
  "Đang đấu": "bg-accent/20 text-foreground border-accent/40",
  "Chờ đấu": "bg-muted text-muted-foreground",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN") : "—";

interface Props {
  /** Đã lọc sẵn ở cấp tab — component này chỉ hiển thị. */
  rows: AuctionHistoryRow[];
  totalCount: number;
  filtered: boolean;
  /** Cụm có chi nhánh → thêm cột "Đơn vị" để biết tin thuộc về ai. */
  showUnit?: boolean;
}

export function AuctionHistoryTable({ rows, totalCount, filtered, showUnit }: Props) {
  const startSum = rows.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const winSum = rows.reduce((s, r) => s + Number(r.win_price ?? 0), 0);

  return (
    <ReportCard
      title="Danh sách tài sản"
      subtitle={
        filtered
          ? `Hiển thị ${rows.length}/${totalCount} tài sản theo bộ lọc`
          : `${totalCount} tài sản đã đưa lên sàn`
      }
      empty={totalCount === 0}
      emptyText="Chưa có tài sản nào trên sàn"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>Tài sản</th>
              {showUnit && <th className={TH}>Đơn vị</th>}
              <th className={TH}>Loại</th>
              <th className={TH}>Tỉnh/TP</th>
              <th className={TH}>Pháp lý</th>
              <th className={TH}>Ngày đấu</th>
              <th className={THR}>Lần đấu</th>
              <th className={THR}>Giá KĐ</th>
              <th className={THR}>Giá trúng</th>
              <th className={TH}>Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showUnit ? 10 : 9} className="px-3 py-8 text-center text-muted-foreground text-sm">
                  Không có tài sản nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground max-w-[260px]">
                    <span className="block truncate">{r.title}</span>
                    {r.counterparty && (
                      <span className="block text-[11px] text-muted-foreground truncate">
                        {r.counterparty}
                      </span>
                    )}
                  </td>
                  {showUnit && (
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px]">
                      <span className="block truncate">{r.unit_name}</span>
                    </td>
                  )}
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.asset_type ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.province ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.legal_status ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(r.auction_at)}
                  </td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums text-muted-foreground">
                    {r.round_count || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {formatVnd(r.price)}
                  </td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums whitespace-nowrap">
                    {r.win_price ? (
                      <span className="text-success font-medium">{formatVnd(r.win_price)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={BUCKET_STYLE[r.bucket] ?? ""}>
                      {r.bucket}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30">
                <td className="px-3 py-2 text-xs font-medium text-foreground" colSpan={showUnit ? 7 : 6}>
                  Tổng {rows.length} tài sản
                </td>
                <td className="px-3 py-2 text-xs text-right tabular-nums font-medium text-foreground whitespace-nowrap">
                  {formatVnd(startSum)}
                </td>
                <td className="px-3 py-2 text-xs text-right tabular-nums font-medium text-success whitespace-nowrap">
                  {winSum > 0 ? formatVnd(winSum) : "—"}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ReportCard>
  );
}

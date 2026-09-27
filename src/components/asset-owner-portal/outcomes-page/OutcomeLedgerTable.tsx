import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import {
  LEDGER_PAGE_SIZE,
  ledgerDay,
  ledgerMoney,
  outcomeText,
  pageWindow,
  priceVsStart,
  type LedgerRow,
} from "@/lib/ownerOutcomesLedger";

const TH =
  "whitespace-nowrap border-b bg-muted/50 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground first:pl-5 last:pr-5";
const TD = "border-b px-3 py-[11px] align-middle first:pl-5 last:pr-5 group-last:border-b-0";
const PAGE_BTN =
  "h-8 min-w-8 rounded-lg px-2 text-[13px] font-semibold tabular-nums shadow-[inset_0_0_0_1px_hsl(var(--border))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ResultCell({ row }: { row: LedgerRow }) {
  if (row.outcome === "sold" && row.price !== null) {
    const pct = priceVsStart(row.price, row.startingPrice);
    return (
      <>
        <b className="text-[14.5px] font-bold text-foreground">{ledgerMoney(row.price)}</b>
        {pct !== null && (
          <small className="block text-[12.5px] text-muted-foreground">
            {pct > 0 ? (
              <>
                <em className="font-semibold not-italic text-primary">+{pct}%</em> so với KĐ
              </>
            ) : pct < 0 ? (
              `${pct}% so với KĐ`
            ) : (
              "bằng giá KĐ"
            )}
          </small>
        )}
      </>
    );
  }
  return (
    <>
      <span className="text-[13.5px] font-semibold text-muted-foreground">{outcomeText(row.outcome)}</span>
      <small className="block text-[12.5px] text-muted-foreground">
        {row.outcome === "sold"
          ? "Chưa rõ giá trúng"
          : row.startingPrice
            ? `Giá KĐ ${ledgerMoney(row.startingPrice)}`
            : null}
      </small>
    </>
  );
}

interface OutcomeLedgerTableProps {
  rows: LedgerRow[];
  onOpen: (row: LedgerRow) => void;
  /** Có dòng nào trong sổ không (để phân biệt "sổ trống" với "lọc không ra"). */
  hasAnyRow: boolean;
}

/** Bảng sổ kết quả: 8 dòng/trang, bấm dòng mở ngăn chi tiết. Trang về 1 khi đổi lọc (component được key theo bộ lọc). */
export function OutcomeLedgerTable({ rows, onOpen, hasAnyRow }: OutcomeLedgerTableProps) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / LEDGER_PAGE_SIZE));
  const current = Math.min(page, pages);
  const from = (current - 1) * LEDGER_PAGE_SIZE;
  const shown = rows.slice(from, from + LEDGER_PAGE_SIZE);

  if (!rows.length) {
    return (
      <p className="py-5 text-[13.5px] text-muted-foreground">
        {hasAnyRow
          ? "Không có kết quả khớp bộ lọc."
          : "Chưa có kết quả phiên nào. Kết quả phiên trên sàn và số tổ chức đấu giá báo sẽ tự hiện ở đây."}
      </p>
    );
  }

  const onKey = (e: KeyboardEvent, row: LedgerRow) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(row);
    }
  };

  return (
    <>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className={TH}>Tài sản</th>
              <th className={cn(TH, "hidden md:table-cell")}>Địa chỉ</th>
              <th className={TH}>Ngày đấu</th>
              <th className={cn(TH, "text-center")}>Vòng</th>
              <th className={cn(TH, "text-right")}>Kết quả</th>
              <th className={cn(TH, "hidden md:table-cell")}>
                <span className="sr-only">Mở</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.rowKey}
                tabIndex={0}
                aria-label={`Xem chi tiết ${r.title}`}
                onClick={() => onOpen(r)}
                onKeyDown={(e) => onKey(e, r)}
                className="group cursor-pointer transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                {/* Mobile: tên xuống 2 dòng, bảng cuộn ngang trong thẻ (như design); từ md: một dòng, cắt chữ. */}
                <td className={cn(TD, "min-w-[10rem] max-w-[12rem] md:max-w-[22rem]")}>
                  <span
                    className="line-clamp-2 text-sm font-[550] text-foreground md:line-clamp-none md:truncate"
                    title={r.title}
                  >
                    {r.title}
                  </span>
                  <small className="block truncate text-[12.5px] text-muted-foreground">
                    {r.orgName ?? (r.listingId ? "—" : "Ngoài sàn")}
                  </small>
                </td>
                <td className={cn(TD, "hidden min-w-[140px] text-[13px] text-muted-foreground md:table-cell")}>
                  {r.address ?? "—"}
                </td>
                <td className={cn(TD, "w-[1%] whitespace-nowrap tabular-nums text-muted-foreground")}>
                  {ledgerDay(r.date)}
                </td>
                <td className={cn(TD, "w-[1%] text-center tabular-nums")}>{r.round ?? "—"}</td>
                <td className={cn(TD, "whitespace-nowrap text-right tabular-nums")}>
                  <ResultCell row={r} />
                </td>
                <td
                  className={cn(TD, "hidden w-[1%] text-[17px] text-muted-foreground md:table-cell")}
                  aria-hidden="true"
                >
                  ›
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[13px] text-muted-foreground">
        <span className="tabular-nums">
          {from + 1}–{Math.min(from + LEDGER_PAGE_SIZE, rows.length)} / {rows.length} phiên
        </span>
        <nav aria-label="Phân trang" className="flex gap-1">
          <button
            type="button"
            className={cn(
              PAGE_BTN,
              "bg-card text-foreground hover:bg-muted disabled:cursor-default disabled:opacity-50",
            )}
            disabled={current === 1}
            aria-label="Trang trước"
            onClick={() => setPage(current - 1)}
          >
            ‹
          </button>
          {pageWindow(current, pages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="flex h-8 min-w-8 items-center justify-center">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === current ? "page" : undefined}
                className={cn(
                  PAGE_BTN,
                  p === current
                    ? "bg-foreground text-background shadow-none"
                    : "bg-card text-foreground hover:bg-muted",
                )}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className={cn(
              PAGE_BTN,
              "bg-card text-foreground hover:bg-muted disabled:cursor-default disabled:opacity-50",
            )}
            disabled={current === pages}
            aria-label="Trang sau"
            onClick={() => setPage(current + 1)}
          >
            ›
          </button>
        </nav>
      </div>
    </>
  );
}

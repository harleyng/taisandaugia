import { cn } from "@/lib/utils";
import { PAGE_SIZES } from "@/lib/auctionSessions/sessionList";

interface Props {
  page: number;
  pages: number;
  size: number;
  start: number;
  total: number;
  /** Đơn vị sau tổng số: "phiên" / "hồ sơ". */
  unit?: string;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}

const BTN =
  "h-[30px] min-w-[30px] rounded-[7px] px-2 text-[13px] font-semibold text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground disabled:cursor-default disabled:opacity-40";

/** Trang số quanh trang hiện tại; nhiều trang thì gấp phần giữa thành "…". */
function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

/** Chân thẻ danh sách: "1–10 / 23 phiên" + cỡ trang + số trang (design `.lpg`). */
export function ListPager({ page, pages, size, start, total, unit = "phiên", onPage, onSize }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-[12.5px] tabular-nums text-muted-foreground sm:px-[22px]">
      <span>
        {start + 1}–{Math.min(start + size, total)} / {total} {unit}
      </span>
      <div className="flex items-center gap-1">
        <label className="mr-2.5 flex items-center gap-1.5">
          Hiển thị
          <select
            value={size}
            onChange={(e) => onSize(Number(e.target.value))}
            className="h-[30px] rounded-[7px] border-0 bg-card px-1.5 text-[12.5px] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={BTN} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
          ‹
        </button>
        {pageList(page, pages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? "page" : undefined}
              className={cn(BTN, p === page && "bg-foreground text-background enabled:hover:bg-foreground enabled:hover:text-background")}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className={BTN}
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Trang sau"
        >
          ›
        </button>
      </div>
    </div>
  );
}

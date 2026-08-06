import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES, type Pager } from "@/hooks/usePager";

const WINDOW = 4;

const btn = (active: boolean) =>
  [
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors",
    active
      ? "bg-primary text-primary-foreground font-medium"
      : "border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent",
  ].join(" ");

/** Cửa sổ số trang quanh trang hiện tại — tránh in ra hàng chục nút. */
function pageWindow(page: number, pageCount: number): number[] {
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), pageCount - WINDOW + 1));
  const end = Math.min(pageCount, start + WINDOW - 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/** Thanh phân trang cho danh sách thẻ nhúng (dùng cặp với `usePager`). */
export function ListPager({ pager }: { pager: Pager }) {
  if (pager.total <= PAGE_SIZES[0]) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 px-1 pt-1">
      <button
        type="button"
        className={btn(false)}
        disabled={pager.page <= 1}
        onClick={() => pager.setPage(pager.page - 1)}
        aria-label="Trang trước"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pageWindow(pager.page, pager.pageCount).map((p) => (
        <button
          key={p}
          type="button"
          className={btn(p === pager.page)}
          onClick={() => pager.setPage(p)}
          aria-current={p === pager.page ? "page" : undefined}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        className={btn(false)}
        disabled={pager.page >= pager.pageCount}
        onClick={() => pager.setPage(pager.page + 1)}
        aria-label="Trang sau"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <Select value={String(pager.pageSize)} onValueChange={(v) => pager.setPageSize(Number(v))}>
        <SelectTrigger className="h-8 w-[104px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZES.map((s) => (
            <SelectItem key={s} value={String(s)}>{s} / trang</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

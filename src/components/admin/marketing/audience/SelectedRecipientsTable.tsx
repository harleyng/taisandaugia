import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface RecipientItem {
  /** Khoá định danh + nguồn để định tuyến khi xoá: "u:<userId>" hoặc "e:<email>". */
  key: string;
  primary: string;
  secondary?: string | null;
}

interface Props {
  items: RecipientItem[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
}

const PAGE_SIZE = 10;

/**
 * Danh sách người nhận đã chọn — gộp "chọn thủ công" + "import" thành một bảng
 * thống nhất, có tìm kiếm + phân trang để chịu được vài nghìn dòng. Tiêu đề/đếm
 * số nằm ở header của section (không lặp lại ở đây).
 */
export function SelectedRecipientsTable({ items, onRemove, onClearAll }: Props) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (it) =>
        it.primary.toLowerCase().includes(term) ||
        (it.secondary ?? "").toLowerCase().includes(term),
    );
  }, [items, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);

  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-8 text-center">
        <Users className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-xs text-muted-foreground">
          Chưa có người nhận nào. Bấm “Thêm người nhận” để tìm hoặc import danh sách email.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Hàng lọc + xoá tất cả — luôn hiện bên trên bảng khi đã có người nhận. */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Lọc theo email hoặc tên trong danh sách…"
            className="h-9 pl-8"
          />
        </div>
        <button
          type="button"
          onClick={onClearAll}
          className="whitespace-nowrap text-xs text-muted-foreground hover:text-destructive"
        >
          Xoá tất cả
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Email
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Tên
              </th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Không tìm thấy “{q.trim()}” trong danh sách.
                </td>
              </tr>
            ) : (
              pageItems.map((it) => (
                <tr key={it.key} className="border-b border-border last:border-0">
                  <td className="max-w-0 px-3 py-2">
                    <p className="truncate text-foreground">{it.primary}</p>
                  </td>
                  <td className="max-w-0 px-3 py-2">
                    <p className="truncate text-muted-foreground">{it.secondary ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(it.key)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {(page * PAGE_SIZE + 1).toLocaleString("vi-VN")}–
            {Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString("vi-VN")} /{" "}
            {filtered.length.toLocaleString("vi-VN")}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Trang {page + 1}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

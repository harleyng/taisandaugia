import { useMemo, useState } from "react";
import { Loader2, Search, Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

export interface AudienceListRow {
  email: string;
  name: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Tổng số người thực tế (có thể lớn hơn số dòng đã tải). */
  total?: number;
  rows: AudienceListRow[];
  loading?: boolean;
  error?: boolean;
}

export function AudienceListDrawer({
  open,
  onOpenChange,
  title = "Danh sách người nhận",
  total,
  rows,
  loading = false,
  error = false,
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(term) ||
        (r.name ?? "").toLowerCase().includes(term),
    );
  }, [rows, q]);

  const totalCount = total ?? rows.length;
  const truncated = rows.length < totalCount;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="space-y-1 border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            {title}
          </SheetTitle>
          <SheetDescription>
            {totalCount.toLocaleString("vi-VN")} người · đã cho phép gửi email
          </SheetDescription>
        </SheetHeader>

        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo email hoặc tên…"
              className="h-9 pl-8"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="px-4 py-8 text-center text-sm text-destructive">
              Không tải được danh sách. Kiểm tra quyền truy cập / migration đã push chưa.
            </p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Không có người nhận đủ điều kiện.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Không tìm thấy &quot;{q.trim()}&quot; trong danh sách đã tải.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((r, i) => (
                <li key={`${r.email}-${i}`} className="px-4 py-2.5">
                  <p className="truncate text-sm text-foreground">{r.email}</p>
                  {r.name && (
                    <p className="truncate text-xs text-muted-foreground">{r.name}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {truncated && !loading && !error && (
          <div className="border-t border-border px-4 py-2.5">
            <p className="text-xs text-muted-foreground">
              Hiển thị {rows.length.toLocaleString("vi-VN")}/
              {totalCount.toLocaleString("vi-VN")} người. Dùng ô tìm kiếm để lọc trong
              danh sách đã tải.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

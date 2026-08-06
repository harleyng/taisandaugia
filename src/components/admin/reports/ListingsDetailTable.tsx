import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd } from "@/lib/advertising/slug";
import {
  useAdminListingsTable,
  hasActiveFilters,
  LISTINGS_PAGE_SIZE,
  type ListingsTableFilters,
} from "@/hooks/useListingsReport";
import { STATUS_LABELS } from "@/lib/reports/listingsReport";
import { SESSION_STATUS_LABELS } from "@/lib/listings/sessionStatus";

interface Props {
  range: { from: Date; to: Date };
  filters: ListingsTableFilters;
  /** Chỉ dùng để đổi trang — mọi tiêu chí khác do ListingsFilterBar cấp trang giữ. */
  onFiltersChange: (next: ListingsTableFilters) => void;
}

const dtf = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700",
  ACTIVE: "bg-primary/10 text-primary",
  INACTIVE: "bg-muted text-muted-foreground",
  SOLD_RENTED: "bg-green-50 text-green-700",
};

const SESSION_BADGE: Record<string, string> = {
  registration_open: "bg-primary/10 text-primary",
  upcoming: "bg-amber-50 text-amber-700",
  ongoing: "bg-green-50 text-green-700",
  ended: "bg-muted text-muted-foreground",
};

export default function ListingsDetailTable({ range, filters, onFiltersChange }: Props) {
  const { rows, total, pageCount, isLoading, isFetching } = useAdminListingsTable(range, filters);

  const from = filters.page * LISTINGS_PAGE_SIZE;
  const filtered = hasActiveFilters(filters);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <p className="text-sm font-semibold text-foreground">
        {total.toLocaleString("vi-VN")} tin khớp bộ lọc
      </p>

      {isLoading ? (
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="h-48 rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
          {filtered ? "Không có tin nào khớp bộ lọc" : "Chưa có tin nào trong khoảng thời gian đã chọn"}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tin</TableHead>
                  <TableHead className="text-xs">Trạng thái</TableHead>
                  <TableHead className="text-xs">Phiên</TableHead>
                  <TableHead className="text-xs">Khu vực</TableHead>
                  <TableHead className="text-xs text-right">Giá khởi điểm</TableHead>
                  <TableHead className="text-xs text-right">Ngày đăng</TableHead>
                  <TableHead className="text-xs text-right">Lượt xem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      <Link
                        to={`/listings/${r.id}`}
                        className="text-foreground hover:text-primary font-medium line-clamp-1 max-w-[320px]"
                        title={r.title}
                      >
                        {r.title}
                      </Link>
                      <p className="text-[11px] text-muted-foreground/70">
                        {r.categoryLabel}
                        {r.orgName ? ` · ${r.orgName}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-[11px] rounded px-1.5 py-0.5 whitespace-nowrap ${
                          STATUS_BADGE[r.status] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-[11px] rounded px-1.5 py-0.5 whitespace-nowrap ${
                          SESSION_BADGE[r.sessionStatus] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {SESSION_STATUS_LABELS[r.sessionStatus]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {r.province}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-foreground whitespace-nowrap">
                      {r.value === null ? "—" : formatVnd(r.value)}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      {dtf.format(new Date(r.createdAt))}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                      {r.views.toLocaleString("vi-VN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              Hiển thị {(from + 1).toLocaleString("vi-VN")}–
              {Math.min(from + rows.length, total).toLocaleString("vi-VN")} /{" "}
              {total.toLocaleString("vi-VN")} tin
              {isFetching && <span className="ml-2 text-muted-foreground/70">Đang cập nhật…</span>}
            </p>
            {pageCount > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onFiltersChange({ ...filters, page: Math.max(0, filters.page - 1) })}
                  disabled={filters.page === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Trước
                </button>
                <span className="text-xs text-muted-foreground tabular-nums px-1">
                  {filters.page + 1}/{pageCount}
                </span>
                <button
                  onClick={() => onFiltersChange({ ...filters, page: Math.min(pageCount - 1, filters.page + 1) })}
                  disabled={filters.page >= pageCount - 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Sau
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

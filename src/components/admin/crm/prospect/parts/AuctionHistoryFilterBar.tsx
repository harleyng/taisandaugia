import { useMemo } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FilterCombobox, { type FilterOption } from "@/components/admin/reports/FilterCombobox";
import {
  BUCKET_ORDER,
  DEFAULT_HISTORY_FILTERS,
  hasActiveHistoryFilters,
  type HistoryFilters,
} from "@/lib/prospects/auctionHistory";
import { buildUnitTree } from "@/lib/prospects/unitTree";
import { UnitScopeFilter } from "./UnitScopeFilter";
import type { AuctionHistoryRow } from "@/lib/prospects/types";

/** Gom giá trị của một cột thành options kèm số lượng, bỏ ô trống. */
function toOptions(
  rows: AuctionHistoryRow[],
  pick: (r: AuctionHistoryRow) => string | null,
  order?: string[],
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = pick(r);
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (order ? order.indexOf(a) - order.indexOf(b) : a.localeCompare(b, "vi")))
    .map(([value, n]) => ({ value, label: value, hint: `${n} tài sản` }));
}

interface Props {
  /** Toàn bộ lịch sử (chưa lọc) — options luôn đầy đủ để không tự khoá mình. */
  rows: AuctionHistoryRow[];
  filters: HistoryFilters;
  onChange: (next: HistoryFilters) => void;
}

/**
 * Bộ lọc CẤP TAB — chi phối cả KPI, biểu đồ lẫn bảng, cùng khuôn với
 * ListingsFilterBar của báo cáo Tin đấu giá.
 */
export function AuctionHistoryFilterBar({ rows, filters, onChange }: Props) {
  const patch = (next: Partial<HistoryFilters>) => onChange({ ...filters, ...next });

  // Chi nhánh và cụm là hai CẤP của cùng một cây, nên chỉ còn một bộ lọc.
  const unitTree = useMemo(() => buildUnitTree(rows), [rows]);

  const bucketOptions = useMemo(() => toOptions(rows, (r) => r.bucket, BUCKET_ORDER), [rows]);
  const typeOptions = useMemo(() => toOptions(rows, (r) => r.asset_type), [rows]);
  const provinceOptions = useMemo(() => toOptions(rows, (r) => r.province), [rows]);
  const legalOptions = useMemo(() => toOptions(rows, (r) => r.legal_status), [rows]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="Tìm theo tên tài sản, tỉnh, loại, đối tác…"
            className="pl-9 pr-8 h-9 text-sm"
          />
          {filters.q && (
            <button
              onClick={() => patch({ q: "" })}
              aria-label="Xóa tìm kiếm"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Không có chi nhánh nào thì bộ lọc vô nghĩa — buildUnitTree trả rỗng. */}
        {unitTree.length > 0 && (
          <UnitScopeFilter
            options={unitTree}
            value={filters.scope}
            onChange={(scope) => patch({ scope })}
          />
        )}

        <FilterCombobox
          label="Kết quả"
          allLabel="Mọi kết quả"
          value={filters.bucket === "all" ? null : filters.bucket}
          options={bucketOptions}
          onChange={(v) => patch({ bucket: v ?? "all" })}
        />

        <FilterCombobox
          label="Loại tài sản"
          allLabel="Mọi loại tài sản"
          value={filters.assetType === "all" ? null : filters.assetType}
          options={typeOptions}
          onChange={(v) => patch({ assetType: v ?? "all" })}
        />

        <FilterCombobox
          label="Tỉnh/TP"
          allLabel="Mọi tỉnh/thành"
          value={filters.province === "all" ? null : filters.province}
          options={provinceOptions}
          searchable
          searchPlaceholder="Tìm tỉnh/thành…"
          emptyText="Không có tỉnh nào khớp."
          onChange={(v) => patch({ province: v ?? "all" })}
        />

        <FilterCombobox
          label="Pháp lý"
          allLabel="Mọi tình trạng pháp lý"
          value={filters.legal === "all" ? null : filters.legal}
          options={legalOptions}
          searchable
          searchPlaceholder="Tìm tình trạng…"
          emptyText="Không có tình trạng nào khớp."
          onChange={(v) => patch({ legal: v ?? "all" })}
        />

        {hasActiveHistoryFilters(filters) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground hover:text-foreground gap-1.5"
            onClick={() => onChange(DEFAULT_HISTORY_FILTERS)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Xóa lọc
          </Button>
        )}
      </div>
    </div>
  );
}

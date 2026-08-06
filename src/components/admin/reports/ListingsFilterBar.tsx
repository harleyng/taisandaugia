import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Search, X, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PresetKey } from "./DateRangeGranularityBar";
import DateRangeSelect from "./DateRangeSelect";
import FilterCombobox, { type FilterOption } from "./FilterCombobox";
import {
  useEntityOptions,
  hasActiveFilters,
  DEFAULT_LISTINGS_FILTERS,
  type ListingsTableFilters,
} from "@/hooks/useListingsReport";
import {
  STATUS_LABELS,
  STATUS_ORDER,
  PARENT_LABELS,
  PARENT_SLUGS,
} from "@/lib/reports/listingsReport";
interface Props {
  // Thời gian
  range: DateRange;
  preset: PresetKey;
  onPresetChange: (p: PresetKey) => void;
  onRangeChange: (r: DateRange) => void;
  // Bộ lọc nội dung
  filters: ListingsTableFilters;
  onFiltersChange: (next: ListingsTableFilters) => void;
  /** Tỉnh có tin trong kỳ, kèm số tin — lấy từ chính báo cáo. */
  provinces: { province: string; listings: number }[];
}

const STATUS_OPTIONS: FilterOption[] = STATUS_ORDER.map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}));

const PARENT_OPTIONS: FilterOption[] = PARENT_SLUGS.map((p) => ({
  value: p,
  label: PARENT_LABELS[p],
}));

/**
 * Bộ lọc CẤP TRANG — chi phối cả biểu đồ lẫn bảng chi tiết. Mọi tiêu chí (kể cả
 * thời gian) đều là dropdown trên CÙNG MỘT HÀNG để đọc như một bộ lọc duy nhất.
 * Ngày/Tuần/Tháng KHÔNG ở đây — xem ListingsTrendChart.
 */
export default function ListingsFilterBar({
  range,
  preset,
  onPresetChange,
  onRangeChange,
  filters,
  onFiltersChange,
  provinces,
}: Props) {
  const [orgQuery, setOrgQuery] = useState("");
  const [ownerQuery, setOwnerQuery] = useState("");

  // Chỉ query khi người dùng thực sự mở dropdown lần đầu (tránh 2 request thừa mỗi lần vào trang).
  const [orgTouched, setOrgTouched] = useState(false);
  const [ownerTouched, setOwnerTouched] = useState(false);

  const orgs = useEntityOptions("auction_organizations", orgQuery, orgTouched);
  const owners = useEntityOptions("asset_owners", ownerQuery, ownerTouched);

  // Mọi thay đổi bộ lọc đều đưa bảng về trang đầu — nếu không, đang ở trang 5 mà
  // lọc lại còn 1 trang thì bảng rỗng trắng.
  const patch = (next: Partial<ListingsTableFilters>) =>
    onFiltersChange({ ...filters, ...next, page: 0 });

  const provinceOptions: FilterOption[] = provinces.map((p) => ({
    value: p.province,
    label: p.province,
    hint: `${p.listings.toLocaleString("vi-VN")} tin`,
  }));

  const toEntityOptions = (rows: { id: string; name: string }[]): FilterOption[] =>
    rows.map((r) => ({ value: r.id, label: r.name }));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="Tìm theo tên hoặc mô tả tin đăng…"
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

        <DateRangeSelect
          range={range}
          preset={preset}
          onPresetChange={onPresetChange}
          onRangeChange={onRangeChange}
        />

        <FilterCombobox
          label="Trạng thái"
          allLabel="Mọi trạng thái"
          value={filters.status === "all" ? null : filters.status}
          options={STATUS_OPTIONS}
          onChange={(v) => patch({ status: v ?? "all" })}
        />

        <FilterCombobox
          label="Loại tài sản"
          allLabel="Mọi loại tài sản"
          value={filters.parent === "all" ? null : filters.parent}
          options={PARENT_OPTIONS}
          onChange={(v) => patch({ parent: v ?? "all" })}
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
          label="Tổ chức ĐG"
          allLabel="Mọi tổ chức đấu giá"
          value={filters.org?.id ?? null}
          valueLabel={filters.org?.name}
          options={toEntityOptions(orgs.options)}
          searchable
          searchPlaceholder="Tìm tổ chức đấu giá…"
          emptyText="Không tìm thấy tổ chức."
          onQueryChange={(q) => {
            setOrgTouched(true);
            setOrgQuery(q);
          }}
          loading={orgs.isFetching && orgs.options.length === 0}
          onChange={(v, label) => patch({ org: v ? { id: v, name: label } : null })}
        />

        <FilterCombobox
          label="Chủ tài sản"
          allLabel="Mọi chủ tài sản"
          value={filters.owner?.id ?? null}
          valueLabel={filters.owner?.name}
          options={toEntityOptions(owners.options)}
          searchable
          searchPlaceholder="Tìm chủ tài sản…"
          emptyText="Không tìm thấy chủ tài sản."
          onQueryChange={(q) => {
            setOwnerTouched(true);
            setOwnerQuery(q);
          }}
          loading={owners.isFetching && owners.options.length === 0}
          onChange={(v, label) => patch({ owner: v ? { id: v, name: label } : null })}
        />

        {hasActiveFilters(filters) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground hover:text-foreground gap-1.5"
            onClick={() => onFiltersChange(DEFAULT_LISTINGS_FILTERS)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Xóa lọc
          </Button>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  useListingsReport,
  DEFAULT_LISTINGS_FILTERS,
  type ListingsTableFilters,
} from "@/hooks/useListingsReport";
import type { Granularity } from "@/lib/reports/transactionReport";
import { type PresetKey } from "@/components/admin/reports/DateRangeGranularityBar";
import ListingsFilterBar from "@/components/admin/reports/ListingsFilterBar";
import ListingsKpiCards from "@/components/admin/reports/ListingsKpiCards";
import ListingsTrendChart from "@/components/admin/reports/ListingsTrendChart";
import ListingsStatusChart from "@/components/admin/reports/ListingsStatusChart";
import ListingsByCategoryChart from "@/components/admin/reports/ListingsByCategoryChart";
import ListingsCategoryDetailTable from "@/components/admin/reports/ListingsCategoryDetailTable";
import ListingsByProvinceChart from "@/components/admin/reports/ListingsByProvinceChart";
import ListingsPriceBucketChart from "@/components/admin/reports/ListingsPriceBucketChart";
import ListingsTopEntitiesTable from "@/components/admin/reports/ListingsTopEntitiesTable";
import ListingsCoveragePanel from "@/components/admin/reports/ListingsCoveragePanel";
import ListingsDetailTable from "@/components/admin/reports/ListingsDetailTable";

/** Granularity mặc định gợi ý theo preset (page sở hữu mapping này, bar giữ dumb). */
const presetGranularity: Record<PresetKey, Granularity> = {
  "7d": "day",
  "30d": "day",
  thisMonth: "day",
  "3m": "week",
  "12m": "month",
  thisYear: "month",
  custom: "day",
};

export default function ListingsReportPage() {
  const [range, setRange] = useState<DateRange>({ from: subDays(new Date(), 364), to: new Date() });
  const [preset, setPreset] = useState<PresetKey>("12m");
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [filters, setFilters] = useState<ListingsTableFilters>(DEFAULT_LISTINGS_FILTERS);

  const from = range.from ?? subDays(new Date(), 364);
  const to = range.to ?? range.from ?? new Date();

  const { report, isLoading, isFetching } = useListingsReport({ from, to }, granularity, filters);
  const loading = isLoading;

  const handlePreset = (p: PresetKey) => {
    setPreset(p);
    if (p !== "custom") setGranularity(presetGranularity[p]);
  };

  // Bộ lọc tỉnh của bảng chi tiết chỉ hiện tỉnh thực sự có tin trong kỳ.
  const provinceOptions = useMemo(
    () =>
      report.byProvince
        .filter((p) => p.province !== "Không rõ")
        .map((p) => ({ province: p.province, listings: p.listings })),
    [report.byProvince],
  );

  return (
    <div className="px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Tin đấu giá</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tồn kho & phân bổ tài sản trên sàn: trạng thái, nhóm tài sản, khu vực, khoảng giá và nguồn
          cung.{" "}
          <span className="text-muted-foreground/70">
            Khoảng ngày lọc theo ngày đăng tin; số liệu gồm cả tin nội bộ (nháp / chờ duyệt / ngừng
            hiển thị).
          </span>
        </p>
      </div>

      {/* Bộ lọc cấp trang — chi phối cả biểu đồ lẫn bảng chi tiết */}
      <ListingsFilterBar
        range={range}
        preset={preset}
        onPresetChange={handlePreset}
        onRangeChange={setRange}
        filters={filters}
        onFiltersChange={setFilters}
        provinces={provinceOptions}
      />

      {/* KPIs */}
      <ListingsKpiCards kpis={report.kpis} loading={loading} />

      {/* Phần A — Nguồn cung theo thời gian */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Tin mới theo thời gian</h2>
          <p className="text-xs text-muted-foreground">
            Tốc độ tin đổ về sàn và giá trị đi kèm — chọn mức gộp ngay trên biểu đồ
          </p>
        </div>
        <ListingsTrendChart
          data={report.timeSeries}
          loading={loading}
          granularity={granularity}
          onGranularityChange={setGranularity}
        />
      </section>

      {/* Phần B — Trạng thái */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Trạng thái tin & phiên</h2>
          <p className="text-xs text-muted-foreground">
            Sức khỏe pipeline duyệt tin và lượng tài sản còn đấu giá được
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ListingsStatusChart data={report.byStatus} mode="status" loading={loading} />
          <ListingsStatusChart data={report.bySessionStatus} mode="session" loading={loading} />
        </div>
      </section>

      {/* Phần C — Nhóm tài sản */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Cơ cấu theo nhóm tài sản</h2>
          <p className="text-xs text-muted-foreground">
            Sàn đang mạnh ở nhóm nào và loại nào chưa được phân nhóm
          </p>
        </div>
        <ListingsByCategoryChart data={report.byCategory} loading={loading} />
        <ListingsCategoryDetailTable data={report.byCategoryChild} loading={loading} />
      </section>

      {/* Phần D — Địa lý & khoảng giá */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Địa lý & khoảng giá</h2>
          <p className="text-xs text-muted-foreground">
            Tài sản tập trung ở đâu và ở tầm tiền nào
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ListingsByProvinceChart data={report.byProvince} loading={loading} />
          <ListingsPriceBucketChart data={report.byPriceBucket} loading={loading} />
        </div>
      </section>

      {/* Phần E — Nguồn cung */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Nguồn cung</h2>
          <p className="text-xs text-muted-foreground">
            Ai đang đưa tài sản lên sàn nhiều nhất trong kỳ
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ListingsTopEntitiesTable
            title="Top tổ chức đấu giá"
            subtitle="Theo số tin đăng trong kỳ"
            nameHeader="Tổ chức đấu giá"
            rows={report.topOrgs}
            loading={loading}
          />
          <ListingsTopEntitiesTable
            title="Top chủ tài sản"
            subtitle="Theo số tin đăng trong kỳ"
            nameHeader="Chủ tài sản"
            rows={report.topOwners}
            loading={loading}
          />
        </div>
      </section>

      {/* Phần F — Chất lượng dữ liệu */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Chất lượng dữ liệu</h2>
          <p className="text-xs text-muted-foreground">
            Trường nào đang thiếu nhiều trong kho tin
          </p>
        </div>
        <ListingsCoveragePanel data={report.coverage} loading={loading} />
      </section>

      {/* Phần G — Bảng chi tiết */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Danh sách tin</h2>
          <p className="text-xs text-muted-foreground">
            Áp dụng cùng bộ lọc phía trên — bấm tiêu đề để mở tin
          </p>
        </div>
        <ListingsDetailTable range={{ from, to }} filters={filters} onFiltersChange={setFilters} />
      </section>

      {isFetching && !loading && (
        <p className="text-xs text-muted-foreground text-center">Đang cập nhật…</p>
      )}
    </div>
  );
}

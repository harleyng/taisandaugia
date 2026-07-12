import { useState } from "react";
import { subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useAccessAnalytics } from "@/hooks/useAccessAnalytics";
import type { Granularity } from "@/lib/reports/transactionReport";
import DateRangeGranularityBar, {
  type PresetKey,
} from "@/components/admin/reports/DateRangeGranularityBar";
import AccessKpiCards from "@/components/admin/reports/AccessKpiCards";
import AccessTrendChart from "@/components/admin/reports/AccessTrendChart";
import TopPagesTable from "@/components/admin/reports/TopPagesTable";
import FeatureUsageChart from "@/components/admin/reports/FeatureUsageChart";
import FeatureUsageTable from "@/components/admin/reports/FeatureUsageTable";
import DeviceBreakdownChart from "@/components/admin/reports/DeviceBreakdownChart";
import ProvinceBreakdownChart from "@/components/admin/reports/ProvinceBreakdownChart";
import ConversionFunnelChart from "@/components/admin/reports/ConversionFunnelChart";

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

export default function AccessAnalyticsReportPage() {
  const [range, setRange] = useState<DateRange>({ from: subDays(new Date(), 29), to: new Date() });
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [calOpen, setCalOpen] = useState(false);

  const from = range.from ?? subDays(new Date(), 29);
  const to = range.to ?? range.from ?? new Date();

  const { report, isLoading, isFetching } = useAccessAnalytics({ from, to }, granularity);
  const loading = isLoading;

  const handlePreset = (p: PresetKey) => {
    setPreset(p);
    if (p !== "custom") setGranularity(presetGranularity[p]);
  };

  return (
    <div className="px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Phân tích truy cập</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Hành vi sử dụng của người dùng trên sàn: lượt truy cập, tính năng, thiết bị, địa lý & phễu chuyển đổi.{" "}
          <span className="text-muted-foreground/70">
            Dữ liệu thật tích lũy từ khi bật tracking; giai đoạn trước là dữ liệu mẫu.
          </span>
        </p>
      </div>

      {/* Filter */}
      <DateRangeGranularityBar
        range={range}
        preset={preset}
        granularity={granularity}
        onPresetChange={handlePreset}
        onRangeChange={setRange}
        onGranularityChange={setGranularity}
        calOpen={calOpen}
        onCalOpenChange={setCalOpen}
      />

      {/* KPIs */}
      <AccessKpiCards kpis={report.kpis} loading={loading} />

      {/* Phần A — Lưu lượng truy cập theo thời gian (chart #1) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Lượt truy cập theo thời gian</h2>
          <p className="text-xs text-muted-foreground">Lượt truy cập (phiên) & lượt xem trang</p>
        </div>
        <AccessTrendChart data={report.timeSeries} loading={loading} />
      </section>

      {/* Phần B — Phễu chuyển đổi (chart #2) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Phễu chuyển đổi</h2>
          <p className="text-xs text-muted-foreground">Từ khách truy cập tới người tiêu credit</p>
        </div>
        <ConversionFunnelChart data={report.funnel} loading={loading} />
      </section>

      {/* Phần C — Trang được xem nhiều */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Tổng truy cập các trang</h2>
          <p className="text-xs text-muted-foreground">Các trang được xem nhiều nhất trên sàn</p>
        </div>
        <TopPagesTable data={report.topPages} loading={loading} />
      </section>

      {/* Phần D — Tính năng */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Tính năng được sử dụng</h2>
          <p className="text-xs text-muted-foreground">Tính năng dùng nhiều nhất theo lượt và theo người</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FeatureUsageChart data={report.byFeature} loading={loading} />
          <FeatureUsageTable data={report.byFeature} />
        </div>
      </section>

      {/* Phần E — Thiết bị & Địa lý */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Thiết bị & Địa lý</h2>
          <p className="text-xs text-muted-foreground">Phân bố lượt truy cập theo thiết bị và tỉnh/thành</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DeviceBreakdownChart data={report.byDevice} loading={loading} />
          <ProvinceBreakdownChart data={report.byProvince} loading={loading} />
        </div>
      </section>

      {isFetching && !loading && (
        <p className="text-xs text-muted-foreground text-center">Đang cập nhật…</p>
      )}
    </div>
  );
}

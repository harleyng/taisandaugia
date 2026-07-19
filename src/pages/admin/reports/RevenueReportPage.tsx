import { useState } from "react";
import { subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useRevenueReport } from "@/hooks/useRevenueReport";
import type { Granularity } from "@/lib/reports/transactionReport";
import DateRangeGranularityBar, {
  type PresetKey,
} from "@/components/admin/reports/DateRangeGranularityBar";
import RevenueSourceKpis from "@/components/admin/reports/RevenueSourceKpis";
import RevenueBySourceChart from "@/components/admin/reports/RevenueBySourceChart";
import RevenueByAudienceChart from "@/components/admin/reports/RevenueByAudienceChart";
import RevenueSourceTrendChart from "@/components/admin/reports/RevenueSourceTrendChart";
import RevenueByServiceTable from "@/components/admin/reports/RevenueByServiceTable";
import TopVariantsTable from "@/components/admin/reports/TopVariantsTable";

/** Granularity mặc định gợi ý theo preset (page sở hữu mapping này). */
const presetGranularity: Record<PresetKey, Granularity> = {
  "7d": "day",
  "30d": "day",
  thisMonth: "day",
  "3m": "week",
  "12m": "month",
  thisYear: "month",
  custom: "day",
};

export default function RevenueReportPage() {
  const [range, setRange] = useState<DateRange>({ from: subDays(new Date(), 29), to: new Date() });
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [calOpen, setCalOpen] = useState(false);

  const from = range.from ?? subDays(new Date(), 29);
  const to = range.to ?? range.from ?? new Date();

  const { report, isLoading, isFetching } = useRevenueReport({ from, to }, granularity);
  const loading = isLoading;

  const handlePreset = (p: PresetKey) => {
    setPreset(p);
    if (p !== "custom") setGranularity(presetGranularity[p]);
  };

  return (
    <div className="px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Doanh thu</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Hợp nhất doanh thu từ nạp credit, dịch vụ bán trực tiếp và hoa hồng môi giới, phân theo nguồn.{" "}
          <span className="text-muted-foreground/70">
            Mỗi lần nạp credit là một đơn hàng (ghi nhận lúc nạp, không tính lại lúc tiêu credit);
            môi giới ghi nhận theo hoa hồng thực nhận (net), không tính giá trị hợp đồng; đơn đã hủy không tính.
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
      <RevenueSourceKpis kpis={report.kpis} loading={loading} />

      {/* Nguồn + xu hướng */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueBySourceChart data={report.bySource} loading={loading} />
        <RevenueSourceTrendChart data={report.timeSeries} loading={loading} />
      </section>

      {/* Theo đối tượng + top gói */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueByAudienceChart data={report.byAudience} loading={loading} />
        <TopVariantsTable data={report.topVariants} />
      </section>

      {/* Theo dịch vụ */}
      <section className="space-y-4">
        <RevenueByServiceTable data={report.byService} />
      </section>

      {isFetching && !loading && (
        <p className="text-xs text-muted-foreground text-center">Đang cập nhật…</p>
      )}
    </div>
  );
}

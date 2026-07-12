import { useState } from "react";
import { subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useTransactionReport } from "@/hooks/useTransactionReport";
import type { Granularity } from "@/lib/reports/transactionReport";
import DateRangeGranularityBar, {
  type PresetKey,
} from "@/components/admin/reports/DateRangeGranularityBar";
import ReportKpiCards from "@/components/admin/reports/ReportKpiCards";
import RevenueTrendChart from "@/components/admin/reports/RevenueTrendChart";
import RevenueByPackageChart from "@/components/admin/reports/RevenueByPackageChart";
import CreditConsumptionChart from "@/components/admin/reports/CreditConsumptionChart";
import CreditConsumptionTable from "@/components/admin/reports/CreditConsumptionTable";
import TransactionDetailTable from "@/components/admin/reports/TransactionDetailTable";

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

export default function TransactionReportPage() {
  const [range, setRange] = useState<DateRange>({ from: subDays(new Date(), 29), to: new Date() });
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [calOpen, setCalOpen] = useState(false);

  // Range cụ thể cho hook (calendar có thể tạm thời chỉ có `from`).
  const from = range.from ?? subDays(new Date(), 29);
  const to = range.to ?? range.from ?? new Date();

  const { report, isLoading, isFetching } = useTransactionReport({ from, to }, granularity);
  const loading = isLoading;

  const handlePreset = (p: PresetKey) => {
    setPreset(p);
    if (p !== "custom") setGranularity(presetGranularity[p]);
  };

  return (
    <div className="px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Báo cáo giao dịch</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Doanh thu nạp credit & tiêu dùng credit theo tính năng.{" "}
          <span className="text-muted-foreground/70">
            Doanh thu được suy ra từ các gói nạp (chưa tích hợp cổng thanh toán thật).
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
      <ReportKpiCards kpis={report.kpis} loading={loading} />

      {/* Phần A — Doanh thu */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Doanh thu</h2>
          <p className="text-xs text-muted-foreground">Tiền vào từ hoạt động nạp credit</p>
        </div>
        <RevenueTrendChart data={report.timeSeries} loading={loading} />
        <RevenueByPackageChart data={report.byPackage} loading={loading} />
      </section>

      {/* Phần B — Tiêu dùng credit theo tính năng */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Tiêu dùng credit theo tính năng</h2>
          <p className="text-xs text-muted-foreground">Credit người dùng chi cho từng tính năng trả phí</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CreditConsumptionChart data={report.byFeature} loading={loading} />
          <CreditConsumptionTable data={report.byFeature} />
        </div>
      </section>

      {/* Chi tiết giao dịch */}
      <section className="space-y-4">
        <TransactionDetailTable rows={report.transactions} />
      </section>

      {isFetching && !loading && (
        <p className="text-xs text-muted-foreground text-center">Đang cập nhật…</p>
      )}
    </div>
  );
}

import { Scale } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerBenchmark } from "@/hooks/useOwnerBenchmark";
import {
  bandGeometry,
  hasQuartiles,
  positionSentence,
  type BenchmarkMetric,
  type BenchmarkMetricKind,
} from "@/lib/ownerBenchmark";

const LABEL: Record<BenchmarkMetricKind, string> = {
  success: "Tỷ lệ thành công · 12 tháng",
  days: "Thời gian đến khi bán · trung vị",
};
const UNIT: Record<BenchmarkMetricKind, string> = { success: "%", days: "ngày" };

const fmt = (v: number, kind: BenchmarkMetricKind) => (kind === "success" ? `${v}%` : `${v} ngày`);

function MetricRow({ kind, metric }: { kind: BenchmarkMetricKind; metric: BenchmarkMetric | null }) {
  if (!metric) {
    return (
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground">{LABEL[kind]}</p>
        <p className="text-sm text-muted-foreground">Chưa đủ chi nhánh có số liệu để so sánh.</p>
      </div>
    );
  }

  const sentence = positionSentence(metric, kind);
  if (!hasQuartiles(metric)) {
    return (
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground">{LABEL[kind]}</p>
        <p className="text-sm font-medium text-foreground">{sentence}</p>
      </div>
    );
  }

  const g = bandGeometry(metric, kind);
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs text-muted-foreground">{LABEL[kind]}</p>
      <p className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{metric.self ?? "—"}</span>
        {metric.self != null && <span className="text-sm text-muted-foreground">{UNIT[kind]}</span>}
      </p>
      {/* Dải giữa (p25–p75) của hệ thống, vạch trung vị, chấm = đơn vị bạn. */}
      <div className="relative h-4" aria-hidden="true">
        <div className="absolute inset-x-0 top-1.5 h-1 rounded-full bg-muted" />
        <div
          className="absolute top-1 h-2 rounded-full bg-primary/20"
          style={{ left: `${g.bandLeft}%`, width: `${g.bandWidth}%` }}
        />
        <div className="absolute top-0 h-4 w-0.5 -translate-x-1/2 bg-foreground/60" style={{ left: `${g.median}%` }} />
        {g.self !== null && (
          <div
            className="absolute top-0.5 h-3 w-3 -translate-x-1/2 rounded-full bg-primary ring-2 ring-card"
            style={{ left: `${g.self}%` }}
          />
        )}
      </div>
      <p className="text-sm text-foreground">{sentence}</p>
      <p className="text-xs tabular-nums text-muted-foreground">
        Trung vị {fmt(metric.p50, kind)} · nửa giữa {metric.p25}–{fmt(metric.p75, kind)}
      </p>
    </div>
  );
}

/**
 * So sánh ẩn danh với các chi nhánh cùng hệ thống (Phase 14) — tầng L3 của Nhịp đập.
 * Không hiện gì khi không đủ chi nhánh, khi Trạm không có công ty mẹ trong danh bạ,
 * hoặc khi đang xem Trạm với tư cách trụ sở.
 */
export function BenchmarkBlock() {
  const { workspaceId, accessVia } = useOwnerWorkspace();
  const { data } = useOwnerBenchmark(workspaceId, accessVia === "member");

  if (!data?.available) return null;

  return (
    <SectionCard title="So với chi nhánh cùng hệ thống" icon={Scale}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <MetricRow kind="success" metric={data.successRate} />
        <MetricRow kind="days" metric={data.daysToSale} />
      </div>
      <p className="text-xs text-muted-foreground">
        Ẩn danh: chỉ so với các chi nhánh cùng công ty mẹ đang dùng Trạm Điều Hành, không nêu tên đơn vị nào.
        Số chi tiết chỉ hiện khi có từ 5 chi nhánh.
      </p>
    </SectionCard>
  );
}

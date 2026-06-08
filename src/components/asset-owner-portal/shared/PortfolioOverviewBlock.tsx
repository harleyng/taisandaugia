import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileBarChart2 } from "lucide-react";
import type { PortfolioMetrics } from "@/hooks/useOwnerPortfolioMetrics";

interface Props {
  metrics: PortfolioMetrics;
  loading: boolean;
}

interface KpiItem {
  label: string;
  value: string;
  sub: string;
}

export function PortfolioOverviewBlock({ metrics, loading }: Props) {
  const navigate = useNavigate();

  if (loading) {
    return <Skeleton className="h-[140px] rounded-2xl" />;
  }

  const kpis: KpiItem[] = [
    {
      label: "Tổng tài sản",
      value: metrics.totalAssets.toString(),
      sub: "trong danh mục",
    },
    {
      label: "Tổng giá KĐ",
      value: metrics.totalStartingPriceLabel,
      sub: "giá khởi điểm tích lũy",
    },
    {
      label: "Tỷ lệ thành công",
      value: `${metrics.successRate}%`,
      sub: "tài sản đấu thành",
    },
    {
      label: "Đang tồn đọng",
      value: metrics.pendingCount.toString(),
      sub: "tài sản ≥ 2 vòng",
    },
  ];

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {kpis.map(({ label, value, sub }) => (
          <div key={label}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {label}
            </p>
            <p className="text-2xl font-bold text-foreground mt-0.5 truncate">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Divider + CTA */}
      <div className="border-t pt-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Phân tích chi tiết theo tổ chức, loại tài sản và xu hướng giá
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          onClick={() => navigate("/chu-tai-san/bao-cao")}
        >
          <FileBarChart2 className="w-3.5 h-3.5" />
          Xem báo cáo chi tiết
        </Button>
      </div>
    </div>
  );
}

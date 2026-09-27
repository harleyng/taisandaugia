import { useNavigate } from "react-router-dom";
import { ArrowRight, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import type { OverviewKpis, WeekPoint } from "@/lib/ownerOverview";
import { CumulativeWinChart } from "./CumulativeWinChart";
import { OverviewKpiGrid } from "./OverviewKpiGrid";

interface PortfolioAnalysisBlockProps {
  chart: WeekPoint[];
  kpis: OverviewKpis;
  periodLabel: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

/** Phân tích danh mục trên Tổng quan: giá trúng lũy kế (trái) + 4 KPI so với cùng kỳ (phải). */
export function PortfolioAnalysisBlock({ chart, kpis, periodLabel, loading, error, onRetry }: PortfolioAnalysisBlockProps) {
  const navigate = useNavigate();
  const hasWins = chart.some((p) => (p.current ?? 0) > 0 || p.previous > 0);

  return (
    <SectionCard
      title="Phân tích danh mục"
      icon={BarChart2}
      actions={
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-xs text-muted-foreground"
          onClick={() => navigate("/chu-tai-san/bao-cao")}
        >
          Xem chi tiết
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </Button>
      }
    >
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-12" aria-busy="true">
          <Skeleton className="h-[280px] rounded-xl lg:col-span-7" />
          <Skeleton className="h-[280px] rounded-xl lg:col-span-5" />
        </div>
      ) : error ? (
        <EmptyState
          compact
          icon={BarChart2}
          tone="warning"
          title="Chưa tải được kết quả phiên."
          action={
            <Button variant="outline" size="sm" onClick={onRetry}>
              Thử lại
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-1 lg:col-span-7">
            <p className="text-sm font-medium text-foreground">Giá trúng lũy kế theo tuần</p>
            {hasWins ? (
              <CumulativeWinChart points={chart} periodLabel={periodLabel} />
            ) : (
              <EmptyState
                compact
                icon={BarChart2}
                className="mt-2"
                title={`Chưa có tài sản đấu thành trong ${periodLabel} và cùng kỳ năm trước.`}
              />
            )}
          </div>
          <div className="min-w-0 lg:col-span-5">
            <OverviewKpiGrid kpis={kpis} />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

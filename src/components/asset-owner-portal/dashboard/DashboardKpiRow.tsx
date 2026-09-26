import { Banknote, Clock, Gavel, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/asset-owner-portal/ui/StatTile";
import { isSoldRow, type PortfolioMetrics } from "@/hooks/useOwnerPortfolioMetrics";
import { formatMoneyShort, moneyShortParts } from "@/utils/money";

interface DashboardKpiRowProps {
  metrics: PortfolioMetrics;
  loading: boolean;
}

const GRID = "grid grid-cols-2 gap-4 lg:grid-cols-4";

/**
 * Hàng KPI của "Nhịp đập" — đọc kết quả ĐÃ HỢP NHẤT nguồn (Phase 7): "Giá trúng"
 * thay ô "Tổng giá KĐ" (giá KĐ chuyển xuống dòng bối cảnh của "Tổng tài sản").
 * PortfolioOverviewBlock của trang báo cáo giữ nguyên 4 chỉ số cũ.
 */
export function DashboardKpiRow({ metrics, loading }: DashboardKpiRowProps) {
  if (loading) {
    return (
      <div className={GRID}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[116px] rounded-2xl" />
        ))}
      </div>
    );
  }

  const soldRows = metrics.allListings.filter(isSoldRow);
  const pricedRows = soldRows.filter((r) => r.winPrice !== null && r.winPrice > 0);
  const winTotal = moneyShortParts(pricedRows.reduce((s, r) => s + (r.winPrice ?? 0), 0));

  return (
    <div className={GRID}>
      <StatTile
        label="Tổng tài sản"
        value={metrics.totalAssets.toLocaleString("en-US")}
        context={`Giá KĐ ${formatMoneyShort(metrics.totalStartingPrice)}`}
        icon={Package}
      />
      <StatTile
        label="Tỷ lệ thành công"
        value={String(metrics.successRate)}
        unit="%"
        context={`${soldRows.length.toLocaleString("en-US")} tài sản đấu thành`}
        icon={Gavel}
      />
      <StatTile
        label="Giá trúng"
        value={winTotal.value}
        unit={winTotal.unit}
        context={`${pricedRows.length.toLocaleString("en-US")} tài sản có giá trúng`}
        icon={Banknote}
      />
      <StatTile
        label="Đang tồn đọng"
        value={metrics.pendingCount.toLocaleString("en-US")}
        context="tài sản ≥ 2 vòng"
        icon={Clock}
        tone={metrics.pendingCount > 0 ? "warning" : "primary"}
      />
    </div>
  );
}

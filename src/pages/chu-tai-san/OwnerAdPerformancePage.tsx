import { useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import {
  ASSET_FILTER_ALL,
  MarketingPerformanceTab,
} from "@/components/asset-owner-portal/marketing/performance/MarketingPerformanceTab";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { DEFAULT_FUNNEL_PERIOD, FUNNEL_PERIODS, type FunnelPeriod } from "@/lib/ownerMarketing/funnel";

// Kỳ + lọc một tài sản (listings.id).
const DEFAULTS = { ky: DEFAULT_FUNNEL_PERIOD, "tai-san": ASSET_FILTER_ALL };
const ALLOWED = { ky: FUNNEL_PERIODS } as const;

/**
 * /chu-tai-san/hieu-qua-quang-cao — nhóm Phân tích: kênh nào mang khách về, theo kỳ và theo
 * từng tài sản (phễu owner_mkt_funnel, Phase M5). Trước là tab "Hiệu quả" của Truyền thông;
 * link cũ `?tab=hieu-qua` được OwnerMarketingPage chuyển hướng về đây.
 */
export default function OwnerAdPerformancePage() {
  const navigate = useNavigate();
  const { workspaceId, isLoading } = useOwnerWorkspace();
  const [f, setFilter] = useUrlFilterState(DEFAULTS, ALLOWED);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <OwnerNoWorkspaceState icon={BarChart3}>
        <EmptyState
          icon={BarChart3}
          title="Chưa có không gian làm việc"
          description="Hiệu quả quảng cáo dành cho chủ tài sản là tổ chức đã xác thực, hoặc người được một đơn vị mời vào."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Hiệu quả quảng cáo"
        subtitle="Kênh nào mang khách về — theo kỳ và theo từng tài sản."
      />
      <MarketingPerformanceTab period={f.ky as FunnelPeriod} asset={f["tai-san"]} onFilter={setFilter} />
    </div>
  );
}

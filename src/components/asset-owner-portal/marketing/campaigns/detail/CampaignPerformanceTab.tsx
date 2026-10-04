import { useState } from "react";
import { BarChart3, Link2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ShareStatsPanel } from "@/components/asset-owner-portal/marketing/share-links/ShareStatsPanel";
import { ShareLinksTable } from "@/components/asset-posting/share/ShareLinksTable";
import { useCampaignShareSeries } from "@/hooks/useShareLinks";
import type { PostingShareLink } from "@/lib/postingShare/types";
import { DEFAULT_SHARE_PERIOD, type ShareDeviceFilter, type SharePeriod } from "@/lib/shareLinks/series";

interface CampaignPerformanceTabProps {
  campaignId: string;
  approved: boolean;
  links: PostingShareLink[] | undefined;
  isLoading: boolean;
}

/**
 * Tab "Hiệu quả" của chiến dịch: biểu đồ gộp mọi link Hồ sơ online của chiến dịch theo ngày +
 * bảng từng link (tài sản × kênh); bấm một link ⇒ trang chi tiết link. Phễu tới đăng ký tham
 * gia ở trang "Hiệu quả quảng cáo".
 */
export function CampaignPerformanceTab({ campaignId, approved, links, isLoading }: CampaignPerformanceTabProps) {
  const [period, setPeriod] = useState<SharePeriod>(DEFAULT_SHARE_PERIOD);
  const [device, setDevice] = useState<ShareDeviceFilter>("all");
  const series = useCampaignShareSeries(campaignId, period, device, approved && !!links?.length);

  if (!approved) {
    return (
      <div className="rounded-2xl bg-card shadow-card">
        <EmptyState
          icon={BarChart3}
          tone="muted"
          title="Chưa có số liệu"
          description="Link Hồ sơ online được tạo khi chiến dịch được duyệt; lượt xem hiện ở đây sau khi đơn vị gửi đi."
        />
      </div>
    );
  }
  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!links?.length) {
    return (
      <div className="rounded-2xl bg-card shadow-card">
        <EmptyState
          icon={Link2}
          tone="muted"
          title="Không có link nào"
          description="Link của chiến dịch nằm ngoài phạm vi chi nhánh của bạn, hoặc tài sản đã rời đơn vị."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-card p-5 shadow-card">
        <ShareStatsPanel
          series={series.data}
          isLoading={series.isLoading}
          isError={series.isError}
          onRetry={() => void series.refetch()}
          period={period}
          device={device}
          onPeriod={setPeriod}
          onDevice={setDevice}
          allLabel="Từ khi duyệt"
        />
      </section>
      <section className="rounded-2xl bg-card p-4 shadow-card sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-foreground">Từng link ({links.length})</h2>
        <ShareLinksTable links={links} canShare={false} showAsset />
      </section>
    </div>
  );
}

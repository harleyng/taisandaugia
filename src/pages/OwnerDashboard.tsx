import { useNavigate } from "react-router-dom";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LayoutDashboard, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerPulse } from "@/hooks/useOwnerPulse";
import { useOwnerTargetProgress } from "@/hooks/useOwnerTargets";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { DashboardKpiRow } from "@/components/asset-owner-portal/dashboard/DashboardKpiRow";
import { UpcomingAuctionsBlock } from "@/components/asset-owner-portal/dashboard/UpcomingAuctionsBlock";
import { PendingConfirmationsBlock } from "@/components/asset-owner-portal/dashboard/PendingConfirmationsBlock";
import { StuckAssetsBlock } from "@/components/asset-owner-portal/dashboard/StuckAssetsBlock";
import { OutcomeDueBlock } from "@/components/asset-owner-portal/pulse/OutcomeDueBlock";
import { AwaitingPaymentBlock } from "@/components/asset-owner-portal/pulse/AwaitingPaymentBlock";
import { TargetProgressBlock } from "@/components/asset-owner-portal/targets/TargetProgressBlock";
import { BenchmarkBlock } from "@/components/asset-owner-portal/benchmark/BenchmarkBlock";
import type { ListingRow } from "@/hooks/useOwnerPortfolioMetrics";

const OwnerDashboard = () => {
  const navigate = useNavigate();

  // Không gian theo tư cách thành viên (kể cả người được mời), không theo người tạo.
  const { workspaceId, isLoading: loading } = useOwnerWorkspace();

  // Chỉ số + việc cần làm (cùng cache với huy hiệu "Nhịp đập" ở sidebar).
  const { metrics, outcomeDue, awaitingPayment, isLoading: metricsLoading } = useOwnerPulse();

  // L1 — chỉ tiêu kỳ này (dùng chung cache kết quả hợp nhất với các khối dưới).
  const targetProgress = useOwnerTargetProgress();

  // Direct query for pending_confirmation claims — bypasses metrics join issue
  const { data: pendingClaims = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-claims-dashboard", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_claims")
        .select(`
          id, confidence_score, matched_name,
          listing:listings(id, title, price, image_url, address, custom_attributes)
        `)
        .eq("workspace_id", workspaceId!)
        .eq("status", "pending_confirmation")
        .order("confidence_score", { ascending: true })
        .limit(5);
      if (error) throw error;
      return (data ?? []).filter((c) => c.listing !== null);
    },
    enabled: !!workspaceId,
    staleTime: 2 * 60_000,
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const pendingItems: ListingRow[] = pendingClaims.map((c): ListingRow => {
    const l = c.listing as any;
    return {
      id: l?.id ?? c.id,
      title: l?.title ?? "—",
      price: Number(l?.price ?? 0),
      priceUnit: "TOTAL",
      listingStatus: "",
      sessionStatus: "",
      propertyTypeSlug: "",
      province: "",
      auctionOrgId: null,
      auctionOrgName: null,
      winPrice: null,
      resolvedOutcome: null,
      confidenceLabel: null,
      hasConflict: false,
      auctionTime: l?.custom_attributes?.auction_time ?? l?.custom_attributes?.auction_date ?? null,
      registrationDeadline: null,
      imageUrl: l?.image_url ?? null,
      roundCount: 0,
      priceHistory: [],
      legalStatus: null,
      matchedName: c.matched_name ?? null,
      claimStatus: "pending_confirmation",
      confidenceScore: c.confidence_score ?? null,
      assetOwnerId: null,
    };
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // ─── Guards ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <OwnerNoWorkspaceState icon={LayoutDashboard}>
        <div className="py-24">
          <EmptyState
            icon={LayoutDashboard}
            title="Bạn chưa có workspace Chủ tài sản."
            action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Bắt đầu KYC</Button>}
          />
        </div>
      </OwnerNoWorkspaceState>
    );
  }

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Tổng quan"
        subtitle="Việc cần làm hôm nay và toàn cảnh danh mục của đơn vị bạn."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/chu-tai-san/bao-cao")}>
            <BarChart2 className="h-4 w-4" strokeWidth={1.5} />
            Xem phân tích danh mục
          </Button>
        }
      />

      {/* L1 — đã thu bao nhiêu so với chỉ tiêu kỳ này */}
      <TargetProgressBlock
        workspaceId={workspaceId}
        targets={targetProgress.targets}
        progress={targetProgress.progress}
        branches={targetProgress.branches}
        preferredBranchIds={targetProgress.preferredBranchIds}
        canManage={targetProgress.canManage}
        loading={targetProgress.isLoading}
      />

      {/* Chỉ số danh mục — theo kết quả đã hợp nhất nguồn */}
      <DashboardKpiRow metrics={metrics} loading={metricsLoading} />

      {/* So sánh ẩn danh với chi nhánh cùng hệ thống — tự ẩn khi không đủ dữ liệu */}
      <BenchmarkBlock />

      {/* L2 — việc cần làm: mỗi khối tự giữ dialog của mình */}
      <OutcomeDueBlock workspaceId={workspaceId} items={outcomeDue} loading={metricsLoading} />
      <AwaitingPaymentBlock workspaceId={workspaceId} items={awaitingPayment} loading={metricsLoading} />

      {/* Cuộc đấu giá sắp tới — full width */}
      <UpcomingAuctionsBlock listings={metrics.allListings} loading={metricsLoading} />

      {/* Tài sản chờ xác nhận + Tài sản tồn đọng — two-column row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PendingConfirmationsBlock
          items={pendingItems}
          totalCount={pendingItems.length}
          loading={pendingLoading}
        />
        <StuckAssetsBlock items={metrics.pendingAssets} loading={metricsLoading} />
      </div>
    </div>
  );
};

export default OwnerDashboard;

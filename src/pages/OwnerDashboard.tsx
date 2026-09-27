import { useNavigate } from "react-router-dom";
import { Loader2, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OverviewFilters } from "@/components/asset-owner-portal/overview/OverviewFilters";
import { RevenueTargetBlock } from "@/components/asset-owner-portal/overview/RevenueTargetBlock";
import { PortfolioAnalysisBlock } from "@/components/asset-owner-portal/overview/PortfolioAnalysisBlock";
import { TodoListBlock } from "@/components/asset-owner-portal/overview/TodoListBlock";
import { AuctionCalendarBlock } from "@/components/asset-owner-portal/overview/AuctionCalendarBlock";
import { useOwnerOverview } from "@/hooks/useOwnerOverview";
import { targetScopeLabel } from "@/lib/ownerTargets";

/**
 * Tổng quan — 4 khối theo thứ tự ưu tiên: Chỉ tiêu doanh thu → Phân tích danh mục
 * → Việc cần làm + Lịch đấu giá 7 ngày. Bộ lọc Đơn vị + Kỳ ở đầu trang áp cho cả trang
 * (Kỳ chỉ đổi Chỉ tiêu và Phân tích). Việc cần làm chỉ dẫn tới trang nơi việc được làm.
 */
const OwnerDashboard = () => {
  const navigate = useNavigate();
  const ov = useOwnerOverview();

  if (ov.workspaceLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ov.workspaceId) {
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
        subtitle="Tiến độ chỉ tiêu, sức khoẻ danh mục và việc cần làm của đơn vị bạn."
        actions={
          <OverviewFilters
            scope={ov.scope}
            periodType={ov.periodType}
            branches={ov.branches}
            onChange={ov.setFilters}
          />
        }
      />

      <RevenueTargetBlock
        progress={ov.target}
        scopeLabel={targetScopeLabel(ov.scope, ov.branches)}
        periodLabel={ov.span.label}
        canManage={ov.canManage}
        loading={ov.loading.target}
      />

      <PortfolioAnalysisBlock
        chart={ov.chart}
        kpis={ov.kpis}
        periodLabel={ov.span.label}
        loading={ov.loading.analysis}
        error={ov.analysisError}
        onRetry={() => void ov.retryAnalysis()}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <TodoListBlock todos={ov.todos} loading={ov.loading.todo} className="min-w-0 lg:col-span-7" />
        <AuctionCalendarBlock
          days={ov.calendar}
          today={ov.today}
          loading={ov.loading.calendar}
          className="min-w-0 lg:col-span-5"
        />
      </div>
    </div>
  );
};

export default OwnerDashboard;

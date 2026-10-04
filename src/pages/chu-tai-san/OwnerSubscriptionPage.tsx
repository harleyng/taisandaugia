import { BadgeCheck, Loader2 } from "lucide-react";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { CurrentPlanHero } from "@/components/asset-owner-portal/subscription/CurrentPlanHero";
import { QuotaCard } from "@/components/asset-owner-portal/subscription/QuotaCard";
import { PlanCatalogSection } from "@/components/asset-owner-portal/subscription/PlanCatalogSection";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerSubscription } from "@/hooks/useOwnerSubscription";

const SUBSCRIPTION_SUBTITLE = "Mọi thành viên của Trạm dùng chung hạn mức trong gói, làm mới theo chu kỳ của từng quyền lợi.";

/**
 * /chu-tai-san/goi-thue-bao — "Gói dịch vụ" của Trạm đang chọn (design "Goi Dich Vu Chu Tai
 * San"): gói hiện tại + hạn mức hiện tại. "Xem các gói khác" mở trang riêng
 * (/goi-thue-bao/cac-goi); Trạm chưa có gói thì danh mục hiện ngay tại đây.
 * Tenant "Cá nhân" vẫn dùng credit (trang Credit).
 */
export default function OwnerSubscriptionPage() {
  const { workspaceId, workspace, isOwner, isLoading: wsLoading } = useOwnerWorkspace();
  const { data: sub, isLoading } = useOwnerSubscription(workspaceId);
  const hasPlan = !!sub && sub.status !== "cancelled";

  if (wsLoading || (workspaceId && isLoading)) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <OwnerPageHeader
        title="Gói dịch vụ"
        subtitle={workspace ? `${workspace.primary_name} · ${SUBSCRIPTION_SUBTITLE}` : SUBSCRIPTION_SUBTITLE}
      />

      <OwnerNoWorkspaceState icon={BadgeCheck}>
        <div className="flex flex-col gap-[22px]">
          {sub && <CurrentPlanHero sub={sub} />}
          {hasPlan && sub && <QuotaCard sub={sub} />}
          {!hasPlan && workspaceId && <PlanCatalogSection workspaceId={workspaceId} sub={sub} isOwner={isOwner} />}
        </div>
      </OwnerNoWorkspaceState>
    </div>
  );
}

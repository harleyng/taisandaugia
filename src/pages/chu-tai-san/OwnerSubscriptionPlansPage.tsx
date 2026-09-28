import { useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { PlanCatalogSection } from "@/components/asset-owner-portal/subscription/PlanCatalogSection";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerSubscription } from "@/hooks/useOwnerSubscription";
import { OWNER_SUBSCRIPTION_PATH } from "@/lib/ownerSubscription/paths";

/**
 * /chu-tai-san/goi-thue-bao/cac-goi — "Xem các gói khác": danh mục gói (chọn kỳ, thẻ gói,
 * bảng so sánh) trên trang riêng, nút quay lại trang Gói dịch vụ.
 */
export default function OwnerSubscriptionPlansPage() {
  const navigate = useNavigate();
  const { workspaceId, workspace, isOwner, isLoading: wsLoading } = useOwnerWorkspace();
  const { data: sub, isLoading } = useOwnerSubscription(workspaceId);
  const hasPlan = !!sub && sub.status !== "cancelled";

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-2">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => navigate(OWNER_SUBSCRIPTION_PATH)}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          Gói dịch vụ
        </Button>
        <OwnerPageHeader
          title={hasPlan ? "Các gói khác" : "Chọn gói cho Trạm"}
          subtitle={`${workspace ? `${workspace.primary_name} · ` : ""}Đổi gói có hiệu lực từ kỳ kế tiếp. Giá chưa gồm VAT.`}
        />
      </div>

      <OwnerNoWorkspaceState icon={BadgeCheck}>
        {wsLoading || (workspaceId && isLoading) ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          workspaceId && <PlanCatalogSection workspaceId={workspaceId} sub={sub} isOwner={isOwner} showHeading={false} />
        )}
      </OwnerNoWorkspaceState>
    </div>
  );
}

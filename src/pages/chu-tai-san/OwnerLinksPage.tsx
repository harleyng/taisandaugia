import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { BranchLinkSection } from "@/components/asset-owner-portal/links/BranchLinkSection";
import { HqLinkSection } from "@/components/asset-owner-portal/links/HqLinkSection";
import { ConfirmUnlinkDialog, type UnlinkTarget } from "@/components/asset-owner-portal/links/ConfirmUnlinkDialog";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerLinkOverview } from "@/hooks/useOwnerWorkspaceLinks";
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";

/**
 * Liên kết trụ sở ↔ chi nhánh — /chu-tai-san/lien-ket (docs/owner-control-tower-plan.md Phase 14).
 * Trụ sở gửi yêu cầu tới Trạm của đơn vị con trong danh bạ; Trưởng đơn vị chi nhánh
 * đồng ý thì trụ sở được XEM số liệu. Thành viên khác chỉ xem trạng thái.
 */
const OwnerLinksPage = () => {
  const navigate = useNavigate();
  const { workspaceId, workspace, accessVia, can, isLoading: wsLoading } = useOwnerWorkspace();
  const viaHq = accessVia === "hq";
  const canManage = can("lien-ket", "update");
  const overviewQ = useOwnerLinkOverview(workspaceId, !viaHq);
  const [unlinkTarget, setUnlinkTarget] = useState<UnlinkTarget | null>(null);

  if (wsLoading || (!viaHq && workspaceId && overviewQ.isLoading)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId || !workspace) {
    return (
      <OwnerNoWorkspaceState icon={Network}>
        <EmptyState
          icon={Network}
          title="Chưa có không gian làm việc"
          description="Liên kết trụ sở – chi nhánh dành cho chủ tài sản là tổ chức đã xác thực."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  const header = <OwnerPageHeader title="Liên kết" subtitle={`Trụ sở và chi nhánh của ${workspace.primary_name}`} />;

  if (viaHq) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={Network}
          title="Bạn đang xem Trạm này với tư cách trụ sở"
          description="Chỉ Trưởng đơn vị chi nhánh quản lý liên kết. Muốn huỷ liên kết, hãy mở Trạm của trụ sở."
        />
      </div>
    );
  }

  const overview = overviewQ.data;
  if (overviewQ.isError || !overview) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={Network}
          tone="warning"
          title="Chưa tải được thông tin liên kết"
          description={ownerWsErrorMessage(overviewQ.error)}
          action={<Button variant="outline" onClick={() => void overviewQ.refetch()}>Thử lại</Button>}
        />
      </div>
    );
  }

  // Chi nhánh: pháp nhân có công ty mẹ trong danh bạ, hoặc đã / đang được mời liên kết.
  const showBranch = !!overview.entity?.parent_name || !!overview.parent || overview.incoming.length > 0;
  // Trụ sở: gắn pháp nhân, không tự là chi nhánh, và danh bạ có đơn vị con (hoặc còn Trạm đã liên kết).
  const showHq =
    overview.children.some((c) => c.state === "linked") ||
    (overview.can_have_children && overview.children.length > 0);

  return (
    <div className="space-y-6">
      {header}

      {!showBranch && !showHq && (
        <EmptyState
          icon={Network}
          title={
            overview.entity
              ? "Danh bạ chưa ghi nhận trụ sở hay đơn vị con của đơn vị này"
              : "Trạm chưa gắn pháp nhân trong danh bạ"
          }
          description="Liên kết trụ sở – chi nhánh dựa trên danh bạ đơn vị của sàn. Cần điều chỉnh, hãy liên hệ sàn."
          action={<Button variant="outline" onClick={() => navigate("/lien-he")}>Liên hệ sàn</Button>}
        />
      )}

      {showBranch && (
        <BranchLinkSection
          workspaceId={workspaceId}
          overview={overview}
          canManage={canManage}
          onUnlink={setUnlinkTarget}
        />
      )}
      {showHq && (
        <HqLinkSection
          workspaceId={workspaceId}
          overview={overview}
          canManage={canManage}
          onUnlink={setUnlinkTarget}
        />
      )}

      <ConfirmUnlinkDialog target={unlinkTarget} onClose={() => setUnlinkTarget(null)} workspaceId={workspaceId} />
    </div>
  );
};

export default OwnerLinksPage;

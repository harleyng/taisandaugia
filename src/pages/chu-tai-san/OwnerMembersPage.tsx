import { useMemo, useState } from "react";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { useNavigate } from "react-router-dom";
import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerMembersTable } from "@/components/asset-owner-portal/members/OwnerMembersTable";
import { OwnerInvitesCard } from "@/components/asset-owner-portal/members/OwnerInvitesCard";
import { InviteOwnerMemberDialog } from "@/components/asset-owner-portal/members/InviteOwnerMemberDialog";
import { EditOwnerMemberDialog } from "@/components/asset-owner-portal/members/EditOwnerMemberDialog";
import { RemoveOwnerMemberDialog } from "@/components/asset-owner-portal/members/RemoveOwnerMemberDialog";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import {
  useOwnerWorkspaceInvites,
  useOwnerWorkspaceMembers,
  useWorkspaceBranchOptions,
  type OwnerWorkspaceMember,
} from "@/hooks/useOwnerWorkspaceMembers";

/**
 * Thành viên của không gian chủ tài sản — /chu-tai-san/thanh-vien.
 * Trưởng đơn vị mời / đổi vai trò / gỡ; các vai trò khác xem danh sách.
 * Mọi thao tác ghi đi qua RPC owner_ws_* (docs/owner-control-tower-plan.md Phase 3).
 */
const OwnerMembersPage = () => {
  const navigate = useNavigate();
  const { workspaceId, workspace, userId, can, accessVia, isLoading: wsLoading } = useOwnerWorkspace();
  const canManage = can("manage_members");
  // Trụ sở xem Trạm chi nhánh qua liên kết: danh sách thành viên chỉ chi nhánh thấy.
  const viaHq = accessVia === "hq";

  const membersQ = useOwnerWorkspaceMembers(viaHq ? null : workspaceId);
  const invitesQ = useOwnerWorkspaceInvites(workspaceId, canManage);
  const { data: branches = [] } = useWorkspaceBranchOptions(workspaceId);
  const branchNames = useMemo(() => new Map(branches.map((b) => [b.id, b.label])), [branches]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OwnerWorkspaceMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<OwnerWorkspaceMember | null>(null);

  if (wsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId || !workspace) {
    return (
      <OwnerNoWorkspaceState icon={Users}>
        <EmptyState
          icon={Users}
          title="Chưa có không gian làm việc"
          description="Thành viên dùng cho chủ tài sản là tổ chức đã xác thực, hoặc người được một đơn vị mời vào."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  if (viaHq) {
    return (
      <div className="space-y-6">
        <OwnerPageHeader title="Thành viên" subtitle={workspace.primary_name} />
        <EmptyState
          icon={Users}
          title="Danh sách thành viên chỉ chi nhánh thấy"
          description="Trụ sở xem số liệu của chi nhánh đã liên kết, nhưng không xem ai đang làm việc trong Trạm của họ."
        />
      </div>
    );
  }

  const members = membersQ.data ?? [];
  const pendingCount = (invitesQ.data ?? []).length;
  const subtitle = canManage
    ? `${members.length} thành viên · ${pendingCount} lời mời đang chờ`
    : `${members.length} thành viên · Chỉ Trưởng đơn vị mới mời và phân quyền`;

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Thành viên"
        subtitle={membersQ.isLoading ? workspace.primary_name : subtitle}
        actions={
          canManage && (
            <Button onClick={() => setInviteOpen(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" strokeWidth={1.5} />
              Mời thành viên
            </Button>
          )
        }
      />

      <SectionCard title={workspace.primary_name} icon={Users} count={members.length}>
        {membersQ.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : membersQ.isError ? (
          <EmptyState
            compact
            tone="destructive"
            icon={Users}
            title="Chưa tải được danh sách thành viên."
            action={
              <Button size="sm" variant="outline" onClick={() => void membersQ.refetch()}>
                Thử lại
              </Button>
            }
          />
        ) : (
          <OwnerMembersTable
            members={members}
            branchNames={branchNames}
            currentUserId={userId}
            canManage={canManage}
            onEdit={setEditTarget}
            onRemove={setRemoveTarget}
          />
        )}
      </SectionCard>

      {canManage && (
        <OwnerInvitesCard
          workspaceId={workspaceId}
          invites={invitesQ.data ?? []}
          isLoading={invitesQ.isLoading}
          isError={invitesQ.isError}
          onRetry={() => void invitesQ.refetch()}
          branchNames={branchNames}
        />
      )}

      {canManage && (
        <>
          <InviteOwnerMemberDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            workspaceId={workspaceId}
            branches={branches}
          />
          <EditOwnerMemberDialog
            member={editTarget}
            onClose={() => setEditTarget(null)}
            workspaceId={workspaceId}
            branches={branches}
          />
          <RemoveOwnerMemberDialog
            member={removeTarget}
            onClose={() => setRemoveTarget(null)}
            workspaceId={workspaceId}
            workspaceName={workspace.primary_name}
          />
        </>
      )}
    </div>
  );
};

export default OwnerMembersPage;

import { useMemo, useState } from "react";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { useNavigate } from "react-router-dom";
import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerTabsList, OwnerTabsTrigger } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerMembersTable } from "@/components/asset-owner-portal/members/OwnerMembersTable";
import { OwnerInvitesCard } from "@/components/asset-owner-portal/members/OwnerInvitesCard";
import { InviteOwnerMemberDialog } from "@/components/asset-owner-portal/members/InviteOwnerMemberDialog";
import { EditOwnerMemberDialog } from "@/components/asset-owner-portal/members/EditOwnerMemberDialog";
import { RemoveOwnerMemberDialog } from "@/components/asset-owner-portal/members/RemoveOwnerMemberDialog";
import { MemberPhoneDialog } from "@/components/asset-owner-portal/members/MemberPhoneDialog";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import {
  useOwnerWorkspaceInvites,
  useOwnerWorkspaceMembers,
  useWorkspaceBranchOptions,
  type OwnerWorkspaceMember,
} from "@/hooks/useOwnerWorkspaceMembers";

const TAB_MEMBERS = "thanh-vien";
const TAB_INVITES = "loi-moi";
const DEFAULTS = { tab: TAB_MEMBERS };
const ALLOWED = { tab: [TAB_MEMBERS, TAB_INVITES] } as const;

/**
 * Thành viên của không gian chủ tài sản — /chu-tai-san/thanh-vien.
 * Mời / đổi vai trò / gỡ theo quyền module "Thành viên" của vai trò (thanh-vien:
 * create / update / delete); vai trò tự định nghĩa ở /chu-tai-san/vai-tro.
 * Hai tab Thành viên / Lời mời (?tab=loi-moi) — tab Lời mời chỉ người mời được thấy (RLS).
 * Mọi thao tác ghi đi qua RPC owner_ws_* (docs/owner-control-tower-plan.md Phase 3).
 */
const OwnerMembersPage = () => {
  const navigate = useNavigate();
  const { workspaceId, workspace, userId, can, isOwner, accessVia, isLoading: wsLoading } = useOwnerWorkspace();
  const canInvite = can("thanh-vien", "create");
  const canEditMember = can("thanh-vien", "update");
  const canRemoveMember = can("thanh-vien", "delete");
  // Trụ sở xem Trạm chi nhánh qua liên kết: danh sách thành viên chỉ chi nhánh thấy.
  const viaHq = accessVia === "hq";

  const membersQ = useOwnerWorkspaceMembers(viaHq ? null : workspaceId);
  const invitesQ = useOwnerWorkspaceInvites(workspaceId, canInvite);
  const { data: branches = [] } = useWorkspaceBranchOptions(workspaceId);
  const branchNames = useMemo(() => new Map(branches.map((b) => [b.id, b.label])), [branches]);

  const [f, setFilter] = useUrlFilterState(DEFAULTS, ALLOWED);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OwnerWorkspaceMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<OwnerWorkspaceMember | null>(null);
  const [phoneTarget, setPhoneTarget] = useState<OwnerWorkspaceMember | null>(null);

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
  // "Đang chờ" = chưa hết hạn; lời mời hết hạn vẫn nằm trong tab để "Mời lại" nhưng không tính.
  const pendingCount = (invitesQ.data ?? []).filter((inv) => !inv.isExpired).length;
  const tab = canInvite ? f.tab : TAB_MEMBERS;
  const subtitle = canInvite
    ? `${members.length} thành viên · ${pendingCount} lời mời đang chờ`
    : `${members.length} thành viên`;

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Thành viên"
        subtitle={membersQ.isLoading ? workspace.primary_name : subtitle}
        actions={
          canInvite && (
            <Button onClick={() => setInviteOpen(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" strokeWidth={1.5} />
              Mời thành viên
            </Button>
          )
        }
      />

      <Tabs value={tab} onValueChange={(v) => v && setFilter("tab", v)} className="space-y-4">
        {canInvite && (
          <OwnerTabsList aria-label="Thành viên và lời mời">
            <OwnerTabsTrigger value={TAB_MEMBERS}>Thành viên</OwnerTabsTrigger>
            <OwnerTabsTrigger value={TAB_INVITES} count={pendingCount > 0 ? pendingCount : undefined}>
              Lời mời
            </OwnerTabsTrigger>
          </OwnerTabsList>
        )}

        <TabsContent value={TAB_MEMBERS} className="mt-0">
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
                canEdit={canEditMember}
                canRemove={canRemoveMember}
                viewerIsOwner={isOwner}
                onEdit={setEditTarget}
                onEditPhone={setPhoneTarget}
                onRemove={setRemoveTarget}
              />
            )}
          </SectionCard>
        </TabsContent>

        {canInvite && (
          <TabsContent value={TAB_INVITES} className="mt-0">
            <OwnerInvitesCard
              workspaceId={workspaceId}
              invites={invitesQ.data ?? []}
              isLoading={invitesQ.isLoading}
              isError={invitesQ.isError}
              onRetry={() => void invitesQ.refetch()}
              branchNames={branchNames}
            />
          </TabsContent>
        )}
      </Tabs>

      {canInvite && (
        <InviteOwnerMemberDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          workspaceId={workspaceId}
          branches={branches}
        />
      )}
      {canEditMember && (
        <EditOwnerMemberDialog
          member={editTarget}
          onClose={() => setEditTarget(null)}
          workspaceId={workspaceId}
          branches={branches}
        />
      )}
      {canEditMember && (
        <MemberPhoneDialog member={phoneTarget} onClose={() => setPhoneTarget(null)} workspaceId={workspaceId} />
      )}
      {canRemoveMember && (
        <RemoveOwnerMemberDialog
          member={removeTarget}
          onClose={() => setRemoveTarget(null)}
          workspaceId={workspaceId}
          workspaceName={workspace.primary_name}
        />
      )}
    </div>
  );
};

export default OwnerMembersPage;

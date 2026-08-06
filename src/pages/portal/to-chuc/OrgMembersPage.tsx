import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useOrgPermissions, useHasOrgPermission } from "@/hooks/useOrgPermissions";
import { MembersTable } from "@/components/portal/to-chuc/MembersTable";
import { InviteMemberDialog } from "@/components/portal/to-chuc/InviteMemberDialog";
import { ChangeMemberRoleDialog } from "@/components/portal/to-chuc/ChangeMemberRoleDialog";
import { RemoveMemberDialog } from "@/components/portal/to-chuc/RemoveMemberDialog";
import type { OrgMemberRow } from "@/types/orgRbac";

export default function OrgMembersPage() {
  const { userId } = useAuth();
  const { currentOrgId } = useOrg();
  const { isOwner } = useOrgPermissions(currentOrgId);
  const { data: rows, isLoading, error } = useOrgMembers(currentOrgId);

  const canCreate = useHasOrgPermission("thanh-vien", "create");
  const canUpdate = useHasOrgPermission("thanh-vien", "update");
  const canDelete = useHasOrgPermission("thanh-vien", "delete");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<OrgMemberRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<OrgMemberRow | null>(null);

  const list = rows ?? [];
  const memberCount = list.filter((r) => r.kind === "MEMBER").length;
  const inviteCount = list.filter((r) => r.kind === "INVITE").length;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Thành viên</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading || error
              ? "Mời người dùng vào tổ chức và gán vai trò cho họ."
              : `${memberCount} đang hoạt động${inviteCount > 0 ? ` · ${inviteCount} đang mời` : ""}`}
          </p>
        </div>
        {canCreate && currentOrgId && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Mời thành viên
          </Button>
        )}
      </div>

      {currentOrgId && (
        <MembersTable
          rows={list}
          isLoading={isLoading}
          error={error}
          orgId={currentOrgId}
          currentUserId={userId ?? null}
          canUpdate={canUpdate}
          canDelete={canDelete}
          canInvite={canCreate}
          isOwner={isOwner}
          onChangeRole={setRoleTarget}
          onRemove={setRemoveTarget}
        />
      )}

      {currentOrgId && (
        <>
          <InviteMemberDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            orgId={currentOrgId}
          />
          <ChangeMemberRoleDialog
            open={!!roleTarget}
            onOpenChange={(o) => !o && setRoleTarget(null)}
            orgId={currentOrgId}
            member={roleTarget}
            isOwner={isOwner}
          />
          <RemoveMemberDialog
            open={!!removeTarget}
            onOpenChange={(o) => !o && setRemoveTarget(null)}
            orgId={currentOrgId}
            member={removeTarget}
          />
        </>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  useUpdateOwnerMember,
  type OwnerWorkspaceMember,
  type WorkspaceBranchOption,
} from "@/hooks/useOwnerWorkspaceMembers";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerWsRoles } from "@/hooks/useOwnerWsRoles";
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";
import { roleWithinCaller } from "@/lib/ownerWorkspace/roles";
import { OwnerRolePicker } from "../roles/OwnerRolePicker";
import { BranchScopePicker } from "./BranchScopePicker";
import { EXCEEDS_OWN_ROLE_NOTE } from "../roles/roleCopy";

interface Props {
  /** null ⇒ đóng. */
  member: OwnerWorkspaceMember | null;
  onClose: () => void;
  workspaceId: string;
  branches: WorkspaceBranchOption[];
}

/**
 * Đổi vai trò / phạm vi chi nhánh của một thành viên khác (thanh-vien:update).
 * Chỉ Trưởng đơn vị trao / gỡ Trưởng đơn vị; người khác chỉ chọn vai trò nằm trong
 * quyền của mình (server kiểm lại).
 */
export function EditOwnerMemberDialog({ member, onClose, workspaceId, branches }: Props) {
  const update = useUpdateOwnerMember(workspaceId);
  const { access } = useOwnerWorkspace();
  const { data: roles = [] } = useOwnerWsRoles(workspaceId);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [scope, setScope] = useState<string[] | null>(null);
  const [scopeError, setScopeError] = useState<string>();

  const selected = useMemo(() => roles.find((r) => r.id === roleId) ?? null, [roles, roleId]);
  const pickOwner = selected?.isSystem ?? false;

  // Khởi tạo theo từng thành viên. Chi nhánh đã xoá bị bỏ khỏi lựa chọn — nếu
  // không còn gì thì để trống (bắt chọn lại), KHÔNG tự nới thành toàn bộ.
  useEffect(() => {
    if (!member) return;
    const known = new Set(branches.map((b) => b.id));
    setRoleId(member.roleId);
    setScope(member.branchScope ? member.branchScope.filter((id) => known.has(id)) : null);
    setScopeError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.memberId]);

  const submit = async () => {
    if (!member || !roleId) return;
    if (!pickOwner && scope !== null && scope.length === 0) {
      setScopeError("Chọn ít nhất một chi nhánh, hoặc chọn “Toàn bộ chi nhánh”.");
      return;
    }
    try {
      await update.mutateAsync({
        memberId: member.memberId,
        roleId,
        branchScope: pickOwner ? null : scope,
      });
      toast.success(`Đã cập nhật quyền của ${member.fullName || member.email}`);
      onClose();
    } catch (err) {
      toast.error("Chưa cập nhật được", { description: ownerWsErrorMessage(err) });
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đổi vai trò</DialogTitle>
          <DialogDescription>{member?.fullName ? `${member.fullName} · ${member.email}` : member?.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>
            Vai trò <span className="text-destructive">*</span>
          </Label>
          <OwnerRolePicker
            value={roleId}
            onChange={setRoleId}
            roles={roles}
            lockedReason={(r) =>
              r.id === member?.roleId || roleWithinCaller(r, access)
                ? null
                : r.isSystem
                  ? "Chỉ Trưởng đơn vị trao được vai trò này."
                  : EXCEEDS_OWN_ROLE_NOTE
            }
          />
          {pickOwner && !member?.isOwner && (
            <p className="text-xs text-muted-foreground">
              Trưởng đơn vị có toàn quyền: mời, phân quyền, đổi vai trò và gỡ thành viên — kể cả bạn.
            </p>
          )}
        </div>

        {!pickOwner && (
          <div className="space-y-1.5">
            <Label>
              Phạm vi chi nhánh <span className="text-destructive">*</span>
            </Label>
            <BranchScopePicker
              branches={branches}
              value={scope}
              onChange={(v) => {
                setScope(v);
                setScopeError(undefined);
              }}
              error={scopeError}
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={() => void submit()} disabled={update.isPending || !roleId}>
            {update.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

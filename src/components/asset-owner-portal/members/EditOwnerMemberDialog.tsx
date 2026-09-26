import { useEffect, useState } from "react";
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
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";
import { OWNER_WS_ROLES, type OwnerWsRole } from "@/lib/ownerWorkspace/roles";
import { OwnerRoleRadio } from "./OwnerRoleRadio";
import { BranchScopePicker } from "./BranchScopePicker";

interface Props {
  /** null ⇒ đóng. */
  member: OwnerWorkspaceMember | null;
  onClose: () => void;
  workspaceId: string;
  branches: WorkspaceBranchOption[];
}

/** Đổi vai trò / phạm vi chi nhánh của một thành viên khác (chỉ Trưởng đơn vị). */
export function EditOwnerMemberDialog({ member, onClose, workspaceId, branches }: Props) {
  const update = useUpdateOwnerMember(workspaceId);
  const [role, setRole] = useState<OwnerWsRole>("viewer");
  const [scope, setScope] = useState<string[] | null>(null);
  const [scopeError, setScopeError] = useState<string>();

  // Khởi tạo theo từng thành viên. Chi nhánh đã xoá bị bỏ khỏi lựa chọn — nếu
  // không còn gì thì để trống (bắt chọn lại), KHÔNG tự nới thành toàn bộ.
  useEffect(() => {
    if (!member) return;
    const known = new Set(branches.map((b) => b.id));
    setRole(member.role);
    setScope(member.branchScope ? member.branchScope.filter((id) => known.has(id)) : null);
    setScopeError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.memberId]);

  const submit = async () => {
    if (!member) return;
    if (role === "staff" && scope !== null && scope.length === 0) {
      setScopeError("Chọn ít nhất một chi nhánh, hoặc chọn “Toàn bộ chi nhánh”.");
      return;
    }
    try {
      await update.mutateAsync({
        memberId: member.memberId,
        role,
        branchScope: role === "staff" ? scope : null,
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
          <Label>Vai trò</Label>
          <OwnerRoleRadio value={role} onChange={setRole} roles={OWNER_WS_ROLES} />
          {role === "owner" && member?.role !== "owner" && (
            <p className="text-xs text-muted-foreground">
              Trưởng đơn vị có toàn quyền: mời, đổi vai trò và gỡ thành viên — kể cả bạn.
            </p>
          )}
        </div>

        {role === "staff" && (
          <div className="space-y-1.5">
            <Label>Phạm vi chi nhánh</Label>
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
          <Button onClick={() => void submit()} disabled={update.isPending}>
            {update.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useOrgRoles } from "@/hooks/useOrgRoles";
import { useChangeMemberRole } from "@/hooks/useOrgMembers";
import { inviteErrorMessage } from "@/hooks/useOrgInvites";
import { OrgRolePicker } from "./OrgRolePicker";
import type { OrgMemberRow } from "@/types/orgRbac";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string;
  member: OrgMemberRow | null;
  isOwner: boolean;
}

export function ChangeMemberRoleDialog({ open, onOpenChange, orgId, member, isOwner }: Props) {
  const { data: roles } = useOrgRoles(orgId);
  const change = useChangeMemberRole();
  const [roleId, setRoleId] = useState("");

  // Khóa theo membershipId chứ không phải cả object `member`: object đổi tham
  // chiếu mỗi lần React Query refetch, kéo theo việc reset lựa chọn đang dở.
  const memberId = member?.membershipId;
  const currentRoleId = member?.roleId;
  useEffect(() => {
    if (open && memberId && currentRoleId) setRoleId(currentRoleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, memberId]);

  const submit = async () => {
    if (!member || !roleId || roleId === member.roleId) return onOpenChange(false);
    try {
      await change.mutateAsync({ membershipId: member.membershipId, orgId, roleId });
      toast.success("Đã đổi vai trò");
      onOpenChange(false);
    } catch (err) {
      toast.error("Đổi vai trò thất bại", { description: inviteErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Đổi vai trò</DialogTitle>
          <DialogDescription>
            Chọn vai trò mới cho{" "}
            <strong className="text-foreground">{member?.name || member?.email || "thành viên"}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-1">
          <OrgRolePicker
            roles={roles ?? []}
            value={roleId}
            onChange={setRoleId}
            isOwner={isOwner}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={change.isPending || roleId === member?.roleId}>
            {change.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

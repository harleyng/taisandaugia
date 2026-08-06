import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useRemoveMember } from "@/hooks/useOrgMembers";
import { inviteErrorMessage } from "@/hooks/useOrgInvites";
import type { OrgMemberRow } from "@/types/orgRbac";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string;
  member: OrgMemberRow | null;
}

export function RemoveMemberDialog({ open, onOpenChange, orgId, member }: Props) {
  const remove = useRemoveMember();

  const submit = async () => {
    if (!member) return;
    try {
      await remove.mutateAsync({ membershipId: member.membershipId, orgId });
      toast.success("Đã gỡ thành viên khỏi tổ chức");
      onOpenChange(false);
    } catch (err) {
      // Trigger org_protect_last_owner có thể chặn ở đây (Chủ sở hữu cuối cùng).
      toast.error("Gỡ thành viên thất bại", { description: inviteErrorMessage(err) });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Gỡ “{member?.name || member?.email || "thành viên"}” khỏi tổ chức?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Họ sẽ mất quyền truy cập portal của tổ chức ngay lập tức. Tài khoản cá nhân của
            họ không bị ảnh hưởng và có thể được mời lại sau.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void submit();
            }}
            disabled={remove.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Gỡ thành viên
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

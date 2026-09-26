import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { useRemoveOwnerMember, type OwnerWorkspaceMember } from "@/hooks/useOwnerWorkspaceMembers";
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";

interface Props {
  /** null ⇒ đóng. */
  member: OwnerWorkspaceMember | null;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
}

export function RemoveOwnerMemberDialog({ member, onClose, workspaceId, workspaceName }: Props) {
  const remove = useRemoveOwnerMember(workspaceId);
  const name = member?.fullName || member?.email || "thành viên này";

  const confirm = async () => {
    if (!member) return;
    try {
      await remove.mutateAsync(member.memberId);
      toast.success(`Đã gỡ ${name} khỏi không gian`);
      onClose();
    } catch (err) {
      toast.error("Chưa gỡ được", { description: ownerWsErrorMessage(err) });
    }
  };

  return (
    <AlertDialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Gỡ {name} khỏi không gian?</AlertDialogTitle>
          <AlertDialogDescription>
            Người này sẽ không còn xem hay thao tác trên dữ liệu của {workspaceName}. Các lời mời họ đã gửi mà
            chưa được dùng cũng bị thu hồi. Bạn có thể mời lại sau.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={remove.isPending}
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            {remove.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Gỡ thành viên
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

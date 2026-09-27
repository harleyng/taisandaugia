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
import { useDeleteOwnerWsRole } from "@/hooks/useOwnerWsRoles";
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";
import type { OwnerWsRoleRow } from "@/types/ownerRbac";

interface Props {
  /** null ⇒ đóng. */
  role: OwnerWsRoleRow | null;
  onClose: () => void;
  workspaceId: string;
  onDeleted?: () => void;
}

/**
 * Xoá vai trò. Còn thành viên hoặc lời mời chưa dùng ⇒ chặn ngay ở đây (server cũng
 * trả role_in_use) và nói rõ phải làm gì.
 */
export function DeleteOwnerRoleDialog({ role, onClose, workspaceId, onDeleted }: Props) {
  const del = useDeleteOwnerWsRole(workspaceId);
  const blocked = !!role && role.memberCount + role.inviteCount > 0;

  const confirm = async () => {
    if (!role) return;
    try {
      await del.mutateAsync(role.id);
      toast.success(`Đã xoá vai trò “${role.name}”`);
      onClose();
      onDeleted?.();
    } catch (err) {
      toast.error("Chưa xoá được", { description: ownerWsErrorMessage(err) });
    }
  };

  const usage = role
    ? [role.memberCount > 0 && `${role.memberCount} thành viên`, role.inviteCount > 0 && `${role.inviteCount} lời mời`]
        .filter(Boolean)
        .join(" và ")
    : "";

  return (
    <AlertDialog open={!!role} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá vai trò “{role?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {blocked
              ? `Còn ${usage} đang dùng vai trò này. Chuyển họ sang vai trò khác (hoặc thu hồi lời mời) trước khi xoá.`
              : "Thao tác này không thể hoàn tác."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={blocked || del.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (!blocked) void confirm();
            }}
          >
            {del.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Xoá vai trò
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

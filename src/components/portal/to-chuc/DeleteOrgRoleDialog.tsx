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
import { useDeleteOrgRole } from "@/hooks/useOrgRoles";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string;
  roleId: string;
  roleName: string;
  memberCount: number;
  onDeleted?: () => void;
}

/**
 * KHÁC bản admin: FK organization_memberships.role_id là ON DELETE RESTRICT
 * (admin dùng CASCADE), nên xóa vai trò còn thành viên sẽ LỖI ở database. Chặn
 * ngay ở UI và nói rõ phải làm gì thay vì để người dùng gặp lỗi Postgres.
 */
export function DeleteOrgRoleDialog({
  open,
  onOpenChange,
  orgId,
  roleId,
  roleName,
  memberCount,
  onDeleted,
}: Props) {
  const del = useDeleteOrgRole();
  const blocked = memberCount > 0;

  const submit = async () => {
    try {
      await del.mutateAsync({ id: roleId, orgId });
      toast.success("Đã xóa vai trò");
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast.error("Xóa thất bại", { description: (err as Error).message });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa vai trò “{roleName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {blocked
              ? `Còn ${memberCount} thành viên đang giữ vai trò này. Hãy chuyển họ sang vai trò khác trước khi xóa.`
              : "Thao tác này không thể hoàn tác."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (!blocked) void submit();
            }}
            disabled={blocked || del.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Xóa vai trò
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

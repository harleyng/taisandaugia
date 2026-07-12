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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDeleteRole } from "@/hooks/useAdminRoles";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roleId: string;
  roleName: string;
  onDeleted?: () => void;
}

export function DeleteRoleDialog({ open, onOpenChange, roleId, roleName, onDeleted }: Props) {
  const del = useDeleteRole();

  const run = async () => {
    try {
      await del.mutateAsync(roleId);
      toast.success("Đã xóa vai trò");
      onDeleted?.();
    } catch (err) {
      toast.error("Xóa thất bại", { description: (err as Error).message });
    } finally {
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa vai trò “{roleName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Các tài khoản đang được gán vai trò này sẽ mất các quyền tương ứng. Hành động không thể hoàn tác.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              run();
            }}
          >
            {del.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Xóa
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

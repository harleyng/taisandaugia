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
import { useUnlinkOwnerWorkspace } from "@/hooks/useOwnerWorkspaceLinks";
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";

export interface UnlinkTarget {
  /** Trạm chi nhánh của liên kết (RPC luôn nhận phía con). */
  childWorkspaceId: string;
  /** Tên bên kia — trụ sở (nếu mình là chi nhánh) hoặc chi nhánh (nếu mình là trụ sở). */
  otherName: string;
  side: "hq" | "branch";
}

interface Props {
  /** null ⇒ đóng. */
  target: UnlinkTarget | null;
  onClose: () => void;
  workspaceId: string;
}

export function ConfirmUnlinkDialog({ target, onClose, workspaceId }: Props) {
  const unlink = useUnlinkOwnerWorkspace(workspaceId);

  const confirm = async () => {
    if (!target) return;
    try {
      await unlink.mutateAsync(target.childWorkspaceId);
      toast.success(`Đã huỷ liên kết với ${target.otherName}`);
      onClose();
    } catch (err) {
      toast.error("Chưa huỷ được liên kết", { description: ownerWsErrorMessage(err) });
    }
  };

  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Huỷ liên kết với {target?.otherName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {target?.side === "branch"
              ? "Trụ sở sẽ không còn xem số liệu của Trạm này. Muốn liên kết lại, trụ sở phải gửi yêu cầu mới."
              : "Bạn sẽ không còn xem số liệu của chi nhánh này. Muốn liên kết lại, bạn gửi yêu cầu mới và chờ chi nhánh đồng ý."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={unlink.isPending}>Giữ liên kết</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={unlink.isPending}
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            {unlink.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Huỷ liên kết
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

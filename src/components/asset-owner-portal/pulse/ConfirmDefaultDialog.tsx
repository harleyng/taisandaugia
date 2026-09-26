import { Loader2 } from "lucide-react";
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
import { useUpdateOutcomePayment } from "@/hooks/useOwnerOutcomeReports";
import { DEFAULTED_PATCH } from "@/lib/ownerOutcomePayment";

export interface ConfirmDefaultTarget {
  outcomeId: string;
  title: string;
}

interface ConfirmDefaultDialogProps {
  workspaceId: string;
  /** null ⇒ đóng. */
  target: ConfirmDefaultTarget | null;
  onClose: () => void;
}

/** "Người trúng bỏ cọc" — xác nhận trước vì tài sản rời danh sách chờ thu. */
export function ConfirmDefaultDialog({ workspaceId, target, onClose }: ConfirmDefaultDialogProps) {
  const update = useUpdateOutcomePayment(workspaceId);
  const busy = update.isPending;

  const confirm = () => {
    if (!target) return;
    update.mutate(
      { outcomeId: target.outcomeId, patch: DEFAULTED_PATCH, successMessage: "Đã ghi nhận người trúng bỏ cọc" },
      { onSuccess: onClose },
    );
  };

  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Người trúng bỏ cọc?</AlertDialogTitle>
          <AlertDialogDescription>
            «{target?.title}» sẽ rời danh sách chờ thu tiền. Khi tài sản được đấu lại, hãy khai kết quả của lượt mới.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Xác nhận bỏ cọc
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

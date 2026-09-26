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
import { buttonVariants } from "@/components/ui/button";

interface DeleteReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onConfirm: () => void;
}

/** Xoá bản nháp (báo cáo đã chốt không có nút này). */
export function DeleteReportDialog({ open, onOpenChange, busy, onConfirm }: DeleteReportDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá bản nháp?</AlertDialogTitle>
          <AlertDialogDescription>
            Ghi chú của bản nháp sẽ mất. Số liệu kết quả phiên và chỉ tiêu không bị ảnh hưởng.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            Xoá bản nháp
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

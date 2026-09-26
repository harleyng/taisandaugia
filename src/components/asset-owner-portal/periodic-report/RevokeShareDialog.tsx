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
import { buttonVariants } from "@/components/ui/button";

interface RevokeShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onConfirm: () => void;
}

/** Xác nhận thu hồi link chia sẻ — người đã có link sẽ không mở được nữa. */
export function RevokeShareDialog({ open, onOpenChange, busy, onConfirm }: RevokeShareDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Thu hồi link chia sẻ?</AlertDialogTitle>
          <AlertDialogDescription>
            Người đã nhận link sẽ thấy thông báo link không còn hiệu lực. Bạn có thể tạo link mới bất cứ lúc nào — link
            mới sẽ khác link cũ.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Giữ link</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className={buttonVariants({ variant: "destructive" })}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Thu hồi link
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

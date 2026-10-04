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
import type { PostingShareLink } from "@/lib/postingShare/types";

interface RevokeShareLinkDialogProps {
  link: PostingShareLink | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (link: PostingShareLink) => void;
}

/** Xác nhận thu hồi một link Hồ sơ online. */
export function RevokeShareLinkDialog({ link, pending, onClose, onConfirm }: RevokeShareLinkDialogProps) {
  return (
    <AlertDialog open={!!link} onOpenChange={(v) => !v && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Thu hồi link “{link?.label}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Người đã nhận link sẽ thấy “Link hồ sơ không còn hiệu lực”. Số liệu cũ vẫn được giữ. Không hoàn tác được — cần gửi
            lại thì tạo link mới.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Đóng</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              if (link) onConfirm(link);
            }}
          >
            Thu hồi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

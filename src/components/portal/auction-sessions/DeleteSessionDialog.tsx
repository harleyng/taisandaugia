import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteAuctionSession } from "@/hooks/useAuctionSessions";

interface Props {
  sessionId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteSessionDialog({ sessionId, title, open, onOpenChange, onDeleted }: Props) {
  const remove = useDeleteAuctionSession();

  const confirm = () =>
    remove.mutate(sessionId, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted();
      },
    });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá phiên nháp «{title}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Phiên và danh sách tài sản trong phiên bị xoá hẳn. Tin đấu giá và hồ sơ ký gửi nguồn không bị ảnh hưởng.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Giữ lại</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={remove.isPending} className="gap-1.5">
            {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Xoá phiên
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

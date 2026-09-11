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
import { useDeleteSessionItem } from "@/hooks/useAuctionSessions";
import type { AuctionSessionItem } from "@/types/auction-session";

interface Props {
  item: AuctionSessionItem | null;
  onOpenChange: (open: boolean) => void;
}

export function RemoveSessionItemDialog({ item, onOpenChange }: Props) {
  const remove = useDeleteSessionItem();

  const confirm = () => {
    if (!item) return;
    remove.mutate({ id: item.id, sessionId: item.session_id }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <AlertDialog open={!!item} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Gỡ lô {item?.lot_no} khỏi phiên?</AlertDialogTitle>
          <AlertDialogDescription>
            «{item?.title}» sẽ bị gỡ khỏi phiên, các lô phía sau được đánh lại số. Tài sản nguồn không bị ảnh hưởng.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Giữ lại</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={remove.isPending} className="gap-1.5">
            {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Gỡ khỏi phiên
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

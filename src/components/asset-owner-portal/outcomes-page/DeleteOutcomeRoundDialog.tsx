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
import { useDeleteOwnerOutcome } from "@/hooks/useOwnerOutcomeEdit";
import type { OwnerOutcomeRecord } from "@/lib/ownerOutcomeEdit";

interface DeleteOutcomeRoundDialogProps {
  workspaceId: string;
  record: OwnerOutcomeRecord | null;
  onClose: () => void;
}

/** Xác nhận xoá một lượt đã khai (kèm biên bản). */
export function DeleteOutcomeRoundDialog({ workspaceId, record, onClose }: DeleteOutcomeRoundDialogProps) {
  const del = useDeleteOwnerOutcome(workspaceId);
  return (
    <AlertDialog open={!!record} onOpenChange={(v) => !v && !del.isPending && onClose()}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá lượt {record?.round_no}?</AlertDialogTitle>
          <AlertDialogDescription>
            Kết quả{record?.evidence_urls.length ? " và biên bản đính kèm" : ""} của lượt này sẽ bị xoá, không hoàn tác được.
            Số liệu từ tổ chức đấu giá hoặc phiên trên sàn (nếu có) vẫn giữ nguyên.
            {/* paid_amount / auction_fee chỉ khác NULL khi lượt có khoản trong sổ thu chi (Phase 15a). */}
            {record && (record.paid_amount !== null || record.auction_fee !== null) && (
              <span className="mt-2 block font-medium text-foreground">
                Các khoản thu chi đã ghi cho lượt này cũng bị xoá theo.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={del.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (record) del.mutate(record, { onSuccess: onClose });
            }}
          >
            Xoá lượt
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
